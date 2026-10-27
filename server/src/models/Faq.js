import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 200 },
    answer: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, trim: true, maxlength: 40, default: 'general' },
    isPublished: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

faqSchema.index({ isPublished: 1, order: 1 });

export default mongoose.model('Faq', faqSchema);
