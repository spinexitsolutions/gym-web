import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/booking.controller.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';
import { classBase } from '../validators/admin.validator.js';

const r = Router();
r.get('/', optionalAuth, validate({ query: c.classesQuery }), h(c.listClasses));
r.post('/:id/book', authenticate, validate({ params: idParam }), h(c.bookClass));
r.get('/:id/roster', authenticate, authorize('admin', 'staff', 'trainer'), validate({ params: idParam }), h(c.roster));

r.post('/', authenticate, authorize('admin'), validate({ body: c.classSchema }), h(c.createClass));
r.post('/series', authenticate, authorize('admin'), validate({ body: c.seriesSchema }), h(c.createSeries));
r.patch('/:id', authenticate, authorize('admin'), validate({ params: idParam, body: classBase.partial() }), h(c.updateClass));
r.post('/:id/cancel', authenticate, authorize('admin'), validate({ params: idParam, body: z.object({ reason: z.string().trim().max(300).optional() }) }), h(c.cancelClass));

export default r;
