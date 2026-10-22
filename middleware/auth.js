// middleware/auth.js
// Simple middleware functions used to protect routes.
// They check the session and return 401/403 if the user isn't allowed.

// Requires the user to be logged in (session has userId)
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  next();
}

// Requires the user to have verified their email
// Used on routes like "create project" and "apply to project"
function requireVerified(req, res, next) {
  if (!req.session.isVerified) {
    return res.status(403).json({ error: 'Please verify your email address first.' });
  }
  next();
}

module.exports = { requireLogin, requireVerified };
