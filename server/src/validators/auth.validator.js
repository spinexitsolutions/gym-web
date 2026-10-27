import { z } from 'zod';
import { email, password, phone } from './common.js';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);
const token = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid or expired link');

export const registerSchema = z.object({
  name,
  email,
  password,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  referralCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal('').transform(() => undefined)),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token, password });
export const verifySchema = z.object({ token });
