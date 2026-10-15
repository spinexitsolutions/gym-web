import { Schema, model, type InferSchemaType } from 'mongoose';

const deliverySchema = new Schema(
  {
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    error: { type: String, maxlength: 500 },
    attempts: { type: Number, default: 1 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['membership', 'payment', 'booking', 'class', 'workout', 'support', 'system', 'promotion'],
      default: 'system',
    },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 1000 },
    link: { type: String, maxlength: 300 },
    readAt: Date,
    /** Prevents duplicate notifications for the same event (e.g. `expiry:<membershipId>:7`). */
    dedupeKey: { type: String },
    deliveries: { type: [deliverySchema], default: [] },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export type Notification = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = model('Notification', notificationSchema);
