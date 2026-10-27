import { Router } from 'express';
import { z } from 'zod';
import { SupportTicket } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate } from '../utils/pagination.js';
import { idParam, objectId } from '../validators/common.js';
import { notify, notifyStaff } from '../services/notification.service.js';
import { audit } from '../services/audit.service.js';

const r = Router();
r.use(authenticate);
const STAFF = ['owner', 'admin', 'staff'];
const isStaff = (u) => STAFF.includes(u.role);
const populate = [{ path: 'user', select: 'name email' }, { path: 'assignedTo', select: 'name' }, { path: 'messages.author', select: 'name role' }];

// Members never see internal staff notes.
const forViewer = (ticket, user) => {
  const t = ticket.toObject ? ticket.toObject() : ticket;
  return isStaff(user) ? t : { ...t, messages: t.messages.filter((m) => !m.internal) };
};

const createSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(['membership', 'payment', 'booking', 'facility', 'trainer', 'account', 'other']).default('other'),
  message: z.string().trim().min(5).max(3000),
});

r.post('/', validate({ body: createSchema }), h(async (req, res) => {
  const t = await SupportTicket.create({ user: req.user._id, subject: req.body.subject, category: req.body.category, messages: [{ author: req.user._id, body: req.body.message }] });
  await notifyStaff({ type: 'support', title: 'New support ticket', body: `${req.user.name}: ${req.body.subject}`, link: `/admin/support/${t._id}` });
  return created(res, t, 'Ticket created. We usually reply within one business day.');
}));

r.get('/me', h(async (req, res) => {
  const items = await SupportTicket.find({ user: req.user._id }).sort('-updatedAt').select('-messages.internal').lean();
  return ok(res, items.map((t) => ({ ...t, messages: undefined, lastMessageAt: t.messages.at(-1)?.at, messageCount: t.messages.length })));
}));

r.get('/', authorize('admin', 'staff'), h(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const { items, meta } = await paginate(SupportTicket, filter, parsePagination(req.query, { sortable: ['updatedAt', 'createdAt'], defaultSort: '-updatedAt' }), { populate: [{ path: 'user', select: 'name email' }, { path: 'assignedTo', select: 'name' }] });
  return ok(res, items.map((t) => ({ ...t, messages: undefined, messageCount: t.messages.length })), { meta });
}));

async function loadTicket(req) {
  const t = await SupportTicket.findById(req.params.id).populate(populate);
  if (!t) throw ApiError.notFound('Ticket not found');
  if (!isStaff(req.user) && String(t.user._id) !== String(req.user._id)) throw ApiError.notFound('Ticket not found');
  return t;
}

r.get('/:id', validate({ params: idParam }), h(async (req, res) => ok(res, forViewer(await loadTicket(req), req.user))));

r.post('/:id/messages', validate({ params: idParam, body: z.object({ body: z.string().trim().min(1).max(3000), internal: z.boolean().default(false) }) }), h(async (req, res) => {
  const t = await loadTicket(req);
  if (t.status === 'closed') throw ApiError.badRequest('This ticket is closed. Please open a new one.');
  const internal = isStaff(req.user) && req.body.internal;
  t.messages.push({ author: req.user._id, body: req.body.body, internal });
  if (!internal) t.status = isStaff(req.user) ? 'pending' : 'open';
  await t.save();
  if (isStaff(req.user) && !internal) {
    await notify(t.user._id, { type: 'support', title: 'New reply on your ticket', body: t.subject, link: `/dashboard/support/${t._id}`, email: true });
  } else if (!isStaff(req.user)) {
    await notifyStaff({ type: 'support', title: 'Member replied', body: t.subject, link: `/admin/support/${t._id}` });
  }
  await t.populate(populate);
  return ok(res, forViewer(t, req.user), { message: internal ? 'Internal note added' : 'Reply sent' });
}));

r.patch('/:id', validate({ params: idParam, body: z.object({ status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'normal', 'high']).optional(), assignedTo: objectId.nullable().optional() }) }), h(async (req, res) => {
  const t = await loadTicket(req);
  if (!isStaff(req.user)) {
    // Members can only close or reopen their own ticket.
    if (Object.keys(req.body).some((k) => k !== 'status') || !['closed', 'open'].includes(req.body.status)) throw ApiError.forbidden();
  }
  t.set({ ...req.body, assignedTo: req.body.assignedTo === null ? undefined : req.body.assignedTo ?? t.assignedTo });
  await t.save();
  if (isStaff(req.user)) await audit(req, { action: 'support.update', entity: 'SupportTicket', entityId: t._id, changes: req.body });
  if (isStaff(req.user) && req.body.status === 'resolved') await notify(t.user._id, { type: 'support', title: 'Ticket resolved', body: t.subject, link: `/dashboard/support/${t._id}` });
  await t.populate(populate);
  return ok(res, forViewer(t, req.user), { message: 'Ticket updated' });
}));

export default r;
