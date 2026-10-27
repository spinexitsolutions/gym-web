import { Router } from 'express';
import * as c from '../controllers/member.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';

const r = Router();
r.use(authenticate, authorize('admin', 'staff'));

r.get('/', validate({ query: c.listSchema }), h(c.list));
r.get('/export.csv', authorize('admin'), validate({ query: c.listSchema }), h(c.exportCsv));
r.post('/', validate({ body: c.createSchema }), h(c.createMember));
r.get('/:id', validate({ params: idParam }), h(c.detail));
r.patch('/:id/status', authorize('admin'), validate({ params: idParam, body: c.statusSchema }), h(c.setStatus));
r.patch('/:id/profile', validate({ params: idParam, body: c.staffProfileSchema }), h(c.updateProfile));
r.post('/:id/deletion', authorize('admin'), validate({ params: idParam, body: c.deletionSchema }), h(c.processDeletion));

export default r;
