import { Router } from 'express';
import * as c from '../controllers/contact.controller.js';
import { validate } from '../middleware/validate.js';
import { formLimiter } from '../middleware/rateLimit.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { contactSchema, newsletterSchema } from '../validators/content.validator.js';

const r = Router();
r.post('/', formLimiter, validate({ body: contactSchema }), h(c.submitInquiry));
r.post('/newsletter', formLimiter, validate({ body: newsletterSchema }), h(c.subscribeNewsletter));
export default r;
