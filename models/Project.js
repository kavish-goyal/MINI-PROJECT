// models/Project.js
// Defines what a project document looks like in MongoDB.

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    // Category for filtering, e.g. 'Web', 'AI/ML', 'Mobile', 'Other'
    category:    { type: String, required: true, trim: true },
    // Skills the project needs, e.g. ['React', 'MongoDB']
    requiredSkills: { type: [String], default: [] },
    // How many students the project can accommodate total
    totalPositions:  { type: Number, required: true, min: 1 },
    // Array of User _ids who have been accepted
    acceptedMembers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    // Application deadline
    deadline:  { type: Date, required: true },
    // The student who created the project
    owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'open' = accepting applications, 'closed' = not accepting
    status:    { type: String, enum: ['open', 'closed'], default: 'open' },
    // College association for same-college filtering
    college:   { type: String, trim: true, default: '' },
    // Hackathon team formation features
    isHackathon:   { type: Boolean, default: false },
    hackathonName: { type: String, trim: true, default: '' },
    hackathonUrl:  { type: String, trim: true, default: '' },
    rolesNeeded:   { type: [String], default: [] },
  },
  { timestamps: true }
);

// Text index allows full-text search on title and description
projectSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Project', projectSchema);
