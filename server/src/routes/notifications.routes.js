import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { Notification, PushSubscription } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { parsePagination, paginate } from '../utils/pagination.js';
import { idParam } from '../validators/common.js';
import { pushEnabled } from '../services/notification.service.js';

const r = Router();
r.use(authenticate);

r.get('/', h(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const { items, meta } = await paginate(Notification, filter, parsePagination(req.query, { defaultLimit: 20 }));
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  return ok(res, items, { meta: { ...meta, unread } });
}));

r.get('/unread-count', h(async (req, res) => ok(res, { unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) })));

r.post('/:id/read', validate({ params: idParam }), h(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  return ok(res, null);
}));

r.post('/read-all', h(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  return ok(res, null, { message: 'All caught up' });
}));

// Web push (optional; only after the browser permission prompt is accepted).
r.get('/push/key', (_req, res) => ok(res, { enabled: pushEnabled, publicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null }));

const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
r.post('/push/subscribe', validate({ body: subSchema }), h(async (req, res) => {
  await PushSubscription.findOneAndUpdate({ endpoint: req.body.endpoint }, { user: req.user._id, keys: req.body.keys, userAgent: req.get('user-agent')?.slice(0, 200) }, { upsert: true });
  return ok(res, null, { message: 'Push notifications enabled on this device' });
}));
r.post('/push/unsubscribe', validate({ body: z.object({ endpoint: z.string().max(1000) }) }), h(async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user._id });
  return ok(res, null, { message: 'Push notifications disabled on this device' });
}));

export default r;
