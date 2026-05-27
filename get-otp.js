const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://rahuladyayt_db_user:FYFt9Fu1GkhzQtrH@taskforge.g39xxvz.mongodb.net/taskforge?retryWrites=true&w=majority&appName=TaskForge";

async function getOTP() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: "rahuladyayt@gmail.com" });
    
    if (user) {
      console.log(`User found!`);
      console.log(`resetPasswordOtp: ${user.resetPasswordOtp}`);
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
