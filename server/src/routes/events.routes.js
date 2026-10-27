import { Router } from 'express';
import { Challenge, Attendance, User } from '../models/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { listEvents } from '../controllers/public.controller.js';
import { slugParam } from '../validators/content.validator.js';
import { idParam } from '../validators/common.js';
import { gymDay } from '../utils/dates.js';
import { requireActiveMembership } from '../services/booking.service.js';

const r = Router();
r.get('/', h(listEvents));

// Leaderboard: attendance challenges are scored from real check-ins in the challenge window.
async function leaderboard(ch) {
  const ids = ch.participants.map((p) => p.user);
  let scores = Object.fromEntries(ch.participants.map((p) => [String(p.user), p.score || 0]));
  if (ch.metric === 'attendance') {
    const counts = await Attendance.aggregate([
      { $match: { member: { $in: ids }, day: { $gte: gymDay(ch.startDate), $lte: gymDay(ch.endDate) } } },
      { $group: { _id: '$member', n: { $sum: 1 } } },
    ]);
    scores = Object.fromEntries(ids.map((id) => [String(id), 0]));
    counts.forEach((c) => { scores[String(c._id)] = c.n; });
  }
  const users = await User.find({ _id: { $in: ids }, status: 'active' }).select('name avatar').lean();
  return users
    .map((u) => ({ userId: u._id, name: `${u.name.split(' ')[0]} ${u.name.split(' ')[1]?.[0] || ''}`.trim(), avatar: u.avatar?.url ? u.avatar : null, score: scores[String(u._id)] || 0 }))
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

r.get('/:slug', optionalAuth, validate({ params: slugParam }), h(async (req, res) => {
  const ch = await Challenge.findOne({ slug: req.params.slug, isPublished: true }).lean();
  if (!ch) throw ApiError.notFound('Event not found');
  const board = ch.metric === 'none' ? [] : await leaderboard(ch);
  const joined = req.user ? ch.participants.some((p) => String(p.user) === String(req.user._id)) : false;
  return ok(res, { ...ch, participants: undefined, participantCount: ch.participants.length, leaderboard: board.slice(0, 50), joined, myRank: board.find((b) => req.user && String(b.userId) === String(req.user._id)) || null });
}));

r.post('/:id/join', authenticate, validate({ params: idParam }), h(async (req, res) => {
  await requireActiveMembership(req.user._id);
  const ch = await Challenge.findOneAndUpdate(
    { _id: req.params.id, isPublished: true, endDate: { $gte: new Date() }, 'participants.user': { $ne: req.user._id } },
    { $push: { participants: { user: req.user._id } } },
    { new: true },
  );
  if (!ch) throw ApiError.conflict('You have already joined, or this event has ended');
  return ok(res, { joined: true }, { message: `You're in! Good luck in ${ch.title}.` });
}));

r.post('/:id/leave', authenticate, validate({ params: idParam }), h(async (req, res) => {
  await Challenge.updateOne({ _id: req.params.id }, { $pull: { participants: { user: req.user._id } } });
  return ok(res, { joined: false }, { message: 'You left the event' });
}));

export default r;
