import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { MembershipModel, NotificationModel, UserModel } from '../models';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { addDays } from '../utils/dates';
import { asyncHandler, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';
import { safeHref } from '@apex/shared';

const r = Router();
r.use(requireAuth);

r.get(
  '/me',
  validate({ query: listQuery.extend({ unread: z.enum(['true']).optional() }) }),
  asyncHandler(async (req, res) => {
    const { page, limit, unread } = res.locals.query;
    const filter: Record<string, unknown> = { user: req.user!.id };
    if (unread) filter.readAt = null;
    const [items, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter).select('-deliveries -dedupeKey').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({ user: req.user!.id, readAt: null }),
    ]);
    ok(res, items, { ...pageMeta(page, limit, total), unreadCount });
  }),
);

r.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const n = await NotificationModel.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { $set: { readAt: new Date() } }, { new: true });
    if (!n) throw AppError.notFound('Notification');
    ok(res, { read: true });
  }),
);

r.post('/read-all', asyncHandler(async (req, res) => {
  const result = await NotificationModel.updateMany({ user: req.user!.id, readAt: null }, { $set: { readAt: new Date() } });
  ok(res, { updated: result.modifiedCount });
}));

/**
 * Campaigns (e.g. renewal campaign to members expiring soon). Each recipient is notified once
 * per campaign key, so re-sending the same campaign never duplicates messages.
 */
r.post(
  '/campaigns',
  requirePermission('members:write'),
  validate({
    body: z.object({
      key: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, 'Use lowercase letters, numbers and hyphens'),
      audience: z.enum(['expiring_14', 'expired_30', 'active', 'no_membership']),
      title: z.string().trim().min(3).max(140),
      body: z.string().trim().min(3).max(1000),
      link: safeHref.default('/memberships'),
      email: z.boolean().default(true),
      whatsapp: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const now = new Date();
    let userIds: unknown[] = [];
    const b = req.body;
    if (b.audience === 'expiring_14') userIds = await MembershipModel.distinct('user', { status: 'active', endDate: { $gt: now, $lte: addDays(now, 14) } });
    if (b.audience === 'expired_30') {
      const active = await MembershipModel.distinct('user', { status: { $in: ['active', 'upcoming'] } });
      userIds = (await MembershipModel.distinct('user', { status: 'expired', endDate: { $gte: addDays(now, -30) } })).filter((u) => !active.some((a) => String(a) === String(u)));
    }
    if (b.audience === 'active') userIds = await MembershipModel.distinct('user', { status: 'active' });
    if (b.audience === 'no_membership') {
      const any = await MembershipModel.distinct('user');
      userIds = (await UserModel.find({ role: 'member', status: 'active', _id: { $nin: any } }).select('_id').lean()).map((u) => u._id);
    }
    // Marketing campaigns respect the member's marketing opt-in.
    const recipients = await UserModel.find({ _id: { $in: userIds }, status: 'active', 'notificationPrefs.marketing': true }).select('_id').lean();
    let sent = 0;
    for (const u of recipients) {
      const n = await notify({ userId: u._id, type: 'promotion', title: b.title, body: b.body, link: b.link, dedupeKey: `campaign:${b.key}:${u._id}`, email: b.email, whatsapp: b.whatsapp });
      if (n) sent++;
    }
    await audit(req, { action: 'campaign.send', entity: 'Notification', summary: `Campaign ${b.key} (${b.audience}): ${sent} sent, ${recipients.length - sent} already received` });
    ok(res, { audience: userIds.length, optedIn: recipients.length, sent });
  }),
);

export default r;
