// middleware/validate.js
// Small helper functions to validate and sanitise user-supplied values.
// Keep validation logic here so routes stay readable.

// Returns true if the string looks like a valid email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Returns true if password meets minimum security requirements
function isStrongPassword(password) {
  // At least 8 characters – simple rule easy for beginners to understand
  return typeof password === 'string' && password.length >= 8;
}

// Returns true if the URL starts with https:// (basic safety check for profile links)
function isValidHttpsUrl(url) {
  if (!url) return true; // Empty is allowed (optional field)
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Picks only the allowed keys from an object.
// Used before updating DB documents so the browser cannot inject extra fields.
function pickAllowed(obj, allowedKeys) {
  const result = {};
  for (const key of allowedKeys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

module.exports = { isValidEmail, isStrongPassword, isValidHttpsUrl, pickAllowed };
