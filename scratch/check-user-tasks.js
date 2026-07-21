const mongoose = require('mongoose');
require('dotenv').config({ path: './apps/api/.env' });
const { User, Task } = require('../apps/api/src/models');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = '6a159a97bb6684b44d0bb8f0';

  const myTasks = await Task.find({
    $or: [
      { assigneeId: userId },
      { creatorId: userId }
    ]
  }).populate('assigneeId creatorId');

  console.log(`Found ${myTasks.length} tasks associated with user ${userId}:`);
  for (const t of myTasks) {
    console.log({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      deadlineNotificationStatus: t.deadlineNotificationStatus,
      assignee: t.assigneeId ? t.assigneeId.email : 'None',
      creator: t.creatorId ? t.creatorId.email : 'None'
    });
  }

  process.exit(0);
}

test();
