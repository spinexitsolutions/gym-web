import { z } from 'zod';
import { mediaUrl, seoSchema, slugSchema } from './common';
import { draftSectionSchema } from './sections';

export const RESERVED_SLUGS = ['admin', 'member', 'trainer', 'login', 'register', 'api', 'uploads', 'blog', 'preview', 'checkout', 'forgot-password', 'reset-password', 'verify-email'];

export const pageInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: slugSchema.refine((s) => !RESERVED_SLUGS.includes(s), 'This slug is reserved'),
  seo: seoSchema.default({}),
  featuredImage: mediaUrl.default(''),
  showInNav: z.boolean().default(false),
  navOrder: z.number().int().min(0).max(100).default(50),
});

export const pageDraftUpdateSchema = pageInputSchema.partial().extend({
  sections: z.array(draftSectionSchema).max(60).optional(),
});

export const PAGE_STATUSES = ['draft', 'published', 'unpublished'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];
