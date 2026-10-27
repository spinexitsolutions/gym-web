import { z } from 'zod';
import mongoose from 'mongoose';

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
export const idParam = z.object({ id: objectId });
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');
export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

// Only http(s) URLs or same-site paths; blocks javascript: and data: links in CMS content.
export const safeUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v) || /^(mailto|tel):/i.test(v) || v.startsWith('#'), 'Must be an http(s) URL or a site path');

export const image = z.object({
  url: safeUrl.default(''),
  publicId: z.string().max(300).optional(),
  alt: z.string().max(200).default(''),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(40).optional(),
  q: z.string().trim().max(100).optional(),
});
