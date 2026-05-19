const express = require('express');
const mongoose = require('mongoose');
const { Task, User } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(requireProjectRole(['ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const objectId = new mongoose.Types.ObjectId(projectId);

    const [totalTasks, tasksByStatusRaw, tasksByUserRaw, overdueTasks] = await Promise.all([
      Task.countDocuments({ projectId }),
      Task.aggregate([
        { $match: { projectId: objectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { projectId: objectId, assigneeId: { $ne: null } } },
        { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        projectId,
        dueDate: { $lt: new Date() },
        status: { $ne: 'DONE' },
      }),
    ]);

    const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    tasksByStatusRaw.forEach(item => { byStatus[item._id] = item.count; });

    // Get user details for tasksByUser
    const userIds = tasksByUserRaw.map(t => t._id);
    const users = await User.find({ _id: { $in: userIds } }).select('name');

    const byUser = tasksByUserRaw.map(item => {
      const user = users.find(u => u._id.toString() === item._id.toString());
      return {
        userId: item._id.toString(),
        name: user ? user.name : 'Unknown',
        taskCount: item.count,
      };
    });

    res.json({ totalTasks, byStatus, byUser, overdue: overdueTasks });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
