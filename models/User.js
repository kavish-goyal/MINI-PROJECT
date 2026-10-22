// models/User.js
// Defines what a user document looks like in MongoDB.

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // ── Authentication fields ──────────────────────────────────────────────
    name:           { type: String, required: true, trim: true },
    // Email is stored lowercase so "Alice@Gmail.com" and "alice@gmail.com" are the same
    email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Argon2id hash – plain text is NEVER stored
    passwordHash:   { type: String, required: true },
    // Users must verify their email before they can create projects or apply
    isVerified:     { type: Boolean, default: false },

    // ── Public profile fields ──────────────────────────────────────────────
    college:        { type: String, trim: true, default: '' },
    branch:         { type: String, trim: true, default: '' },
    // Graduation year, e.g. 2026
    gradYear:       { type: Number },
    bio:            { type: String, trim: true, default: '' },
    // Array of skill strings, e.g. ['React', 'Node.js']
    skills:         { type: [String], default: [] },
    // Primary builder roles, e.g. ['UI/UX Designer', 'Frontend Dev', 'AI/ML Engineer']
    roles:          { type: [String], default: [] },
    // Optional profile links – validated to start with https://
    githubUrl:      { type: String, trim: true, default: '' },
    linkedinUrl:    { type: String, trim: true, default: '' },
    portfolioUrl:   { type: String, trim: true, default: '' },
    // "open" means looking for a team, "busy" means not available
    availability:   { type: String, enum: ['open', 'busy'], default: 'open' },
  },
  {
    // Automatically adds createdAt and updatedAt timestamps
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
