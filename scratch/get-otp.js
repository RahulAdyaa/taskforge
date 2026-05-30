const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = "mongodb+srv://rahuladyayt_db_user:FYFt9Fu1GkhzQtrH@taskforge.g39xxvz.mongodb.net/taskforge?retryWrites=true&w=majority&appName=TaskForge";

async function getOTP() {
  const targetEmail = process.argv[2] ? process.argv[2].toLowerCase().trim() : null;

  // 1. Try local file fallback (only if no specific email requested or if target email matches the local user)
  if (!targetEmail || targetEmail === 'rahuladyayt@gmail.com') {
    const localOtpPath = path.join(__dirname, 'last-otp.txt');
    if (fs.existsSync(localOtpPath)) {
      try {
        const rawOtp = fs.readFileSync(localOtpPath, 'utf8').trim();
        console.log(`\n🔑 [LOCAL DEV OTP] Found raw verification code: ${rawOtp}`);
        console.log(`You can copy and paste this code to reset your password.\n`);
      } catch (err) {
        console.error('Error reading local OTP file:', err);
      }
    }
  }

  // 2. Connect to MongoDB and fetch details
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    if (targetEmail) {
      // Find a specific user's OTP
      const user = await db.collection('users').findOne({ email: targetEmail });
      if (user) {
        console.log(`\nDatabase Record for ${targetEmail}:`);
        console.log(`- Email: ${user.email}`);
        if (user.resetPasswordOtpRaw) {
          console.log(`- 🔑 Raw OTP Code: ${user.resetPasswordOtpRaw} (Use this to reset!)`);
        } else {
          console.log(`- 🔑 Raw OTP Code: (None found - it may have expired, been verified, or never generated)`);
        }
        console.log(`- Hashed OTP in DB: ${user.resetPasswordOtp || 'None'}`);
        console.log(`- OTP Expires At: ${user.resetPasswordOtpExpires || 'None'}`);
      } else {
        console.log(`\n❌ User with email "${targetEmail}" was not found in the database.`);
      }
    } else {
      // List all users with active (non-expired) OTPs
      const activeUsers = await db.collection('users').find({
        resetPasswordOtp: { $ne: null },
        resetPasswordOtpExpires: { $gt: new Date() }
      }).toArray();

      if (activeUsers.length > 0) {
        console.log(`\n⚡ Active Password Reset OTPs found in the Cloud DB:`);
        activeUsers.forEach(u => {
          console.log(`--------------------------------------------------`);
          console.log(`- User Email: ${u.email}`);
          console.log(`- 🔑 Raw OTP Code: ${u.resetPasswordOtpRaw || 'Unknown'}`);
          console.log(`- Expires At: ${u.resetPasswordOtpExpires}`);
        });
        console.log(`--------------------------------------------------\n`);
      } else {
        console.log(`\nℹ️  No active, non-expired OTPs found in the Cloud DB.`);
        console.log(`To request one, click "Reset Password" in your Vercel/Local application.`);
        console.log(`Or lookup a specific user: npm run get-otp [user-email]\n`);
      }
    }
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await mongoose.disconnect();
  }
}

getOTP();


