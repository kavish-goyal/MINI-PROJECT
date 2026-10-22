// routes/applications.js
// Handles: apply, withdraw, list (for owner), accept, reject applications.

const express = require('express');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Project     = require('../models/Project');
const { requireLogin, requireVerified } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/applications ────────────────────────────────────────────────────
// Verified user applies to a project
router.post('/', requireLogin, requireVerified, async (req, res) => {
  try {
    const { projectId, message, roleApplied } = req.body;
    if (!projectId || !message) {
      return res.status(400).json({ error: 'Project ID and message are required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // ── Guards ────────────────────────────────────────────────────────────────
    // Can't apply to your own project
    if (project.owner.toString() === req.session.userId) {
      return res.status(400).json({ error: "You can't apply to your own project." });
    }
    // Project must be open
    if (project.status === 'closed') {
      return res.status(400).json({ error: 'This project is no longer accepting applications.' });
    }
    // Deadline must not have passed
    if (new Date(project.deadline) < new Date()) {
      return res.status(400).json({ error: 'The application deadline has passed.' });
    }
    // Team must not be full
    if (project.acceptedMembers.length >= project.totalPositions) {
      return res.status(400).json({ error: 'This project is already full.' });
    }

    // Create the application (duplicate will throw due to unique index)
    const application = await Application.create({
      applicant:   req.session.userId,
      project:     projectId,
      message:     message.trim(),
      roleApplied: roleApplied ? String(roleApplied).trim() : '',
    });

    res.status(201).json({ message: 'Application submitted!', application });
  } catch (err) {
    // Mongoose duplicate key error code
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already applied to this project.' });
    }
    console.error('Apply error:', err.message);
    res.status(500).json({ error: 'Could not submit application.' });
  }
});

// ── GET /api/applications/mine ────────────────────────────────────────────────
// Private: get all applications made by the logged-in user (for dashboard)
router.get('/mine', requireLogin, async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.session.userId })
      .populate('project', 'title category status deadline owner')
      .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch your applications.' });
  }
});

// ── DELETE /api/applications/:id ──────────────────────────────────────────────
// Applicant withdraws a pending application
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    // Only the applicant can withdraw
    if (application.applicant.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'You can only withdraw your own applications.' });
    }
    // Can only withdraw pending applications
    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'You can only withdraw pending applications.' });
    }

    application.status = 'withdrawn';
    await application.save();
    res.json({ message: 'Application withdrawn.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not withdraw application.' });
  }
});

// ── GET /api/applications/project/:projectId ──────────────────────────────────
// Private (owner only): get all applications for a project
router.get('/project/:projectId', requireLogin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (project.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only the project owner can view applications.' });
    }

    const applications = await Application.find({ project: req.params.projectId })
      .populate('applicant', 'name college branch skills githubUrl linkedinUrl')
      .sort({ createdAt: -1 });

    res.json({ applications, project });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch applications.' });
  }
});

// ── POST /api/applications/:id/accept ────────────────────────────────────────
// Private (owner only): accept an application.
// Uses a MongoDB transaction so two simultaneous accepts can't overfill the team.
router.post('/:id/accept', requireLogin, async (req, res) => {
  // Start a DB session for the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await Application.findById(req.params.id).session(session);
    if (!application) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (application.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Can only accept pending applications.' });
    }

    // Fetch the project inside the transaction so the read is consistent
    const project = await Project.findById(application.project).session(session);
    if (!project) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Verify ownership
    if (project.owner.toString() !== req.session.userId) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Only the project owner can accept applicants.' });
    }

    // Check team is not full (inside transaction = safe from race conditions)
    if (project.acceptedMembers.length >= project.totalPositions) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'The team is already full.' });
    }

    // Add member and update status atomically
    project.acceptedMembers.push(application.applicant);
    application.status = 'accepted';

    // Auto-close project if now full
    if (project.acceptedMembers.length >= project.totalPositions) {
      project.status = 'closed';
    }

    await project.save({ session });
    await application.save({ session });

    await session.commitTransaction();
    res.json({ message: 'Applicant accepted!' });
  } catch (err) {
    await session.abortTransaction();
    console.error('Accept error:', err.message);
    res.status(500).json({ error: 'Could not accept applicant.' });
  } finally {
    session.endSession();
  }
});

// ── POST /api/applications/:id/reject ────────────────────────────────────────
// Private (owner only): reject an application
router.post('/:id/reject', requireLogin, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('project', 'owner');

    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Can only reject pending applications.' });
    }
    if (application.project.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only the project owner can reject applicants.' });
    }

    application.status = 'rejected';
    await application.save();
    res.json({ message: 'Application rejected.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not reject application.' });
  }
});

module.exports = router;
