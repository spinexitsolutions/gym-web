import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['system', 'membership', 'payment', 'booking', 'announcement', 'support', 'attendance'],
      default: 'system',
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 1000 },
    link: { type: String, maxlength: 300 },
    readAt: Date,
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }); // keep 180 days

export default mongoose.model('Notification', notificationSchema);
