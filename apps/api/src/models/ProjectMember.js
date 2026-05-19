const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER'],
      default: 'MEMBER',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString?.() || ret.userId;
        ret.projectId = ret.projectId?.toString?.() || ret.projectId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString?.() || ret.userId;
        ret.projectId = ret.projectId?.toString?.() || ret.projectId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index — replaces Prisma's @@unique([userId, projectId])
projectMemberSchema.index({ userId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('ProjectMember', projectMemberSchema);
