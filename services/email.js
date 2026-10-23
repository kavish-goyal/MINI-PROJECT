// services/email.js
// Email service using Firebase + Nodemailer (Gmail SMTP).
// Replaces the former Resend integration.
//
// Setup required:
//   1. Enable Gmail in your Google account (the one tied to your Firebase project)
//   2. Generate a Gmail App Password:
//      Google Account → Security → 2-Step Verification → App passwords
//      Choose app: "Mail", Choose device: "Other (DevConnect)" → Copy the 16-char password
//   3. Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env

const nodemailer = require('nodemailer');

// ── Transporter ────────────────────────────────────────────────────────────────
// Created once when the module loads; reused for all emails.
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,         // e.g. devconnect@gmail.com
      pass: process.env.GMAIL_APP_PASSWORD, // 16-char App Password (NOT your login password)
    },
    connectionTimeout: 5000, // 5s connection timeout
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  return _transporter;
}

// ── Base email template ────────────────────────────────────────────────────────
function baseTemplate({ title, preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0A0C10; font-family:'Segoe UI',Arial,sans-serif; }
    .shell { max-width:560px; margin:40px auto; }
    .card  { background:#141720; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
    .header { background:linear-gradient(135deg,#6366F1,#8B5CF6); padding:32px 40px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.02em; }
    .header p  { margin:8px 0 0; color:rgba(255,255,255,0.75); font-size:14px; }
    .body  { padding:36px 40px; color:#C8CFE0; font-size:15px; line-height:1.7; }
    .body h2 { color:#F0F2F8; font-size:20px; font-weight:700; margin:0 0 12px; }
    .btn   { display:inline-block; margin:24px 0 8px; padding:14px 32px;
             background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff;
             border-radius:10px; text-decoration:none; font-weight:700;
             font-size:15px; letter-spacing:0.01em; }
    .link-box { background:#0F1117; border:1px solid rgba(255,255,255,0.07);
                border-radius:8px; padding:12px 16px; margin-top:16px;
                word-break:break-all; font-size:13px; color:#8B93A7; font-family:monospace; }
    .footer { padding:20px 40px 32px; text-align:center; color:#555D73; font-size:12px; line-height:1.6; }
    .footer a { color:#6366F1; text-decoration:none; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <div class="header">
        <h1>⚡ DevConnect</h1>
        <p>${preheader}</p>
      </div>
      <div class="body">
        ${bodyHtml}
      </div>
      <div class="footer">
        This email was sent by DevConnect.<br/>
        If you didn't request this, you can safely ignore it.<br/>
        &copy; ${new Date().getFullYear()} DevConnect
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Low-level send ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[Email] Skipping email delivery: GMAIL_USER or GMAIL_APP_PASSWORD is not set.');
    return;
  }

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: `"DevConnect" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  
} catch (err) {
  console.error('[Email] Send failed:', {
    code: err.code,
    responseCode: err.responseCode,
    command: err.command,
    message: err.message
  });

  throw new Error('Email delivery failed.');
}

}

// ── Verification email ─────────────────────────────────────────────────────────
async function sendVerificationEmail(userEmail, rawToken) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${baseUrl}/verify-email.html?token=${rawToken}`;

  await sendEmail({
    to:      userEmail,
    subject: 'Verify your DevConnect email address',
    html: baseTemplate({
      title:    'Verify your email – DevConnect',
      preheader: 'Welcome! Please verify your email address.',
      bodyHtml: `
        <h2>Welcome to DevConnect! 🎉</h2>
        <p>You're almost ready to start finding great teammates and building real projects.</p>
        <p>Click the button below to verify your email address.
           This link expires in <strong style="color:#F0F2F8;">24 hours</strong>.</p>
        <div style="text-align:center;">
          <a href="${link}" class="btn">Verify Email Address</a>
        </div>
        <p style="font-size:13px;color:#555D73;margin-top:16px;">
          Or paste this link into your browser:
        </p>
        <div class="link-box">${link}</div>
      `,
    }),
  });
}

// ── Password reset email ───────────────────────────────────────────────────────
async function sendPasswordResetEmail(userEmail, rawToken) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${baseUrl}/reset-password.html?token=${rawToken}`;

  await sendEmail({
    to:      userEmail,
    subject: 'Reset your DevConnect password',
    html: baseTemplate({
      title:    'Password Reset – DevConnect',
      preheader: 'Reset your password within 15 minutes.',
      bodyHtml: `
        <h2>Password Reset Request 🔑</h2>
        <p>We received a request to reset the password for your DevConnect account.</p>
        <p>Click the button below to choose a new password.
           This link expires in <strong style="color:#F0F2F8;">15 minutes</strong>.</p>
        <div style="text-align:center;">
          <a href="${link}" class="btn">Reset My Password</a>
        </div>
        <p style="font-size:13px;color:#555D73;margin-top:16px;">
          If you didn't request a password reset, you can safely ignore this email —
          your account is still secure.
        </p>
        <p style="font-size:13px;color:#555D73;">Or paste this link into your browser:</p>
        <div class="link-box">${link}</div>
      `,
    }),
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
