import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ask, assistantEnabled, DISCLAIMER } from '../services/assistant.service.js';
import { isTest } from '../config/env.js';

const r = Router();

r.get('/status', (_req, res) => ok(res, { enabled: assistantEnabled(), disclaimer: DISCLAIMER }));

// Signed-in users only, 20 questions per hour each, to keep usage and cost bounded.
const perUser = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => isTest,
  keyGenerator: (req) => String(req.user?._id),
  handler: (_req, res) => res.status(429).json({ success: false, message: 'You have reached the hourly limit for the assistant. Please try again later.' }),
});

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
    .min(1).max(12)
    .refine((m) => m.at(-1).role === 'user', 'The last message must be from the user')
    .refine((m) => m[0].role === 'user', 'The conversation must start with a user message'),
});

r.post('/', authenticate, perUser, validate({ body: schema }), h(async (req, res) => ok(res, await ask(req.body.messages))));

export default r;
