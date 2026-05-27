const mongoose = require('mongoose');
require('dotenv').config({ path: './apps/api/.env' });

async function testConnection() {
  console.log("Testing connection to:", process.env.MONGODB_URI.replace(/:([^:@]{8})[^:@]*@/, ':****@'));
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4 // Force IPv4
    });
    console.log("✅ Successfully connected to MongoDB!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  }
}

testConnection();
