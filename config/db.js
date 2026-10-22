// config/db.js
// Connects to MongoDB Atlas using the URI from .env
// We export a simple async function so server.js calls it once at startup.

const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1); // Stop the server if DB is unavailable
  }
}

module.exports = connectDB;
