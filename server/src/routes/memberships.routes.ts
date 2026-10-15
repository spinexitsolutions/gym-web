import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { MembershipModel, UserModel } from '../models';
import { audit } from '../services/audit.service';
import { getActiveMembership, grantMembership, membershipView } from '../services/membership.service';
import { notifyAdmins, notifyLater } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { sendCsv } from '../utils/csv';
import { addDays } from '../utils/dates';
import { asyncHandler, created, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';

const r = Router();
r.use(requireAuth);

r.get(
  '/me',
  asyncHandler(async (req, res) => {
    const list = await MembershipModel.find({ user: req.user!.id }).sort({ startDate: -1 }).lean();
    const active = await getActiveMembership(req.user!.id);
    ok(res, { active: active ? membershipView(active.toObject()) : null, history: list.map((m) => membershipView(m)) });
  }),
);

r.post(
  '/me/:id/cancel-request',
  requireRole('member'),
  validate({ body: z.object({ reason: z.string().trim().min(3).max(500) }) }),
  asyncHandler(async (req, res) => {
    const m = await MembershipModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user!.id, status: { $in: ['active', 'upcoming'] }, cancellationRequestedAt: null },
      { $set: { cancellationRequestedAt: new Date(), cancelReason: req.body.reason } },
      { new: true },
    );
    if (!m) throw AppError.notFound('Active membership');
    await notifyAdmins({ type: 'membership', title: 'Cancellation request', body: `${req.user!.name} requested to cancel ${m.planSnapshot?.name}.`, link: `/admin/members/${req.user!.id}`, dedupeKey: `cancel-req:${m._id}`, email: true });
    ok(res, membershipView(m.toObject()));
  }),
);

/* Admin */
const listSchema = listQuery.extend({
  status: z.enum(['upcoming', 'active', 'expired', 'cancelled', 'upgraded', 'refunded']).optional(),
  expiringInDays: z.coerce.number().int().min(1).max(90).optional(),
  cancellationRequested: z.enum(['true']).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

r.get(
  '/',
  requirePermission('members:read'),
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, expiringInDays, cancellationRequested, format } = res.locals.query as z.infer<typeof listSchema>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (expiringInDays) {
      filter.status = 'active';
      filter.endDate = { $gte: new Date(), $lte: addDays(new Date(), expiringInDays) };
    }
    if (cancellationRequested) filter.cancellationRequestedAt = { $ne: null };
    if (format === 'csv') {
      const rows = await MembershipModel.find(filter).populate('user', 'name email phone').sort({ endDate: 1 }).limit(10000).lean();
      await audit(req, { action: 'memberships.export', entity: 'Membership', summary: `Exported ${rows.length} memberships` });
      return sendCsv(res, 'memberships.csv', ['member', 'email', 'phone', 'plan', 'status', 'start', 'end', 'source'], rows.map((m) => {
        const u = m.user as unknown as { name?: string; email?: string; phone?: string };
        return [u?.name, u?.email, u?.phone, m.planSnapshot?.name, m.status, m.startDate, m.endDate, m.source];
      }));
    }
    const [items, total] = await Promise.all([
      MembershipModel.find(filter).populate('user', 'name email phone').sort({ endDate: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      MembershipModel.countDocuments(filter),
    ]);
    ok(res, items.map((m) => ({ ...membershipView(m), user: m.user, cancelReason: m.cancelReason ?? null })), pageMeta(page, limit, total));
  }),
);

/** Complimentary / staff-granted membership (no payment). Audited. */
r.post(
  '/',
  requirePermission('members:write'),
  validate({ body: z.object({ userId: z.string().regex(/^[a-f0-9]{24}$/), planId: z.string().regex(/^[a-f0-9]{24}$/), reason: z.string().trim().min(3).max(300), startDate: z.coerce.date().optional() }) }),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOne({ _id: req.body.userId, role: 'member' });
    if (!user) throw AppError.notFound('Member');
    const m = await grantMembership({ userId: user._id, planId: req.body.planId, mode: 'renewal', source: 'admin', createdBy: req.user!.id, startDate: req.body.startDate });
    await audit(req, { action: 'membership.grant', entity: 'Membership', entityId: m._id, summary: `Granted ${m.planSnapshot?.name} to ${user.email}: ${req.body.reason}` });
    notifyLater({ userId: user._id, type: 'membership', title: 'Membership added', body: `${m.planSnapshot?.name} has been added to your account.`, link: '/member', dedupeKey: `grant:${m._id}` });
    created(res, membershipView(m.toObject()));
  }),
);

/** Extend, change dates, or cancel a membership. Audited. */
r.patch(
  '/:id',
  requirePermission('members:write'),
  validate({
    body: z.object({
      action: z.enum(['extend', 'cancel', 'set_dates', 'dismiss_cancellation']),
      days: z.number().int().min(1).max(365).optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      reason: z.string().trim().min(3).max(500),
    }),
  }),
  asyncHandler(async (req, res) => {
    const m = await MembershipModel.findById(req.params.id);
    if (!m) throw AppError.notFound('Membership');
    const before = { status: m.status, startDate: m.startDate, endDate: m.endDate };
    const now = new Date();
    switch (req.body.action) {
      case 'extend':
        if (!req.body.days) throw AppError.validation('Days are required', [{ path: 'body.days', message: 'Required' }]);
        if (!['active', 'upcoming', 'expired'].includes(m.status)) throw AppError.conflict('This membership cannot be extended');
        m.endDate = addDays(m.endDate > now ? m.endDate : now, req.body.days);
        if (m.status === 'expired') m.status = 'active';
        break;
      case 'cancel':
        if (!['active', 'upcoming'].includes(m.status)) throw AppError.conflict('Only active or upcoming memberships can be cancelled');
        m.status = 'cancelled';
        m.cancelledAt = now;
        m.cancelReason = req.body.reason;
        if (m.endDate > now) m.endDate = now;
        break;
      case 'set_dates':
        if (!req.body.startDate || !req.body.endDate || req.body.endDate <= req.body.startDate) throw AppError.validation('Valid start and end dates are required');
        m.startDate = req.body.startDate;
        m.endDate = req.body.endDate;
        if (['active', 'upcoming', 'expired'].includes(m.status)) m.status = m.endDate <= now ? 'expired' : m.startDate > now ? 'upcoming' : 'active';
        break;
      case 'dismiss_cancellation':
        m.cancellationRequestedAt = undefined;
        break;
    }
    await m.save();
    await audit(req, { action: `membership.${req.body.action}`, entity: 'Membership', entityId: m._id, summary: req.body.reason, changes: { before, after: { status: m.status, startDate: m.startDate, endDate: m.endDate } } });
    ok(res, membershipView(m.toObject()));
  }),
);

export default r;
