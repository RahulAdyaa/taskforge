const mongoose = require('mongoose');

/**
 * Serverless-friendly MongoDB connection with automatic retry.
 * - Caches the connection across Vercel function invocations.
 * - In local dev, retries with exponential backoff so the server
 *   never crashes due to a transient IP-whitelist or network issue.
 */
let isConnected = false;
let retryTimer = null;

const MAX_RETRIES = Infinity; // keep trying forever in dev
const INITIAL_DELAY_MS = 3000; // 3 seconds
const MAX_DELAY_MS = 60000; // cap at 60 seconds

const connectDB = async (attempt = 1) => {
  if (isConnected) {
    return;
  }

  // If already connected via mongoose state, skip
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('FATAL: MONGODB_URI is not defined in environment variables.');
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw new Error('MONGODB_URI not defined');
  }

  try {
    await mongoose.connect(uri, {
      // Connection pool settings
      maxPoolSize: process.env.VERCEL ? 5 : 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, 
    });

    isConnected = true;
    if (attempt > 1) {
      console.log(`✅ Connected to MongoDB (after ${attempt} attempts)`);
    } else {
      console.log('✅ Connected to MongoDB');
    }
  } catch (error) {
    console.error(`❌ MongoDB connection failed (attempt ${attempt}):`, error.message);

    // In serverless, don't retry — let the request fail gracefully
    if (process.env.VERCEL) {
      throw error;
    }

    // ── Retry with exponential backoff (local dev) ──────────────
    const delay = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
    console.log(`⏳ Retrying MongoDB connection in ${(delay / 1000).toFixed(0)}s...`);

    return new Promise((resolve) => {
      retryTimer = setTimeout(async () => {
        try {
          await connectDB(attempt + 1);
          resolve();
        } catch (e) {
          // retry chain continues inside connectDB
          resolve();
        }
      }, delay);
    });
  }

  // ── Connection event handlers (registered once) ─────────────
  if (mongoose.connection.listenerCount('error') === 0) {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Will auto-reconnect...');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });
  }
};

/**
 * Express middleware: returns 503 if the DB is not connected yet.
 * Attach this before your API routes so callers get a clear error
 * instead of a cryptic Mongoose crash.
 */
const requireDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'The server is starting up or reconnecting to the database. Please try again in a few seconds.',
    });
  }
  next();
};

module.exports = connectDB;
module.exports.requireDB = requireDB;
