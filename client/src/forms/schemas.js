import { z } from 'zod';

// Mirrors the server rules (server/src/validators) so users get instant feedback; the server re-validates.
export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const emailRule = z.string().trim().min(1, 'Email is required').email('Enter a valid email');
export const phoneRule = z.string().trim().regex(/^(\+?[0-9 ()-]{7,20})?$/, 'Enter a valid phone number');

export const loginSchema = z.object({ email: emailRule, password: z.string().min(1, 'Password is required') });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email: emailRule,
    phone: phoneRule.optional(),
    password: passwordRule,
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(20).optional(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the membership terms'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const resetSchema = z
  .object({ password: passwordRule, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
