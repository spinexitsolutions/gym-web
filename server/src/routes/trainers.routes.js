import { Router } from 'express';
import * as pub from '../controllers/public.controller.js';
import { Trainer, MemberProfile, Membership, ProgressEntry } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { trainerListQuery, slugParam } from '../validators/content.validator.js';
import { trainerSchema } from '../validators/admin.validator.js';

const r = Router();

// Trainer self-service (defined before /:slug so "me" is not treated as a slug).
const me = Router();
me.use(authenticate, authorize('trainer'));
const myProfile = async (req) => {
  const t = await Trainer.findOne({ user: req.user._id });
  if (!t) throw ApiError.notFound('Your account is not linked to a trainer profile yet. Ask an admin to link it.');
  return t;
};
me.get('/', h(async (req, res) => ok(res, await myProfile(req))));
me.patch('/', validate({ body: trainerSchema.pick({ bio: true, availability: true, specializations: true, languages: true, sessionDurationMin: true }).partial() }), h(async (req, res) => {
  const t = await myProfile(req);
  t.set(req.body);
  await t.save();
  return ok(res, t, { message: 'Profile updated' });
}));
me.get('/members', h(async (req, res) => {
  const t = await myProfile(req);
  const profiles = await MemberProfile.find({ assignedTrainer: t._id }).populate('user', 'name email phone avatar status').lean();
  const ids = profiles.map((p) => p.user?._id).filter(Boolean);
  const now = new Date();
  const [memberships, latest] = await Promise.all([
    Membership.find({ user: { $in: ids }, status: 'active', endDate: { $gte: now } }).populate('plan', 'name').lean(),
    ProgressEntry.aggregate([{ $match: { user: { $in: ids } } }, { $sort: { date: -1 } }, { $group: { _id: '$user', last: { $first: '$$ROOT' } } }]),
  ]);
  const mByUser = Object.fromEntries(memberships.map((m) => [String(m.user), m]));
  const pByUser = Object.fromEntries(latest.map((p) => [String(p._id), p.last]));
  return ok(res, profiles.filter((p) => p.user && p.user.status === 'active').map((p) => ({
    user: p.user, fitnessGoals: p.fitnessGoals, fitnessLevel: p.fitnessLevel, medicalNotes: p.medicalNotes, heightCm: p.heightCm,
    membership: mByUser[String(p.user._id)] || null, lastProgress: pByUser[String(p.user._id)] || null,
  })));
}));
r.use('/me', me);

r.get('/', validate({ query: trainerListQuery }), h(pub.listTrainers));
r.get('/:slug', validate({ params: slugParam }), h(pub.getTrainer));

export default r;
