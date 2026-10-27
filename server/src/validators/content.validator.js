import { z } from 'zod';
import { email, phone, listQuery } from './common.js';
import { PROGRAM_CATEGORIES } from '../models/index.js';

export const trainerListQuery = listQuery.extend({
  specialization: z.string().trim().max(60).optional(),
  featured: z.enum(['true', 'false']).optional(),
});

export const programListQuery = listQuery.extend({
  category: z.enum(PROGRAM_CATEGORIES).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  featured: z.enum(['true', 'false']).optional(),
});

export const galleryQuery = z.object({
  category: z.enum(['gym', 'facility', 'equipment', 'event', 'transformation']).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

export const slugParam = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/) });

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  subject: z.string().trim().max(120).optional(),
  interest: z.enum(['membership', 'personal_training', 'trial', 'corporate', 'other']).optional(),
  message: z.string().trim().min(10, 'Message should be at least 10 characters').max(3000),
  source: z.enum(['contact_page', 'homepage', 'membership_page', 'other']).optional(),
  // Spam protection: `website` is a hidden honeypot field; `startedAt` is when the form was rendered.
  website: z.string().max(0).optional().or(z.string().transform(() => 'BOT')),
  startedAt: z.coerce.number().optional(),
});

export const newsletterSchema = z.object({
  email,
  website: z.string().optional(),
});
