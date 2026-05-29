const express = require('express');
const { Task, TimeEntry } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(requireProjectRole(['ADMIN', 'MEMBER']));

// GET all time entries for a task
router.get('/', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const entries = await TimeEntry.find({ taskId })
      .populate('userId', 'name email')
      .sort({ startTime: -1 });

    let totalSeconds = 0;
    const result = entries.map(e => {
      if (e.endTime) {
        totalSeconds += Math.floor((new Date(e.endTime) - new Date(e.startTime)) / 1000);
      }
      const obj = e.toJSON();
      obj.user = { id: e.userId._id.toString(), name: e.userId.name, email: e.userId.email };
      obj.userId = e.userId._id.toString();
      return obj;
    });

    const activeEntry = result.find(e => !e.endTime && e.userId === req.user.id) || null;

    res.json({ entries: result, totalSeconds, activeEntry });
  } catch (error) {
    next(error);
  }
});

// POST start timer
router.post('/start', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user already has a running timer on ANY task in this project
    const existingActive = await TimeEntry.findOne({
      userId: req.user.id,
      endTime: null,
    }).populate('taskId', 'title projectId');

    if (existingActive) {
      const activeProjectTask = existingActive.taskId;
      if (activeProjectTask && activeProjectTask.projectId.toString() === projectId) {
        return res.status(400).json({
          error: `You already have a running timer on "${activeProjectTask.title}". Stop it first.`,
          activeTaskId: activeProjectTask._id.toString(),
        });
      }
    }

    const entry = await TimeEntry.create({ taskId, userId: req.user.id });
    const populated = await TimeEntry.findById(entry.id).populate('userId', 'name email');
    const obj = populated.toJSON();
    obj.user = { id: populated.userId._id.toString(), name: populated.userId.name, email: populated.userId.email };
    obj.userId = populated.userId._id.toString();

    req.emitEvent(`project_${projectId}`, 'timer_started', {
      taskId, userId: req.user.id, entryId: entry.id,
    });

    res.status(201).json(obj);
  } catch (error) {
    next(error);
  }
});

// POST stop timer
router.post('/stop', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const activeEntry = await TimeEntry.findOne({
      taskId, userId: req.user.id, endTime: null,
    });

    if (!activeEntry) {
      return res.status(400).json({ error: 'No active timer found for this task.' });
    }

    const updated = await TimeEntry.findByIdAndUpdate(
      activeEntry.id,
      { endTime: new Date() },
      { new: true }
    ).populate('userId', 'name email');

    const obj = updated.toJSON();
    obj.user = { id: updated.userId._id.toString(), name: updated.userId.name, email: updated.userId.email };
    obj.userId = updated.userId._id.toString();

    req.emitEvent(`project_${projectId}`, 'timer_stopped', {
      taskId, userId: req.user.id, entryId: updated.id,
      duration: Math.floor((new Date(updated.endTime) - new Date(updated.startTime)) / 1000),
    });

    res.json(obj);
  } catch (error) {
    next(error);
  }
});

// GET summary
router.get('/summary', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const entries = await TimeEntry.find({ taskId, endTime: { $ne: null } })
      .populate('userId', 'name');

    const byUser = {};
    entries.forEach(entry => {
      const seconds = Math.floor((new Date(entry.endTime) - new Date(entry.startTime)) / 1000);
      const uid = entry.userId._id.toString();
      if (!byUser[uid]) {
        byUser[uid] = { user: { id: uid, name: entry.userId.name }, totalSeconds: 0, sessionCount: 0 };
      }
      byUser[uid].totalSeconds += seconds;
      byUser[uid].sessionCount += 1;
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
