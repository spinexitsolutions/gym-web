import { Router } from 'express';
import { z } from 'zod';
import { Review, Trainer, Booking, Membership } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { objectId } from '../validators/common.js';
import { listTestimonials } from '../controllers/public.controller.js';
import { notifyStaff } from '../services/notification.service.js';

const r = Router();
r.get('/testimonials', h(listTestimonials));

// Public approved reviews for a trainer or the gym.
r.get('/', validate({ query: z.object({ targetType: z.enum(['gym', 'trainer']), target: objectId.optional() }) }), h(async (req, res) => {
  const filter = { status: 'approved', targetType: req.query.targetType };
  if (req.query.target) filter.target = req.query.target;
  const items = await Review.find(filter).populate('user', 'name avatar').sort('-createdAt').limit(50).lean();
  return ok(res, items.map((rv) => ({ ...rv, user: { name: rv.user?.name?.split(' ')[0] || 'Member', avatar: rv.user?.avatar } })));
}));

r.get('/me', authenticate, h(async (req, res) => ok(res, await Review.find({ user: req.user._id }).populate('target', 'name').sort('-createdAt').lean())));

const reviewSchema = z.object({
  targetType: z.enum(['gym', 'trainer']),
  target: objectId.optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

r.post('/', authenticate, validate({ body: reviewSchema }), h(async (req, res) => {
  const { targetType, target, rating, comment } = req.body;
  if (!(await Membership.exists({ user: req.user._id }))) throw ApiError.forbidden('Only members can leave reviews');
  if (targetType === 'trainer') {
    if (!target || !(await Trainer.exists({ _id: target }))) throw ApiError.badRequest('Choose a trainer');
    const trained = await Booking.exists({ member: req.user._id, trainer: target, status: 'completed' });
    if (!trained) throw ApiError.forbidden('You can review a trainer after completing a session with them');
  }
  const doc = await Review.findOneAndUpdate(
    { user: req.user._id, targetType, target: targetType === 'trainer' ? target : null },
    { rating, comment, status: 'pending', targetModel: targetType === 'trainer' ? 'Trainer' : undefined },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await notifyStaff({ type: 'system', title: 'New review to moderate', body: `${rating}★ ${targetType} review`, link: '/admin/reviews' }, ['owner', 'admin']);
  return created(res, doc, 'Thanks! Your review will appear after moderation.');
}));

export default r;
