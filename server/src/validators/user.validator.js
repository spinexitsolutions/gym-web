import { z } from 'zod';
import { password, phone } from './common.js';

const optionalText = (max) => z.string().trim().max(max).optional();

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional().or(z.literal('')),
});

export const updateProfileSchema = z.object({
  dateOfBirth: z.coerce.date().max(new Date(), 'Date of birth cannot be in the future').optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  heightCm: z.coerce.number().min(50).max(260).optional().nullable(),
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  fitnessGoals: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  address: z
    .object({ line1: optionalText(200), city: optionalText(80), state: optionalText(80), pincode: optionalText(12) })
    .optional(),
  emergencyContact: z
    .object({ name: optionalText(80), phone: phone.optional().or(z.literal('')), relation: optionalText(40) })
    .optional(),
  medicalNotes: optionalText(1000),
  notificationPrefs: z.object({ email: z.boolean().optional(), push: z.boolean().optional() }).optional(),
});

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .refine((d) => d.currentPassword !== d.newPassword, { path: ['newPassword'], message: 'Choose a different password' });

export const deletionRequestSchema = z.object({ reason: z.string().trim().max(500).optional() });
