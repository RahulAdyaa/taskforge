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
      // Transform populated refs to match frontend shape using raw Mongoose document fields
      obj.project = t.projectId && typeof t.projectId === 'object' && t.projectId.name
        ? { id: t.projectId._id?.toString() || t.projectId.id, name: t.projectId.name } : null;
      obj.assignee = t.assigneeId && typeof t.assigneeId === 'object' && t.assigneeId.name
        ? { id: t.assigneeId._id?.toString() || t.assigneeId.id, name: t.assigneeId.name, email: t.assigneeId.email } : null;
      obj.creator = t.creatorId && typeof t.creatorId === 'object' && t.creatorId.name
        ? { id: t.creatorId._id?.toString() || t.creatorId.id, name: t.creatorId.name, email: t.creatorId.email } : null;
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
