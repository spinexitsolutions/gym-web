import { Router } from 'express';
import { z } from 'zod';
import { mediaUrl, slugSchema } from '@apex/shared';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BlogPostModel } from '../models';
import { audit } from '../services/audit.service';
import { bumpContentVersion } from '../services/cms.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';

const r = Router();

const publicFields = 'title slug excerpt coverImage category tags authorName publishedAt readingMinutes';

r.get(
  '/',
  validate({ query: listQuery.extend({ category: z.string().trim().max(40).optional(), tag: z.string().trim().max(40).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, q, category, tag } = res.locals.query;
    const filter: Record<string, unknown> = { status: 'published', publishedAt: { $lte: new Date() } };
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
    const [items, total, categories] = await Promise.all([
      BlogPostModel.find(filter).select(publicFields).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BlogPostModel.countDocuments(filter),
      BlogPostModel.distinct('category', { status: 'published' }),
    ]);
    ok(res, items, { ...pageMeta(page, limit, total), categories: categories.filter(Boolean) });
  }),
);

r.get(
  '/post/:slug',
  asyncHandler(async (req, res) => {
    const post = await BlogPostModel.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } }).select(`${publicFields} content seo`).lean();
    if (!post) throw AppError.notFound('Article');
    ok(res, post);
  }),
);

const postBody = z.object({
  title: z.string().trim().min(3).max(160),
  slug: slugSchema,
  excerpt: z.string().trim().max(400).default(''),
  content: z.string().max(60000).default(''),
  coverImage: mediaUrl.default(''),
  category: z.string().trim().max(40).default('training'),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(12).default([]),
  authorName: z.string().trim().max(100).default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  publishedAt: z.coerce.date().optional().nullable(),
  seo: z.object({ title: z.string().trim().max(70).default(''), description: z.string().trim().max(170).default(''), image: mediaUrl.default(''), noIndex: z.boolean().default(false) }).default({}),
});

const readingMinutes = (s: string) => Math.max(1, Math.round(s.split(/\s+/).filter(Boolean).length / 220));

const admin = Router();
admin.use(requireAuth, requirePermission('cms:write'));
admin.get(
  '/',
  validate({ query: listQuery.extend({ status: z.enum(['draft', 'published']).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, q, status } = res.locals.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
    const [items, total] = await Promise.all([BlogPostModel.find(filter).select('-content').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), BlogPostModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);
admin.get('/:id', asyncHandler(async (req, res) => {
  const p = await BlogPostModel.findById(req.params.id).lean();
  if (!p) throw AppError.notFound('Post');
  ok(res, p);
}));
admin.post(
  '/',
  validate({ body: postBody }),
  asyncHandler(async (req, res) => {
    const p = await BlogPostModel.create({ ...req.body, author: req.user!.id, authorName: req.body.authorName || req.user!.name, readingMinutes: readingMinutes(req.body.content), publishedAt: req.body.status === 'published' ? req.body.publishedAt ?? new Date() : req.body.publishedAt });
    bumpContentVersion();
    await audit(req, { action: 'blog.create', entity: 'BlogPost', entityId: p._id, summary: p.title });
    created(res, p);
  }),
);
admin.put(
  '/:id',
  validate({ body: postBody }),
  asyncHandler(async (req, res) => {
    const existing = await BlogPostModel.findById(req.params.id);
    if (!existing) throw AppError.notFound('Post');
    Object.assign(existing, { ...req.body, readingMinutes: readingMinutes(req.body.content), publishedAt: req.body.status === 'published' ? req.body.publishedAt ?? existing.publishedAt ?? new Date() : req.body.publishedAt });
    await existing.save();
    bumpContentVersion();
    await audit(req, { action: 'blog.update', entity: 'BlogPost', entityId: existing._id, summary: existing.title });
    ok(res, existing);
  }),
);
admin.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await BlogPostModel.findByIdAndDelete(req.params.id);
    if (!p) throw AppError.notFound('Post');
    bumpContentVersion();
    await audit(req, { action: 'blog.delete', entity: 'BlogPost', entityId: p._id, summary: p.title });
    ok(res, { deleted: true });
  }),
);
r.use('/admin', admin);
export default r;
