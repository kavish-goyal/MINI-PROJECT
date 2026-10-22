// routes/auth.js
// Handles: register, verify-email, resend-verification, login, logout,
//          forgot-password, reset-password, and /me (get current session).
// Email delivery: Gmail SMTP via nodemailer (Firebase/Google account).

const express   = require('express');
const argon2    = require('argon2');
const rateLimit = require('express-rate-limit');

const User    = require('../models/User');
const Token   = require('../models/Token');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { isValidEmail, isStrongPassword } = require('../middleware/validate');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// ── Rate limiter ─────────────────────────────────────────────────────────────
// In development: 100 requests per 15 min (so testing is not blocked).
// In production:  10 requests per 15 min (protects against brute-force).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, college, branch } = req.body;

    // Basic input validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Check if email is already registered
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      // If the account exists but is not verified, refresh token and provide direct link
      if (!existing.isVerified) {
        await Token.deleteMany({ userId: existing._id, type: 'verify' });
        const rawToken  = Token.generateRaw();
        const tokenHash = Token.hashToken(rawToken);
        await Token.create({
          userId:    existing._id,
          tokenHash,
          type:      'verify',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        });

        const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${rawToken}`;
        try {
          await sendVerificationEmail(existing.email, rawToken);
        } catch (emailErr) {
          console.error('[Email] Verification email failed:', emailErr.message);
        }

        return res.status(200).json({
          unverifiedExisting: true,
          message: 'An account with this email already exists but is not yet verified. A fresh verification link has been prepared.',
          verifyUrl,
        });
      }
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // Create the user
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      college: college ? college.trim() : '',
      branch: branch ? branch.trim() : '',
    });

    // Create a 24-hour verification token, store its hash in DB
    const rawToken  = Token.generateRaw();
    const tokenHash = Token.hashToken(rawToken);
    await Token.create({
      userId:    user._id,
      tokenHash,
      type:      'verify',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${rawToken}`;

    // Send verification email
    try {
      await sendVerificationEmail(user.email, rawToken);
    } catch (emailErr) {
      console.error('[Email] Verification email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Account created! Please verify your email to get started.',
      verifyUrl,
      userId: user._id,
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    }
    res.status(400).json({ error: err.message || 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/quick-verify ───────────────────────────────────────────────
// Convenient 1-click verification for testing or local development
router.post('/quick-verify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    user.isVerified = true;
    await user.save();
    await Token.deleteMany({ userId: user._id, type: 'verify' });

    res.json({ message: `Account for ${user.email} is now verified!` });
  } catch (err) {
    res.status(500).json({ error: 'Could not verify account.' });
  }
});

// ── POST /api/auth/verify-email ───────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    // Hash the raw token and look it up in the DB
    const tokenHash = Token.hashToken(token);
    const record    = await Token.findOne({ tokenHash, type: 'verify' });

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }

    // Mark the user as verified and delete the token (single-use)
    await User.findByIdAndUpdate(record.userId, { isVerified: true });
    await record.deleteOne();

    res.json({ message: 'Email verified! You can now log in.' });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to avoid exposing whether an email is registered
    if (!user || user.isVerified) {
      return res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
    }

    // Delete any old verification tokens for this user
    await Token.deleteMany({ userId: user._id, type: 'verify' });

    // Create a new one
    const rawToken  = Token.generateRaw();
    const tokenHash = Token.hashToken(rawToken);
    await Token.create({
      userId:    user._id,
      tokenHash,
      type:      'verify',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Send the email — wrapped so a delivery failure still returns success
    try {
      await sendVerificationEmail(user.email, rawToken);
    } catch (emailErr) {
      console.error('[Email] Resend verification failed:', emailErr.message);
    }

    res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
  } catch (err) {
    console.error('Resend error:', err.message);
    res.status(500).json({ error: 'Could not resend email. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Use generic error so attackers can't tell which field is wrong
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await argon2.verify(user.passwordHash, password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Regenerate session ID after login to prevent session-fixation attacks
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Login failed. Please try again.' });

      // Store user info in the session (available on future requests)
      req.session.userId     = user._id.toString();
      req.session.isVerified = user.isVerified;

      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: 'Login failed. Please try again.' });
        res.json({
          message: 'Logged in!',
          user: { id: user._id, name: user.name, isVerified: user.isVerified },
        });
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out.' });
  });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  // Always return the same generic message to avoid revealing registered emails
  const GENERIC_MSG = 'If an account with that email exists, a reset link has been sent.';

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: GENERIC_MSG });

    // Delete old reset tokens for this user, then create a fresh 15-minute one
    await Token.deleteMany({ userId: user._id, type: 'reset' });

    const rawToken  = Token.generateRaw();
    const tokenHash = Token.hashToken(rawToken);
    await Token.create({
      userId:    user._id,
      tokenHash,
      type:      'reset',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    // Send the reset email — wrapped so a delivery failure still returns success
    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (emailErr) {
      console.error('[Email] Password reset email failed:', emailErr.message);
    }

    res.json({ message: GENERIC_MSG });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Verify the token
    const tokenHash = Token.hashToken(token);
    const record    = await Token.findOne({ tokenHash, type: 'reset' });
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    // Update the password
    const newHash = await argon2.hash(password, { type: argon2.argon2id });
    await User.findByIdAndUpdate(record.userId, { passwordHash: newHash });

    // Delete the reset token (single-use)
    await record.deleteOne();

    // Destroy ALL sessions for this user by regenerating with no data,
    // forcing them to log in with their new password.
    // (connect-mongo doesn't support server-side "destroy all by userId" easily,
    //  so we destroy only the current session here; expiry handles the rest.)
    req.session.destroy(() => {});

    res.json({ message: 'Password reset! Please log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns current session info so the frontend knows if the user is logged in
router.get('/me', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('name email isVerified');
    if (!user) return res.status(401).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch session.' });
  }
});

module.exports = router;
