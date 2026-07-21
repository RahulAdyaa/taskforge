const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { sendDeadlineEmail } = require('./mailer');

function startScheduler(io) {
  console.log('⏰ [SCHEDULER] Starting background task deadline monitor (runs every 60s)...');
  
  // Run check every 60 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const approachingWindow = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

      // 1. Find tasks whose deadline is approaching (due in <= 15 minutes, not notified yet, status not DONE)
      const approachingTasks = await Task.find({
        dueDate: { $gt: now, $lte: approachingWindow },
        status: { $ne: 'DONE' },
        deadlineNotificationStatus: { $in: ['NONE', null] }
      }).populate('assigneeId creatorId');

      for (const task of approachingTasks) {
        // Mark as approaching notified
        task.deadlineNotificationStatus = 'APPROACHING_SENT';
        await task.save();

        const targets = [];
        if (task.assigneeId) targets.push(task.assigneeId);
        if (task.creatorId && (!task.assigneeId || task.creatorId._id.toString() !== task.assigneeId._id.toString())) {
          targets.push(task.creatorId);
        }

        console.log(`⏰ [SCHEDULER] Task "${task.title}" is approaching deadline. Notifying ${targets.length} user(s)...`);

        for (const user of targets) {
          // Create in-app notification
          const notification = await Notification.create({
            userId: user._id,
            type: 'DEADLINE_APPROACHING',
            message: `Oh, your deadline is approaching for task: ${task.title}`,
            link: `/app/projects/${task.projectId}?task=${task.id}`
          });

          // Emit real-time socket event if io is available
          if (io) {
            io.to(`user_${user._id.toString()}`).emit('notification', notification);
          }

          // Send email if user has email
          if (user.email) {
            try {
              await sendDeadlineEmail(user.email, user.name, task.title, task.dueDate, 'approaching');
            } catch (err) {
              console.error(`❌ [SCHEDULER] Failed to send approaching email to ${user.email}:`, err);
            }
          }
        }
      }

      // 2. Find tasks whose deadline has passed (due <= now, not notified of overdue yet, status not DONE)
      const overdueTasks = await Task.find({
        dueDate: { $lte: now },
        status: { $ne: 'DONE' },
        deadlineNotificationStatus: { $in: ['NONE', 'APPROACHING_SENT', null] }
      }).populate('assigneeId creatorId');

      for (const task of overdueTasks) {
        // Mark as overdue notified
        task.deadlineNotificationStatus = 'OVERDUE_SENT';
        await task.save();

        const targets = [];
        if (task.assigneeId) targets.push(task.assigneeId);
        if (task.creatorId && (!task.assigneeId || task.creatorId._id.toString() !== task.assigneeId._id.toString())) {
          targets.push(task.creatorId);
        }

        console.log(`⏰ [SCHEDULER] Task "${task.title}" has passed deadline. Notifying ${targets.length} user(s)...`);

        for (const user of targets) {
          // Create in-app notification
          const notification = await Notification.create({
            userId: user._id,
            type: 'DEADLINE_PASSED',
            message: `Deadline has passed: ${task.title}`,
            link: `/app/projects/${task.projectId}?task=${task.id}`
          });

          // Emit real-time socket event if io is available
          if (io) {
            io.to(`user_${user._id.toString()}`).emit('notification', notification);
          }

          // Send email if user has email
          if (user.email) {
            try {
              await sendDeadlineEmail(user.email, user.name, task.title, task.dueDate, 'overdue');
            } catch (err) {
              console.error(`❌ [SCHEDULER] Failed to send overdue email to ${user.email}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ [SCHEDULER] Error running deadline scheduler:', err);
    }
  }, 60000);
}

module.exports = { startScheduler };
