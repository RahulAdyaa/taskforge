const mongoose = require('mongoose');

const labelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    color: {
      type: String,
      default: '#E8E4DD',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
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
        ret.projectId = ret.projectId?.toString?.() || ret.projectId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index — replaces Prisma's @@unique([name, projectId])
labelSchema.index({ name: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('Label', labelSchema);
