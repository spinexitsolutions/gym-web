import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/booking.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';

const r = Router();
r.get('/trainers/:id/slots', validate({ params: idParam, query: c.slotsQuery }), h(c.slots));

r.use(authenticate);
r.get('/me', h(c.mine));
r.post('/pt', validate({ body: c.ptSchema }), h(c.bookPT));
r.post('/:id/cancel', validate({ params: idParam, body: z.object({ reason: z.string().trim().max(300).optional() }) }), h(c.cancel));
r.post('/:id/reschedule', validate({ params: idParam, body: z.object({ startAt: z.coerce.date() }) }), h(c.reschedule));
r.get('/trainer/me', authorize('trainer'), h(c.trainerSchedule));

r.get('/', authorize('admin', 'staff'), validate({ query: c.listQuery }), h(c.list));
r.get('/export.csv', authorize('admin', 'staff'), validate({ query: c.listQuery }), h(c.exportCsv));
r.patch('/:id/status', authorize('admin', 'staff', 'trainer'), validate({ params: idParam, body: c.statusSchema }), h(c.setStatus));

export default r;
