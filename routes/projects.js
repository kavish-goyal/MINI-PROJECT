// routes/projects.js
// Handles: list, search, get one, create, update, close projects.
//
// ROUTE ORDER NOTE: Specific string routes (/mine/list) must come
// BEFORE wildcard routes (/:id), otherwise Express treats the string as an ID.

const express = require('express');
const Project = require('../models/Project');
const User    = require('../models/User');
const Application = require('../models/Application');
const { requireLogin, requireVerified } = require('../middleware/auth');
const { pickAllowed } = require('../middleware/validate');

const router = express.Router();

// Fields allowed when creating or editing a project
const ALLOWED_PROJECT_FIELDS = [
  'title', 'description', 'category', 'requiredSkills', 'totalPositions', 'deadline',
  'isHackathon', 'hackathonName', 'hackathonUrl', 'rolesNeeded', 'college',
];

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ── GET /api/projects ─────────────────────────────────────────────────────────
// Public: list open projects with search, category, skill, hackathon, and college filtering
router.get('/', async (req, res) => {
  try {
    const { search, category, skill, college, sameCollege, isHackathon, page = 1, limit = 12 } = req.query;

    const filter = { status: 'open' }; // Show only open projects by default

    // Full-text search on title and description
    if (search) {
      filter.$text = { $search: search };
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by a required skill (case-insensitive)
    if (skill) {
      filter.requiredSkills = { $regex: new RegExp(escapeRegex(skill), 'i') };
    }

    // Hackathon team filter
    if (isHackathon === 'true') {
      filter.isHackathon = true;
    } else if (isHackathon === 'false') {
      filter.isHackathon = { $ne: true };
    }

    // College filtering: explicit college or "Same College as Mine"
    let targetCollege = college ? college.trim() : null;
    let currentUserCollege = null;

    if (req.session?.userId) {
      const currentUser = await User.findById(req.session.userId).select('college');
      if (currentUser?.college) {
        currentUserCollege = currentUser.college;
      }
    }

    if (sameCollege === 'true') {
      if (!req.session?.userId) {
        return res.status(401).json({ error: 'Please log in to filter by your college.' });
      }
      if (!currentUserCollege) {
        return res.status(400).json({
          error: 'Please set your college in your profile first to use same-college filtering.',
          noUserCollege: true,
        });
      }
      targetCollege = currentUserCollege;
    }

    if (targetCollege) {
      const escapedCollege = escapeRegex(targetCollege);
      const matchingOwners = await User.find({
        college: { $regex: new RegExp(escapedCollege, 'i') },
      }).select('_id');
      const ownerIds = matchingOwners.map(u => u._id);

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { college: { $regex: new RegExp(escapedCollege, 'i') } },
          { owner: { $in: ownerIds } },
        ],
      });
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .populate('owner', 'name college branch') // Embed owner name, college, branch
      .sort({ createdAt: -1 })                  // Newest first
      .skip(skip)
      .limit(Number(limit));

    res.json({
      projects,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      currentUserCollege,
      activeCollegeFilter: targetCollege,
    });
  } catch (err) {
    console.error('List projects error:', err.message);
    res.status(500).json({ error: 'Could not fetch projects.' });
  }
});

// ── GET /api/projects/mine/list ───────────────────────────────────────────────
// Private: get projects owned by the logged-in user (for dashboard)
// MUST come before /:id so "mine" is not treated as an ObjectId
router.get('/mine/list', requireLogin, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.session.userId }).sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch your projects.' });
  }
});

// ── GET /api/projects/user/:userId ───────────────────────────────────────────
// Public: get projects and hackathon squads owned or joined by a specific user (for profile)
// MUST come before /:id so "user" is not treated as an ObjectId
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [ownedProjects, memberProjects] = await Promise.all([
      Project.find({ owner: userId })
        .populate('owner', 'name college branch')
        .populate('acceptedMembers', 'name college branch')
        .sort({ createdAt: -1 }),
      Project.find({ acceptedMembers: userId, owner: { $ne: userId } })
        .populate('owner', 'name college branch')
        .populate('acceptedMembers', 'name college branch')
        .sort({ createdAt: -1 })
    ]);
    res.json({ ownedProjects, memberProjects });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch user projects.' });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
// Public: get a single project's details
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name college branch')
      .populate('acceptedMembers', 'name college branch skills');

    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch project.' });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
// Private (verified users only): create a new project
router.post('/', requireLogin, requireVerified, async (req, res) => {
  try {
    const fields = pickAllowed(req.body, ALLOWED_PROJECT_FIELDS);

    // Basic validation
    if (!fields.title || !fields.description || !fields.category || !fields.deadline) {
      return res.status(400).json({ error: 'Title, description, category, and deadline are required.' });
    }
    if (!fields.totalPositions || Number(fields.totalPositions) < 1) {
      return res.status(400).json({ error: 'Total positions must be at least 1.' });
    }

    // Deadline must be in the future
    if (new Date(fields.deadline) <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be in the future.' });
    }

    // The owner is taken from the session – never from the request body
    const ownerUser = await User.findById(req.session.userId).select('college');
    if (!fields.college && ownerUser?.college) {
      fields.college = ownerUser.college;
    }

    if (fields.rolesNeeded) {
      if (typeof fields.rolesNeeded === 'string') {
        try { fields.rolesNeeded = JSON.parse(fields.rolesNeeded); }
        catch { fields.rolesNeeded = fields.rolesNeeded.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (Array.isArray(fields.rolesNeeded)) {
        fields.rolesNeeded = fields.rolesNeeded.map(r => String(r).trim()).filter(Boolean);
      }
    }

    fields.isHackathon = Boolean(fields.isHackathon === true || fields.isHackathon === 'true');

    const project = await Project.create({
      ...fields,
      totalPositions: Number(fields.totalPositions),
      owner: req.session.userId,
    });

    res.status(201).json({ message: 'Project created!', project });
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).json({ error: 'Could not create project.' });
  }
});

// ── PUT /api/projects/:id ─────────────────────────────────────────────────────
// Private: only the project owner can update their project
router.put('/:id', requireLogin, requireVerified, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Check ownership — compare as strings since one is ObjectId
    if (project.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only the project owner can edit this project.' });
    }

    const updates = pickAllowed(req.body, ALLOWED_PROJECT_FIELDS);

    if (updates.totalPositions) {
      updates.totalPositions = Number(updates.totalPositions);
      // Don't allow shrinking below already accepted members
      if (updates.totalPositions < project.acceptedMembers.length) {
        return res.status(400).json({ error: 'Total positions cannot be less than already accepted members.' });
      }
    }
    if (updates.deadline && new Date(updates.deadline) <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be in the future.' });
    }

    if ('rolesNeeded' in updates) {
      if (typeof updates.rolesNeeded === 'string') {
        try { updates.rolesNeeded = JSON.parse(updates.rolesNeeded); }
        catch { updates.rolesNeeded = updates.rolesNeeded.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (Array.isArray(updates.rolesNeeded)) {
        updates.rolesNeeded = updates.rolesNeeded.map(r => String(r).trim()).filter(Boolean);
      }
    }

    if ('isHackathon' in updates) {
      updates.isHackathon = Boolean(updates.isHackathon === true || updates.isHackathon === 'true');
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ message: 'Project updated!', project: updated });
  } catch (err) {
    console.error('Update project error:', err.message);
    res.status(500).json({ error: 'Could not update project.' });
  }
});

// ── POST /api/projects/:id/close ──────────────────────────────────────────────
// Private: owner closes a project (no more applications accepted)
router.post('/:id/close', requireLogin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (project.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only the project owner can close this project.' });
    }

    project.status = 'closed';
    await project.save();
    res.json({ message: 'Project closed.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not close project.' });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────
// Private: owner permanently deletes their project/hackathon posting
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (project.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only the project owner can delete this post.' });
    }

    // Cascade delete any applications submitted to this project
    await Application.deleteMany({ project: req.params.id });

    // Delete the project document
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err.message);
    res.status(500).json({ error: 'Could not delete project.' });
  }
});

module.exports = router;
