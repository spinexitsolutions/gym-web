import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, 'Enter a valid phone number').optional().default(''),
  referralCode: z.string().trim().toUpperCase().max(12).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
