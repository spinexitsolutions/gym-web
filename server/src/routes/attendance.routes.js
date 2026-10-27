import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/attendance.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';

const r = Router();
r.use(authenticate);
const desk = authorize('admin', 'staff', 'trainer');

r.get('/qr', h(c.issueQr));
r.get('/me', h(c.mine));
r.post('/scan', desk, validate({ body: z.object({ token: z.string().min(20).max(2000) }) }), h(c.scan));
r.post('/manual', desk, validate({ body: c.manualSchema }), h(c.manual));
r.get('/', desk, validate({ query: c.listQuery }), h(c.list));
r.get('/export.csv', authorize('admin', 'staff'), validate({ query: c.listQuery }), h(c.exportCsv));
r.get('/report', authorize('admin', 'staff'), validate({ query: c.reportQuery }), h(c.report));
r.patch('/:id', authorize('admin', 'staff'), validate({ params: idParam, body: c.correctionSchema }), h(c.correct));
r.delete('/:id', authorize('admin'), validate({ params: idParam }), h(c.remove));

export default r;
