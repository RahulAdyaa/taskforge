const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { sendDeadlineEmail } = require('./mailer');

let schedulerInterval = null;
let isRunning = false;

async function checkDeadlines(io) {
  if (isRunning) {
    console.log('⏰ [SCHEDULER] Previous check still in progress. Skipping overlapping execution.');
    return;
  }

  isRunning = true;

  try {
    const now = new Date();
    const approachingWindow = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

    const notificationsToInsert = [];
    const createdNotificationPayloads = [];

    // 1. Find tasks whose deadline is approaching (due in <= 15 minutes, not notified yet, status not DONE)
    const candidatesApproaching = await Task.find({
      dueDate: { $exists: true, $ne: null, $gt: now, $lte: approachingWindow },
      status: { $ne: 'DONE' },
      deadlineNotificationStatus: { $in: ['NONE', null] }
    }).select('_id deadlineNotificationStatus').lean();

    for (const candidate of candidatesApproaching) {
      // Atomic claim to handle multiple backend instances/clusters safely
      const task = await Task.findOneAndUpdate(
        {
          _id: candidate._id,
          deadlineNotificationStatus: candidate.deadlineNotificationStatus
        },
        { $set: { deadlineNotificationStatus: 'APPROACHING_SENT' } },
        { new: true }
      )
        .populate('assigneeId', '_id name email')
        .populate('creatorId', '_id name email');

      if (!task) continue; // Already claimed by another execution instance

      const targets = [];
      if (task.assigneeId && task.assigneeId.email) targets.push(task.assigneeId);
      if (
        task.creatorId &&
        task.creatorId.email &&
        (!task.assigneeId || (task.creatorId._id || task.creatorId.id)?.toString() !== (task.assigneeId._id || task.assigneeId.id)?.toString())
      ) {
        targets.push(task.creatorId);
      }

      console.log(`⏰ [SCHEDULER] Task "${task.title}" is due in less than 15 minutes. Notifying ${targets.length} user(s)...`);

      for (const user of targets) {
        const userId = user._id || user.id;
        const msg = `Task "${task.title}" is due in less than 15 minutes.`;

        notificationsToInsert.push({
          userId,
          type: 'DEADLINE_APPROACHING',
          message: msg,
          link: `/app/projects/${task.projectId}?task=${task.id}`
        });

        if (user.email) {
          sendDeadlineEmail(user.email, user.name, task.title, task.dueDate, 'approaching')
            .catch(err => console.error(`❌ [SCHEDULER] Failed to send approaching email to ${user.email}:`, err));
        }
      }
    }

    // 2. Find tasks whose deadline has passed (due <= now, not notified of overdue yet, status not DONE)
    const candidatesOverdue = await Task.find({
      dueDate: { $exists: true, $ne: null, $lte: now },
      status: { $ne: 'DONE' },
      deadlineNotificationStatus: { $in: ['NONE', 'APPROACHING_SENT', null] }
    }).select('_id deadlineNotificationStatus').lean();

    for (const candidate of candidatesOverdue) {
      // Atomic claim to handle multiple backend instances/clusters safely
      const task = await Task.findOneAndUpdate(
        {
          _id: candidate._id,
          deadlineNotificationStatus: candidate.deadlineNotificationStatus
        },
        { $set: { deadlineNotificationStatus: 'OVERDUE_SENT' } },
        { new: true }
      )
        .populate('assigneeId', '_id name email')
        .populate('creatorId', '_id name email');

      if (!task) continue; // Already claimed by another execution instance

      const targets = [];
      if (task.assigneeId && task.assigneeId.email) targets.push(task.assigneeId);
      if (
        task.creatorId &&
        task.creatorId.email &&
        (!task.assigneeId || (task.creatorId._id || task.creatorId.id)?.toString() !== (task.assigneeId._id || task.assigneeId.id)?.toString())
      ) {
        targets.push(task.creatorId);
      }

      console.log(`⏰ [SCHEDULER] Task "${task.title}" deadline has passed. Notifying ${targets.length} user(s)...`);

      for (const user of targets) {
        const userId = user._id || user.id;
        const msg = `Task "${task.title}" deadline has passed.`;

        notificationsToInsert.push({
          userId,
          type: 'DEADLINE_PASSED',
          message: msg,
          link: `/app/projects/${task.projectId}?task=${task.id}`
        });

        if (user.email) {
          sendDeadlineEmail(user.email, user.name, task.title, task.dueDate, 'overdue')
            .catch(err => console.error(`❌ [SCHEDULER] Failed to send overdue email to ${user.email}:`, err));
        }
      }
    }

    // Batch insert in-app notifications
    if (notificationsToInsert.length > 0) {
      const insertedDocs = await Notification.insertMany(notificationsToInsert);
      if (io) {
        for (const doc of insertedDocs) {
          io.to(`user_${doc.userId.toString()}`).emit('notification', doc);
        }
      }
    }
  } catch (err) {
    console.error('❌ [SCHEDULER] Error running deadline scheduler:', err);
  } finally {
    isRunning = false;
  }
}

function startScheduler(io) {
  console.log('⏰ [SCHEDULER] Starting background task deadline monitor (runs every 30s)...');

  // Run initial check immediately on boot
  checkDeadlines(io);

  // Store interval reference for graceful shutdown
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  schedulerInterval = setInterval(() => checkDeadlines(io), 30000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 [SCHEDULER] Stopped background task deadline monitor.');
  }
}

module.exports = { startScheduler, stopScheduler };
