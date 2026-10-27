import { Router } from 'express';
import { z } from 'zod';
import { BlogPost } from '../models/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex } from '../utils/pagination.js';
import { slugParam } from '../validators/content.validator.js';

const r = Router();
const published = () => ({ status: 'published', publishedAt: { $lte: new Date() } });

r.get('/', validate({ query: z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(30).optional(), tag: z.string().trim().max(30).optional(), q: z.string().trim().max(100).optional() }) }), h(async (req, res) => {
  const filter = published();
  if (req.query.tag) filter.tags = req.query.tag.toLowerCase();
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }]; }
  const { items, meta } = await paginate(BlogPost, filter, parsePagination(req.query, { defaultLimit: 9, sortable: ['publishedAt'], defaultSort: '-publishedAt' }), { select: '-content', populate: { path: 'author', select: 'name' } });
  const tags = await BlogPost.distinct('tags', published());
  return ok(res, items, { meta: { ...meta, tags: tags.sort() } });
}));

r.get('/:slug', validate({ params: slugParam }), h(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, ...published() }).populate('author', 'name').lean();
  if (!post) throw ApiError.notFound('Post not found');
  const related = await BlogPost.find({ ...published(), _id: { $ne: post._id }, tags: { $in: post.tags } }).select('title slug excerpt coverImage publishedAt').sort('-publishedAt').limit(3).lean();
  return ok(res, { ...post, related });
}));

export default r;
