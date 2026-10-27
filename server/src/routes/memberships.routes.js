import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/membership.controller.js';
import { listPlans } from '../controllers/public.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';

const r = Router();
r.get('/plans', h(listPlans));

r.use(authenticate);
r.get('/me', h(c.mine));
r.post('/:id/cancel-request', validate({ params: idParam, body: z.object({ reason: z.string().trim().min(5, 'Please tell us why').max(500) }) }), h(c.requestCancellation));

r.get('/', authorize('admin', 'staff'), validate({ query: c.listSchema }), h(c.list));
r.post('/assign', authorize('admin'), validate({ body: c.assignSchema }), h(c.assign));
r.patch('/:id', authorize('admin'), validate({ params: idParam, body: c.updateSchema }), h(c.update));
r.post('/:id/cancellation', authorize('admin'), validate({ params: idParam, body: c.decideSchema }), h(c.decideCancellation));

export default r;
