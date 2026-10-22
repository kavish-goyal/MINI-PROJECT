// models/Application.js
// Tracks each student's application to a project.

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    // Who applied
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Which project they applied to
    project:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    // Short message the applicant writes explaining why they want to join
    message:   { type: String, required: true, trim: true },
    // Optional specific role applied for (especially for Hackathon teams)
    roleApplied: { type: String, trim: true, default: '' },
    // Current status of the application
    status: {
      type:    String,
      enum:    ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// A student can only apply to a project ONCE (compound unique index)
applicationSchema.index({ applicant: 1, project: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
