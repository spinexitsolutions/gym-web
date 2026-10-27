import mongoose from 'mongoose';
import { imageSchema, PUBLISH_STATUS } from './_shared.js';

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    excerpt: { type: String, trim: true, maxlength: 300 },
    content: { type: String, maxlength: 50000 }, // Markdown
    coverImage: imageSchema,
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: PUBLISH_STATUS, default: 'draft' },
    publishedAt: Date,
    seo: { title: String, description: String },
  },
  { timestamps: true },
);

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });

export default mongoose.model('BlogPost', blogPostSchema);
