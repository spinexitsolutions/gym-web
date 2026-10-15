import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const handler = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } });

const make = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit: isTest ? 10_000 : limit, standardHeaders: 'draft-7', legacyHeaders: false, handler });

/** General API limiter. */
export const apiLimiter = make(60_000, 300);
/** Login / register / password reset — per IP. Account lockout is enforced separately. */
export const authLimiter = make(15 * 60_000, 30);
/** Public forms (trial, contact, newsletter). */
export const publicFormLimiter = make(60 * 60_000, 20);
/** Upload endpoints. */
export const uploadLimiter = make(60 * 60_000, 120);

/** Strict limiter that is active in tests too (used to test limiter behaviour). */
export const strictTestableLimiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler });
