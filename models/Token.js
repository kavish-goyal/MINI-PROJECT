// models/Token.js
// Stores email-verification and password-reset tokens.
// We only save the HASH of the token; the raw token goes in the email link.
// This way, even if the DB is breached, tokens can't be reused.

const mongoose = require('mongoose');
const crypto   = require('crypto');

const tokenSchema = new mongoose.Schema({
  // Which user this token belongs to
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // SHA-256 hash of the raw token string
  tokenHash:  { type: String, required: true },
  // 'verify' = email verification, 'reset' = password reset
  type:       { type: String, enum: ['verify', 'reset'], required: true },
  // Token automatically removed from DB when this date passes (MongoDB TTL index)
  expiresAt:  { type: Date, required: true },
});

// MongoDB will delete documents automatically after expiresAt
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helper: hash a raw token so we can compare later
tokenSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

// Helper: generate a cryptographically random token string
tokenSchema.statics.generateRaw = function () {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('Token', tokenSchema);
