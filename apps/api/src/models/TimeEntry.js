const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.taskId = ret.taskId?.toString?.() || ret.taskId;
        ret.userId = ret.userId?.toString?.() || ret.userId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.taskId = ret.taskId?.toString?.() || ret.taskId;
        ret.userId = ret.userId?.toString?.() || ret.userId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

timeEntrySchema.index({ taskId: 1, userId: 1 });
timeEntrySchema.index({ userId: 1, endTime: 1 });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
