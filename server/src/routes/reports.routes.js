import { Router } from 'express';
import * as c from '../controllers/report.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

const r = Router();
r.use(authenticate, authorize('admin'));
r.get('/overview', h(c.overview));
r.get('/revenue', validate({ query: c.revenueQuery }), h(c.revenue));
r.get('/revenue/daily', validate({ query: c.dailyQuery }), h(c.revenueDaily));
r.get('/growth', h(c.growth));
export default r;
