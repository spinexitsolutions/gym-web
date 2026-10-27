import mongoose from 'mongoose';

const contactInquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    subject: { type: String, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    interest: { type: String, trim: true, maxlength: 60 }, // 'membership', 'personal_training', 'trial'...
    source: { type: String, enum: ['contact_page', 'homepage', 'membership_page', 'other'], default: 'contact_page' },
    status: { type: String, enum: ['new', 'in_progress', 'resolved', 'spam'], default: 'new', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: [
      {
        _id: false,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, maxlength: 1000 },
        at: { type: Date, default: Date.now },
      },
    ],
    ipHash: { type: String, select: false }, // hashed for abuse throttling, never the raw IP
  },
  { timestamps: true },
);

contactInquirySchema.index({ createdAt: -1 });

export default mongoose.model('ContactInquiry', contactInquirySchema);
