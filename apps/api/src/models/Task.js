const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'DONE'],
      default: 'TODO',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    labels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Label',
      },
    ],
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
  },
  {
    timestamps: true, // createdAt + updatedAt
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId?.toString?.() || ret.projectId;
        ret.assigneeId = ret.assigneeId?.toString?.() || ret.assigneeId;
        ret.creatorId = ret.creatorId?.toString?.() || ret.creatorId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId?.toString?.() || ret.projectId;
        ret.assigneeId = ret.assigneeId?.toString?.() || ret.assigneeId;
        ret.creatorId = ret.creatorId?.toString?.() || ret.creatorId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for common queries
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assigneeId: 1 });
taskSchema.index({ creatorId: 1 });

module.exports = mongoose.model('Task', taskSchema);
