const express = require('express');
const { Task } = require('../models');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({ assigneeId: req.user.id })
      .populate('projectId', 'name')
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('labels')
      .sort({ dueDate: 1 });

    const result = tasks.map(t => {
      const obj = t.toJSON();
      // Transform populated refs to match frontend shape
      obj.project = obj.projectId && typeof obj.projectId === 'object'
        ? { id: obj.projectId.id, name: obj.projectId.name } : null;
      obj.assignee = obj.assigneeId && typeof obj.assigneeId === 'object'
        ? { id: obj.assigneeId.id, name: obj.assigneeId.name, email: obj.assigneeId.email } : null;
      obj.creator = obj.creatorId && typeof obj.creatorId === 'object'
        ? { id: obj.creatorId.id, name: obj.creatorId.name, email: obj.creatorId.email } : null;
      obj.projectId = t.projectId?._id?.toString() || t.projectId?.toString();
      obj.assigneeId = t.assigneeId?._id?.toString() || t.assigneeId?.toString() || null;
      obj.creatorId = t.creatorId?._id?.toString() || t.creatorId?.toString();
      return obj;
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
