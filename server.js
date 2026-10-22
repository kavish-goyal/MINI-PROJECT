// server.js
// Main entry point for the DevConnect backend.
// Sets up Express, connects to MongoDB, registers all routes, and serves the frontend.

require('dotenv').config(); // Load .env variables FIRST, before any other imports

const express      = require('express');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const path         = require('path');
const connectDB    = require('./config/db');

const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const projectRoutes      = require('./routes/projects');
const applicationRoutes  = require('./routes/applications');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Trust the first proxy (required for Render and other PaaS platforms) ─────
// Without this, req.ip and secure cookies don't work behind a reverse proxy.
app.set('trust proxy', 1);

// ── Parse JSON request bodies ─────────────────────────────────────────────────
app.use(express.json());

// ── Session setup ─────────────────────────────────────────────────────────────
// Sessions are stored in MongoDB (not memory) so they survive server restarts.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60, // Sessions expire after 7 days (in seconds)
    }),
    cookie: {
      httpOnly: true,  // JavaScript cannot read the cookie (XSS protection)
      sameSite: 'lax', // Protects against most CSRF attacks
      // In production (HTTPS), mark the cookie as secure
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    },
  })
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/applications', applicationRoutes);

// ── Serve static frontend files ───────────────────────────────────────────────
// All HTML, CSS, and JS files in /public are served as-is.
app.use(express.static(path.join(__dirname, 'public')));

// ── SPA fallback ──────────────────────────────────────────────────────────────
// For any route that isn't an API or file, serve index.html.
// This allows browser navigation to work correctly.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 DevConnect running at http://localhost:${PORT}`);
});
