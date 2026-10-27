import { z } from 'zod';
import { Membership, MembershipPlan, User } from '../models/index.js';
import { createMembership } from '../services/membership.service.js';
import { notify, notifyStaff } from '../services/notification.service.js';
import { audit } from '../services/audit.service.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex } from '../utils/pagination.js';
import { addDays } from '../utils/dates.js';
import { objectId } from '../validators/common.js';

export async function mine(req, res) {
  const now = new Date();
  const all = await Membership.find({ user: req.user._id }).populate('plan', 'name slug tier benefits limits').sort('-startDate').lean();
  const current = all.find((m) => m.status === 'active' && m.startDate <= now && m.endDate >= now) || null;
  const upcoming = all.filter((m) => m.status === 'pending' && m.startDate > now);
  const daysLeft = current ? Math.ceil((new Date(current.endDate) - now) / 864e5) : 0;
  return ok(res, { current, upcoming, history: all, daysLeft });
}

export async function requestCancellation(req, res) {
  const m = await Membership.findOne({ _id: req.params.id, user: req.user._id, status: { $in: ['active', 'pending'] } });
  if (!m) throw ApiError.notFound('Active membership not found');
  if (m.cancellation?.status === 'requested') throw ApiError.conflict('A cancellation request is already pending');
  m.cancellation = { requestedAt: new Date(), reason: req.body.reason, status: 'requested' };
  await m.save();
  await notifyStaff({ type: 'membership', title: 'Cancellation requested', body: `${req.user.name} asked to cancel their membership.`, link: '/admin/memberships?cancellation=requested' });
  return ok(res, m, { message: 'Cancellation request sent. Our team will contact you within 3 business days.' });
}

// ---- Staff ----
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(30).optional(),
  status: z.enum(['pending', 'active', 'expired', 'cancelled', 'suspended']).optional(),
  plan: objectId.optional(),
  expiringInDays: z.coerce.number().int().min(1).max(90).optional(),
  cancellation: z.enum(['requested', 'approved', 'rejected']).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function list(req, res) {
  const { status, plan, expiringInDays, cancellation, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plan) filter.plan = plan;
  if (cancellation) filter['cancellation.status'] = cancellation;
  if (expiringInDays) {
    filter.status = 'active';
    filter.endDate = { $gte: new Date(), $lte: addDays(new Date(), expiringInDays) };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ role: 'member', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id').limit(500).lean();
    filter.user = { $in: users.map((u) => u._id) };
  }
  const opts = parsePagination(req.query, { sortable: ['endDate', 'startDate', 'createdAt'], defaultSort: expiringInDays ? 'endDate' : '-createdAt' });
  const result = await paginate(Membership, filter, opts, { populate: [{ path: 'user', select: 'name email phone' }, { path: 'plan', select: 'name tier' }] });
  return ok(res, result.items, { meta: result.meta });
}

export const decideSchema = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(300).optional() });

export async function decideCancellation(req, res) {
  const m = await Membership.findById(req.params.id);
  if (!m || m.cancellation?.status !== 'requested') throw ApiError.badRequest('No pending cancellation request');
  m.cancellation.status = req.body.decision === 'approve' ? 'approved' : 'rejected';
  m.cancellation.decidedBy = req.user._id;
  m.cancellation.decidedAt = new Date();
  if (req.body.decision === 'approve') m.status = 'cancelled';
  await m.save();
  await notify(m.user, {
    type: 'membership', email: true, link: '/dashboard/membership',
    title: req.body.decision === 'approve' ? 'Membership cancelled' : 'Cancellation request declined',
    body: req.body.note || (req.body.decision === 'approve' ? 'Your membership has been cancelled. Any eligible refund will be processed separately.' : 'Please contact the front desk for details.'),
  });
  await audit(req, { action: `membership.cancellation_${req.body.decision}`, entity: 'Membership', entityId: m._id, summary: req.body.note });
  return ok(res, m, { message: `Cancellation ${req.body.decision === 'approve' ? 'approved' : 'rejected'}` });
}

export const assignSchema = z.object({
  userId: objectId,
  planId: objectId,
  period: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']),
  startDate: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});

// Complimentary / corporate assignment without payment. Paid offline sales use POST /payments/offline.
export async function assign(req, res) {
  const [user, plan] = await Promise.all([User.findOne({ _id: req.body.userId, role: 'member' }), MembershipPlan.findById(req.body.planId)]);
  if (!user) throw ApiError.notFound('Member not found');
  if (!plan?.pricing.some((p) => p.period === req.body.period)) throw ApiError.badRequest('Plan or period not found');
  const m = await createMembership({ userId: user._id, planId: plan._id, period: req.body.period, assignedBy: req.user._id, startDate: req.body.startDate });
  await notify(user._id, { type: 'membership', title: `${plan.name} membership activated`, body: 'Your membership has been set up by our team.', link: '/dashboard/membership', email: true });
  await audit(req, { action: 'membership.assign', entity: 'Membership', entityId: m._id, summary: `${plan.name} (${req.body.period}) for ${user.email}`, changes: { note: req.body.note } });
  return created(res, m, 'Membership assigned');
}

export const updateSchema = z.object({
  status: z.enum(['active', 'suspended', 'cancelled', 'expired']).optional(),
  endDate: z.coerce.date().optional(),
  reason: z.string().trim().min(3, 'A reason is required').max(300),
});

export async function update(req, res) {
  const m = await Membership.findById(req.params.id);
  if (!m) throw ApiError.notFound('Membership not found');
  const before = { status: m.status, endDate: m.endDate };
  if (req.body.status) m.status = req.body.status;
  if (req.body.endDate) {
    if (req.body.endDate <= m.startDate) throw ApiError.badRequest('End date must be after the start date');
    m.endDate = req.body.endDate;
    m.remindersSent = [];
  }
  await m.save();
  await audit(req, { action: 'membership.update', entity: 'Membership', entityId: m._id, summary: req.body.reason, changes: { before, after: { status: m.status, endDate: m.endDate } } });
  return ok(res, m, { message: 'Membership updated' });
}
