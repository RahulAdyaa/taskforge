const express = require('express');
const { Notification } = require('../models');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

// Get all notifications for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Mark a notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
