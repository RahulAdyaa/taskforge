require('dotenv').config({ path: 'apps/api/.env' });
const connectDB = require('../src/lib/database');
const Task = require('../src/models/Task');
const User = require('../src/models/User');

async function check() {
  await connectDB();
  const tasks = await Task.find().sort({ createdAt: -1 }).limit(10).populate('assigneeId').populate('creatorId').lean();
  
  console.log('Recent 10 Tasks:');
  tasks.forEach(t => {
    console.log(`Task: "${t.title}"`);
    console.log(` - DueDate: ${t.dueDate}`);
    console.log(` - NotificationStatus: ${t.deadlineNotificationStatus}`);
    console.log(` - Assignee: ${t.assigneeId ? `${t.assigneeId.name} <${t.assigneeId.email}>` : 'None'}`);
    console.log(` - Creator: ${t.creatorId ? `${t.creatorId.name} <${t.creatorId.email}>` : 'None'}`);
    console.log('---');
  });
  process.exit(0);
}
check();
