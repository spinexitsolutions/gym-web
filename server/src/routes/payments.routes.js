import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/payment.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';

const r = Router();
// Webhook is mounted separately in app.js (raw body, no auth/CSRF).

r.use(authenticate);
r.post('/quote', validate({ body: c.purchaseSchema }), h(c.getQuote));
r.post('/order', validate({ body: c.purchaseSchema }), h(c.createOrder));
r.post('/verify', validate({ body: c.verifySchema }), h(c.verify));
r.get('/me', h(c.myPayments));
r.post('/:id/cancel', validate({ params: idParam }), h(c.cancelAttempt));
r.get('/:id/invoice', validate({ params: idParam }), h(c.invoice));
r.post('/:id/refund-request', validate({ params: idParam, body: z.object({ reason: z.string().trim().min(5, 'Please tell us why').max(500) }) }), h(c.requestRefund));

r.get('/', authorize('admin', 'staff'), validate({ query: c.listQuerySchema }), h(c.list));
r.get('/export.csv', authorize('admin'), validate({ query: c.listQuerySchema }), h(c.exportCsv));
r.post('/offline', authorize('admin', 'staff'), validate({ body: c.offlineSchema }), h(c.recordOffline));
r.post('/:id/refund', authorize('admin'), validate({ params: idParam, body: c.refundSchema }), h(c.processRefund));

export default r;
