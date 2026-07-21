const mongoose = require('mongoose');
require('dotenv').config({ path: './apps/api/.env' });
const { User, Task } = require('../apps/api/src/models');
const { sendDeadlineEmail } = require('../apps/api/src/lib/mailer');

async function test() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");

  const userId = '6a159a97bb6684b44d0bb8f0';
  const user = await User.findById(userId);
  console.log("User details:", {
    id: user._id,
    name: user.name,
    email: user.email
  });

  // Let's check some tasks
  const overdueTasks = await Task.find({
    status: { $ne: 'DONE' }
  }).populate('assigneeId creatorId').limit(5);

  console.log("Found active tasks:", overdueTasks.map(t => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    deadlineNotificationStatus: t.deadlineNotificationStatus,
    assigneeEmail: t.assigneeId?.email,
    creatorEmail: t.creatorId?.email
  })));

  // Test sending a test deadline email
  if (user.email) {
    console.log(`Sending test email to ${user.email}...`);
    try {
      const res = await sendDeadlineEmail(user.email, user.name, "Test scheduler Task", new Date(), 'overdue');
      console.log("Email sent successfully!", res);
    } catch (err) {
      console.error("Email sending failed:", err);
    }
  }

  process.exit(0);
}

test();
