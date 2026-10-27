import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({ success: false, message: 'Too many requests. Please wait a moment and try again.' });

const make = (windowMs, limit) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip: () => isTest });

export const apiLimiter = make(15 * 60 * 1000, 600);
export const authLimiter = make(15 * 60 * 1000, 20); // login/register/reset
export const formLimiter = make(60 * 60 * 1000, 10); // contact, newsletter
