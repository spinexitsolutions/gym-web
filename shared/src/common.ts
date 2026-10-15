import { z } from 'zod';

/** Allows relative paths, in-page anchors, http(s), mailto and tel links. Blocks javascript:/data: URLs. */
export const safeHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(v),
    'Link must be a relative path (/page), an anchor (#section), an http(s) URL, mailto: or tel:',
  );

/** Media URL: uploaded files (/uploads/...), bundled assets (/images/...), or https URLs. */
export const mediaUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^(\/(?!\/)|https:\/\/)/i.test(v), 'Image must be an uploaded file or an https URL');

export const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a 6-digit hex colour such as #c6ff3d');

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const ctaSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: safeHref,
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
});
export type Cta = z.infer<typeof ctaSchema>;

export const seoSchema = z.object({
  title: z.string().trim().max(70).default(''),
  description: z.string().trim().max(170).default(''),
  image: mediaUrl.default(''),
  noIndex: z.boolean().default(false),
});
export type Seo = z.infer<typeof seoSchema>;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
