// routes/users.js
// Handles: GET /api/users/:id (public profile) and PUT /api/users/me (update own profile)
//
// IMPORTANT: Routes with specific names (like /me/profile and /me) MUST come before
// wildcard routes like /:id, or Express will treat the word "me" as an ID.

const express  = require('express');
const User     = require('../models/User');
const { requireLogin } = require('../middleware/auth');
const { isValidHttpsUrl, pickAllowed } = require('../middleware/validate');

const router = express.Router();

// Fields a user can update on their own profile
const ALLOWED_PROFILE_FIELDS = [
  'name', 'college', 'branch', 'gradYear', 'bio', 'skills', 'roles', 'githubUrl', 'linkedinUrl', 'portfolioUrl', 'availability',
];

// ── GET /api/users/me/profile ─────────────────────────────────────────────────
// Returns the logged-in user's full profile (including fields hidden from public)
// Must be BEFORE /:id to prevent "me" being treated as an ObjectId
router.get('/me/profile', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────────
// Private: update the logged-in user's own profile
router.put('/me', requireLogin, async (req, res) => {
  try {
    // Only keep fields we explicitly allow (prevents overwriting passwordHash, etc.)
    const updates = pickAllowed(req.body, ALLOWED_PROFILE_FIELDS);

    // Validate profile URLs
    if (updates.githubUrl && !isValidHttpsUrl(updates.githubUrl)) {
      return res.status(400).json({ error: 'GitHub URL must start with https://' });
    }
    if (updates.linkedinUrl && !isValidHttpsUrl(updates.linkedinUrl)) {
      return res.status(400).json({ error: 'LinkedIn URL must start with https://' });
    }
    if (updates.portfolioUrl && !isValidHttpsUrl(updates.portfolioUrl)) {
      return res.status(400).json({ error: 'Portfolio URL must start with https://' });
    }

    // Clamp gradYear to a sensible range
    if (updates.gradYear) {
      const year = Number(updates.gradYear);
      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ error: 'Please enter a valid graduation year.' });
      }
      updates.gradYear = year;
    }

    // Trim skills and roles array
    if (Array.isArray(updates.skills)) {
      updates.skills = updates.skills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(updates.roles)) {
      updates.roles = updates.roles.map((r) => String(r).trim()).filter(Boolean);
    }

    const user = await User.findByIdAndUpdate(
      req.session.userId,
      updates,
      { new: true } // Return the updated document
    ).select('-passwordHash');

    res.json({ message: 'Profile updated!', user });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
// Public: anyone can view a profile (email and auth data are excluded)
// This wildcard route comes LAST so it doesn't swallow /me/profile requests
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name college branch gradYear bio skills roles githubUrl linkedinUrl portfolioUrl availability createdAt'
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
});

module.exports = router;
