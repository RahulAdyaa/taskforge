const mongoose = require('mongoose');

/**
 * Serverless-friendly MongoDB connection.
 * Caches the connection across Vercel function invocations
 * to avoid creating a new connection pool on every request.
 */
let isConnected = false;

const connectDB = async () => {
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
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Connection pool settings
      maxPoolSize: process.env.VERCEL ? 5 : 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // In serverless, don't exit — let the request fail gracefully
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }

  // Connection event handlers
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
    isConnected = false;
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
    isConnected = true;
  });
};

module.exports = connectDB;
