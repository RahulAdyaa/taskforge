require('dotenv').config({ path: 'apps/api/.env' });
const mongoose = require('mongoose');
const Task = require('../src/models/Task');
const connectDB = require('../src/lib/database');

async function check() {
  await connectDB();
  const now = new Date();
  
  const candidatesOverdue = await Task.find({
    dueDate: { $exists: true, $ne: null, $lte: now },
    status: { $ne: 'DONE' },
    deadlineNotificationStatus: { $in: ['NONE', 'APPROACHING_SENT', null] }
  }).select('_id title dueDate deadlineNotificationStatus').lean();

  console.log(`Found ${candidatesOverdue.length} overdue tasks that need notifications.`);
  console.log(candidatesOverdue);
  
  mongoose.disconnect();
}
check();
