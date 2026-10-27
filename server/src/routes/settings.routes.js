import { Router } from 'express';
import { getSettings } from '../controllers/public.controller.js';
import * as c from '../controllers/settings.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { siteSettingsPatchSchema } from '../validators/settings.validator.js';

const r = Router();

r.get('/public', h(getSettings));

r.use(authenticate, authorize('admin'));
r.get('/draft', h(c.getDraft));
r.patch('/draft', validate({ body: siteSettingsPatchSchema }), h(c.saveDraft));
r.post('/publish', h(c.publish));
r.post('/discard', h(c.discard));

export default r;
