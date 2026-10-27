import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { registerSchema, loginSchema, forgotSchema, resetSchema, verifySchema } from '../validators/auth.validator.js';

const r = Router();

r.get('/csrf', c.csrf);
r.post('/register', authLimiter, validate({ body: registerSchema }), h(c.register));
r.post('/login', authLimiter, validate({ body: loginSchema }), h(c.login));
r.post('/refresh', h(c.refresh));
r.post('/logout', h(c.logout));
r.post('/logout-all', authenticate, h(c.logoutAll));
r.get('/me', authenticate, h(c.me));
r.post('/verify-email', authLimiter, validate({ body: verifySchema }), h(c.verifyEmail));
r.post('/resend-verification', authLimiter, authenticate, h(c.resendVerification));
r.post('/forgot-password', authLimiter, validate({ body: forgotSchema }), h(c.forgotPassword));
r.post('/reset-password', authLimiter, validate({ body: resetSchema }), h(c.resetPassword));

export default r;
