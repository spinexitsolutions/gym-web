import { Router } from 'express';
import { z } from 'zod';
import { hasPermission, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SupportTicketModel } from '../models';
import { notifyAdmins, notifyLater } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';

const r = Router();
r.use(requireAuth);

r.post(
  '/',
  validate({ body: z.object({ subject: z.string().trim().min(3).max(140), category: z.enum(['membership', 'payment', 'booking', 'facility', 'account', 'other']).default('other'), body: z.string().trim().min(5).max(4000) }) }),
  asyncHandler(async (req, res) => {
    const open = await SupportTicketModel.countDocuments({ user: req.user!.id, status: { $in: ['open', 'in_progress'] } });
    if (open >= 5) throw AppError.conflict('You have 5 open tickets. Please wait for a reply before opening more.');
    const t = await SupportTicketModel.create({ user: req.user!.id, subject: req.body.subject, category: req.body.category, messages: [{ author: req.user!.id, authorName: req.user!.name, staff: false, body: req.body.body }] });
    await notifyAdmins({ type: 'support', title: `New ticket: ${t.subject}`, body: `From ${req.user!.name}`, link: `/admin/support/${t._id}`, dedupeKey: `ticket:${t._id}`, email: true });
    created(res, t);
  }),
);

const ticketList = listQuery.extend({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), scope: z.enum(['mine', 'all']).default('mine') });

r.get(
  '/',
  validate({ query: ticketList }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, scope } = res.locals.query as z.infer<typeof ticketList>;
    const all = scope === 'all' && hasPermission(req.user, 'support:write');
    const filter: Record<string, unknown> = all ? {} : { user: req.user!.id };
    if (status) filter.status = status;
    const [items, total] = await Promise.all([SupportTicketModel.find(filter).populate('user', 'name email').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), SupportTicketModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

async function loadTicket(id: string, viewer: { id: string; role: string; permissions: string[] }) {
  const t = await SupportTicketModel.findById(id);
  if (!t) throw AppError.notFound('Ticket');
  if (String(t.user) !== viewer.id && !hasPermission(viewer as never, 'support:write')) throw AppError.notFound('Ticket');
  return t;
}

r.get('/:id', asyncHandler(async (req, res) => ok(res, await (await loadTicket(req.params.id, req.user!)).populate('user', 'name email'))));

r.post(
  '/:id/messages',
  validate({ body: z.object({ body: z.string().trim().min(1).max(4000) }) }),
  asyncHandler(async (req, res) => {
    const t = await loadTicket(req.params.id, req.user!);
    if (t.status === 'closed') throw AppError.conflict('This ticket is closed');
    const staff = String(t.user) !== req.user!.id;
    t.messages.push({ author: req.user!.id as never, authorName: req.user!.name, staff, body: req.body.body, createdAt: new Date() });
    if (staff && t.status === 'open') t.status = 'in_progress';
    if (!staff && t.status === 'resolved') t.status = 'open';
    await t.save();
    if (staff) notifyLater({ userId: t.user, type: 'support', title: `Reply: ${t.subject}`, body: req.body.body.slice(0, 200), link: `/member/support/${t._id}`, dedupeKey: `ticket-reply:${t._id}:${t.messages.length}` });
    ok(res, t);
  }),
);

r.patch(
  '/:id',
  validate({ body: z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'normal', 'high']).optional() }) }),
  asyncHandler(async (req, res) => {
    const t = await loadTicket(req.params.id, req.user!);
    const isStaff = hasPermission(req.user, 'support:write');
    if (!isStaff && (req.body.priority || (req.body.status && req.body.status !== 'closed'))) throw AppError.forbidden('Members can only close their tickets');
    Object.assign(t, req.body);
    await t.save();
    ok(res, t);
  }),
);

export default r;
