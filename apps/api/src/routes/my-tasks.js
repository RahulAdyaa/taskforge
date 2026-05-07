const express = require('express');
const prisma = require('../lib/prisma');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: req.user.id
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        labels: true,
      },
      orderBy: {
        dueDate: 'asc' // or any other sensible default
      }
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
