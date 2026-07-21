const mongoose = require('mongoose');
require('dotenv').config({ path: './apps/api/.env' });
const { User, Task, Notification } = require('../apps/api/src/models');
const { sendDeadlineEmail } = require('../apps/api/src/lib/mailer');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const now = new Date();
  console.log("Current time (now):", now.toISOString());

  // 1. Approaching
  const approachingWindow = new Date(now.getTime() + 15 * 60 * 1000);
  const approachingTasks = await Task.find({
    dueDate: { $gt: now, $lte: approachingWindow },
    status: { $ne: 'DONE' },
    deadlineNotificationStatus: { $in: ['NONE', null] }
  }).populate('assigneeId creatorId');
  console.log(`Found ${approachingTasks.length} approaching tasks.`);

  // 2. Overdue
  const overdueTasks = await Task.find({
    dueDate: { $lte: now },
    status: { $ne: 'DONE' },
    deadlineNotificationStatus: { $in: ['NONE', 'APPROACHING_SENT', null] }
  }).populate('assigneeId creatorId');
  console.log(`Found ${overdueTasks.length} overdue tasks:`, overdueTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate })));

  for (const task of overdueTasks) {
    console.log(`Processing overdue task: "${task.title}"`);
    task.deadlineNotificationStatus = 'OVERDUE_SENT';
    await task.save();

    const targets = [];
    if (task.assigneeId) targets.push(task.assigneeId);
    if (task.creatorId && (!task.assigneeId || task.creatorId._id.toString() !== task.assigneeId._id.toString())) {
      targets.push(task.creatorId);
    }

    for (const user of targets) {
      console.log(`Creating notification for ${user.email} (${user.name})...`);
      const notification = await Notification.create({
        userId: user._id,
        type: 'DEADLINE_PASSED',
        message: `Deadline has passed: ${task.title}`,
        link: `/app/projects/${task.projectId}?task=${task.id}`
      });
      console.log("Created notification ID:", notification._id);

      if (user.email) {
        console.log(`Sending email to ${user.email}...`);
        try {
          await sendDeadlineEmail(user.email, user.name, task.title, task.dueDate, 'overdue');
          console.log("Email sent successfully!");
        } catch (err) {
          console.error("Email send error:", err);
        }
      }
    }
  }

  process.exit(0);
}

test();
