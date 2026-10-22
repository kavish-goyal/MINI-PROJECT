// scripts/seed.js
// Development-only script that inserts sample data so you can test the app
// WITHOUT manually creating users and projects.
//
// SAFE: Only inserts new documents. Never deletes existing ones.
// Run with: npm run seed
//
// WARNING: Do NOT run this in production.

require('dotenv').config();
const mongoose = require('mongoose');
const argon2   = require('argon2');
const User     = require('../models/User');
const Project  = require('../models/Project');
const connectDB = require('../config/db');

async function seed() {
  await connectDB();

  console.log('🌱 Seeding sample data…');

  // ── Create two sample users ───────────────────────────────────────────
  const hash = await argon2.hash('password123', { type: argon2.argon2id });

  let alice = await User.findOne({ email: 'alice@example.com' });
  if (!alice) {
    alice = await User.create({
      name: 'Alice Sharma', email: 'alice@example.com', passwordHash: hash,
      isVerified: true, college: 'IIT Delhi', branch: 'Computer Science',
      gradYear: 2026, bio: 'Loves building web apps and contributing to open source.',
      skills: ['React', 'Node.js', 'MongoDB'], githubUrl: 'https://github.com',
      availability: 'open',
    });
    console.log('✅ Created user: alice@example.com (password: password123)');
  }

  let bob = await User.findOne({ email: 'bob@example.com' });
  if (!bob) {
    bob = await User.create({
      name: 'Bob Kumar', email: 'bob@example.com', passwordHash: hash,
      isVerified: true, college: 'NIT Warangal', branch: 'Electronics',
      gradYear: 2025, bio: 'ML enthusiast and Python developer.',
      skills: ['Python', 'TensorFlow', 'SQL'], availability: 'open',
    });
    console.log('✅ Created user: bob@example.com (password: password123)');
  }

  // ── Create sample projects ────────────────────────────────────────────
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 3);

  const projectCount = await Project.countDocuments({ owner: alice._id });
  if (projectCount === 0) {
    await Project.create({
      title:          'Campus Lost & Found App',
      description:    'A mobile-friendly web app where students can report lost items and browse found items on campus. Features photo uploads, category filters, and real-time notifications.',
      category:       'Web',
      requiredSkills: ['React', 'Node.js', 'MongoDB'],
      totalPositions: 3,
      deadline:       futureDate,
      owner:          alice._id,
      status:         'open',
    });
    console.log('✅ Created project: Campus Lost & Found App (owner: Alice)');
  }

  const projectCount2 = await Project.countDocuments({ owner: bob._id });
  if (projectCount2 === 0) {
    await Project.create({
      title:          'Exam Score Predictor',
      description:    'A machine learning model that predicts a student\'s exam scores based on study habits, attendance, and past performance. Includes a simple web dashboard.',
      category:       'AI/ML',
      requiredSkills: ['Python', 'TensorFlow', 'React'],
      totalPositions: 4,
      deadline:       futureDate,
      owner:          bob._id,
      status:         'open',
    });
    console.log('✅ Created project: Exam Score Predictor (owner: Bob)');
  }

  const hackathonCount = await Project.countDocuments({ isHackathon: true });
  if (hackathonCount === 0 && alice) {
    await Project.create({
      title:          'Smart India Hackathon 2026 - AI Civic Grievance System',
      description:    'Forming a squad for Smart India Hackathon. We are building an automated civic issue reporting and geo-tagging tool with computer vision and real-time municipal routing.',
      category:       'AI/ML',
      requiredSkills: ['Python', 'FastAPI', 'React', 'PyTorch'],
      totalPositions: 4,
      deadline:       futureDate,
      owner:          alice._id,
      status:         'open',
      college:        'IIT Delhi',
      isHackathon:    true,
      hackathonName:  'Smart India Hackathon 2026',
      hackathonUrl:   'https://sih.gov.in',
      rolesNeeded:    ['UI/UX Designer', 'AI/ML Engineer', 'Backend Dev'],
    });
    console.log('✅ Created sample hackathon squad: Smart India Hackathon 2026 (owner: Alice)');
  }

  console.log('\n🎉 Seed complete!');
  console.log('   Login at http://localhost:3000/login.html');
  console.log('   alice@example.com / password123');
  console.log('   bob@example.com   / password123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
