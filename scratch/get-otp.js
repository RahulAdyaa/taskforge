const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = "mongodb+srv://rahuladyayt_db_user:FYFt9Fu1GkhzQtrH@taskforge.g39xxvz.mongodb.net/taskforge?retryWrites=true&w=majority&appName=TaskForge";

async function getOTP() {
  // Try to read raw OTP from scratch/last-otp.txt first
  const localOtpPath = path.join(__dirname, 'last-otp.txt');
  if (fs.existsSync(localOtpPath)) {
    try {
      const rawOtp = fs.readFileSync(localOtpPath, 'utf8').trim();
      console.log(`\n🔑 [LOCAL DEV OTP] Found raw verification code: ${rawOtp}`);
      console.log(`You can copy and paste this code to reset your password.\n`);
    } catch (err) {
      console.error('Error reading local OTP file:', err);
    }
  } else {
    console.log('\nℹ️  No local raw OTP file found (scratch/last-otp.txt). Try requesting a code in the browser first.\n');
  }

  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: "rahuladyayt@gmail.com" });
    
    if (user) {
      console.log(`Database Record:`);
      console.log(`- Email: ${user.email}`);
      console.log(`- Hashed OTP in DB: ${user.resetPasswordOtp}`);
      console.log(`- OTP Expires At: ${user.resetPasswordOtpExpires}`);
    } else {
      console.log(`User not found in DB.`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

getOTP();

