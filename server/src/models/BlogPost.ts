import { Schema, model, type InferSchemaType } from 'mongoose';

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, maxlength: 400 },
    /** Markdown. Rendered without raw HTML on the client. */
    content: { type: String, maxlength: 60000, default: '' },
    coverImage: { type: String, maxlength: 1000, default: '' },
    category: { type: String, maxlength: 40, index: true },
    tags: { type: [String], default: [], index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, maxlength: 100 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: Date,
    readingMinutes: { type: Number, default: 1 },
    seo: { title: String, description: String, image: String, noIndex: { type: Boolean, default: false } },
  },
  { timestamps: true },
);
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

export type BlogPost = InferSchemaType<typeof blogPostSchema>;
export const BlogPostModel = model('BlogPost', blogPostSchema);
