import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    category: {
      type: String,
      enum: ['membership', 'payment', 'booking', 'facility', 'trainer', 'account', 'other'],
      default: 'other',
    },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, maxlength: 3000 },
        internal: { type: Boolean, default: false }, // staff-only note
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

supportTicketSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
