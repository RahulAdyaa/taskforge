const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

router.use(authenticate);
router.use(requireProjectRole(['ADMIN', 'MEMBER']));

// GET all time entries for a task
router.get('/', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const entries = await prisma.timeEntry.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    // Calculate total tracked time in seconds
    let totalSeconds = 0;
    entries.forEach(entry => {
      if (entry.endTime) {
        totalSeconds += Math.floor((new Date(entry.endTime) - new Date(entry.startTime)) / 1000);
      }
    });

    // Find active timer for current user
    const activeEntry = entries.find(e => !e.endTime && e.userId === req.user.id);

    res.json({
      entries,
      totalSeconds,
      activeEntry: activeEntry || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST start timer
router.post('/start', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user already has a running timer on ANY task in this project
    const existingActive = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user.id,
        endTime: null,
        task: { projectId },
      },
      include: { task: { select: { id: true, title: true } } },
    });

    if (existingActive) {
      return res.status(400).json({
        error: `You already have a running timer on "${existingActive.task.title}". Stop it first.`,
        activeTaskId: existingActive.task.id,
      });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        taskId,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    req.io.to(`project_${projectId}`).emit('timer_started', {
      taskId,
      userId: req.user.id,
      entryId: entry.id,
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// POST stop timer
router.post('/stop', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;

    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        taskId,
        userId: req.user.id,
        endTime: null,
      },
    });

    if (!activeEntry) {
      return res.status(400).json({ error: 'No active timer found for this task.' });
    }

    const updated = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: { endTime: new Date() },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    req.io.to(`project_${projectId}`).emit('timer_stopped', {
      taskId,
      userId: req.user.id,
      entryId: updated.id,
      duration: Math.floor((new Date(updated.endTime) - new Date(updated.startTime)) / 1000),
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// GET summary of time tracked per user on a task
router.get('/summary', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const entries = await prisma.timeEntry.findMany({
      where: { taskId, endTime: { not: null } },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Group by user
    const byUser = {};
    entries.forEach(entry => {
      const seconds = Math.floor((new Date(entry.endTime) - new Date(entry.startTime)) / 1000);
      if (!byUser[entry.userId]) {
        byUser[entry.userId] = {
          user: entry.user,
          totalSeconds: 0,
          sessionCount: 0,
        };
      }
      byUser[entry.userId].totalSeconds += seconds;
      byUser[entry.userId].sessionCount += 1;
    });

    res.json({
      taskId,
      totalSessions: entries.length,
      totalSeconds: Object.values(byUser).reduce((sum, u) => sum + u.totalSeconds, 0),
      byUser: Object.values(byUser),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
