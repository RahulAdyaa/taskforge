const express = require('express');
const prisma = require('../lib/prisma');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');

const router = express.Router({ mergeParams: true });

router.use(authenticate);
router.use(requireProjectRole(['ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const [totalTasks, tasksByStatusRaw, tasksByUserRaw, overdueTasks] = await Promise.all([
      prisma.task.count({ where: { projectId } }),
      prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ['assigneeId'],
        where: { projectId, assigneeId: { not: null } },
        _count: { id: true },
      }),
      prisma.task.count({
        where: {
          projectId,
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
        },
      }),
    ]);

    const byStatus = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };
    tasksByStatusRaw.forEach((item) => {
      byStatus[item.status] = item._count.id;
    });

    // Get user details for tasksByUser
    const userIds = tasksByUserRaw.map(t => t.assigneeId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    
    const byUser = tasksByUserRaw.map(item => {
      const user = users.find(u => u.id === item.assigneeId);
      return {
        userId: item.assigneeId,
        name: user ? user.name : 'Unknown',
        taskCount: item._count.id
      };
    });

    res.json({
      totalTasks,
      byStatus,
      byUser,
      overdue: overdueTasks,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
