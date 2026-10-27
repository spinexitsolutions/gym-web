import mongoose from 'mongoose';

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    unsubscribeTokenHash: { type: String, select: false },
    source: { type: String, maxlength: 40 },
  },
  { timestamps: true },
);

export default mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
