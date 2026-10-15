import { z } from 'zod';
import { mediaUrl, safeHref, slugSchema } from '@apex/shared';

const order = z.number().int().min(0).max(1000).default(50);

export const programSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: slugSchema,
  summary: z.string().trim().max(300).default(''),
  description: z.string().trim().max(4000).default(''),
  imageUrl: mediaUrl.default(''),
  level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).default('all'),
  durationWeeks: z.number().int().min(1).max(104).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  order,
});

export const faqSchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(3000),
  category: z.string().trim().max(40).default('general'),
  published: z.boolean().default(true),
  order,
});

export const gallerySchema = z
  .object({
    category: z.enum(['transformation', 'before_after', 'facility', 'general']),
    title: z.string().trim().min(1).max(120),
    story: z.string().trim().max(3000).default(''),
    memberDisplayName: z.string().trim().max(100).default(''),
    imageUrl: mediaUrl.default(''),
    beforeUrl: mediaUrl.default(''),
    afterUrl: mediaUrl.default(''),
    durationWeeks: z.number().int().min(0).max(520).optional(),
    resultSummary: z.string().trim().max(120).default(''),
    consent: z.object({ given: z.boolean().default(false), reference: z.string().trim().max(200).default('') }).default({}),
    published: z.boolean().default(false),
    order,
  })
  .superRefine((v, ctx) => {
    const involvesMember = v.category === 'transformation' || v.category === 'before_after';
    if (involvesMember && v.published && !v.consent.given) {
      ctx.addIssue({ code: 'custom', path: ['consent', 'given'], message: 'Member consent must be recorded before publishing member images or stories' });
    }
    if (v.category === 'before_after' && (!v.beforeUrl || !v.afterUrl)) {
      ctx.addIssue({ code: 'custom', path: ['beforeUrl'], message: 'Before and after images are required' });
    }
  });

export const facilitySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(600).default(''),
  imageUrl: mediaUrl.default(''),
  icon: z.string().trim().max(40).default('dumbbell'),
  published: z.boolean().default(true),
  order,
});

export const testimonialSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subtitle: z.string().trim().max(100).default(''),
  quote: z.string().trim().min(1).max(1000),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: mediaUrl.default(''),
  published: z.boolean().default(true),
  order,
});

export const promotionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(600).default(''),
  ctaLabel: z.string().trim().max(40).default(''),
  ctaHref: safeHref.default(''),
  imageUrl: mediaUrl.default(''),
  placement: z.enum(['banner', 'popup']).default('banner'),
  couponCode: z.string().trim().toUpperCase().max(30).default(''),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  published: z.boolean().default(true),
  order,
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/).default(''),
  subject: z.string().trim().max(140).default(''),
  message: z.string().trim().min(5).max(3000),
  /** Honeypot: must be empty. */
  website: z.string().max(0).optional().default(''),
});

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm you want to receive emails' }) }),
  source: z.string().trim().max(40).default('website'),
  website: z.string().max(0).optional().default(''),
});

export const trialSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(30).regex(/^[+\d\s()-]+$/, 'Enter a valid phone number'),
  preferredDate: z.coerce.date().refine((d) => d.getTime() > Date.now() - 86400000 && d.getTime() < Date.now() + 60 * 86400000, 'Choose a date within the next 60 days'),
  goal: z.string().trim().max(200).default(''),
  programInterest: z.string().trim().max(100).default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree to be contacted about your trial' }) }),
  website: z.string().max(0).optional().default(''),
});
