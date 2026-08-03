require('dotenv').config({ path: 'apps/api/.env' });
const mongoose = require('mongoose');
const Task = require('../src/models/Task');
const connectDB = require('../src/lib/database');

async function check() {
  await connectDB();
  const now = new Date();
  
  const allTasks = await Task.find({ dueDate: { $ne: null } }).select('title dueDate status deadlineNotificationStatus assigneeId creatorId').lean();
  
  console.log(`Current Time: ${now.toISOString()}`);
  console.log('Tasks with due dates:');
  for (const t of allTasks) {
    const isOverdue = t.dueDate <= now;
    const isApproaching = t.dueDate > now && t.dueDate <= new Date(now.getTime() + 15 * 60 * 1000);
    console.log(`- "${t.title}" | Due: ${t.dueDate.toISOString()} | Overdue? ${isOverdue} | Approaching? ${isApproaching} | Status: ${t.status} | Notification: ${t.deadlineNotificationStatus}`);
  }
  
  mongoose.disconnect();
}
check();
