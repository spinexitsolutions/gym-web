import { z } from 'zod';
import { image, objectId, safeUrl } from './common.js';
import { PROGRAM_CATEGORIES } from '../models/index.js';

const text = (max, min = 0) => z.string().trim().min(min).max(max);
const opt = (max) => z.string().trim().max(max).optional();
const strList = (max, n = 20) => z.array(z.string().trim().min(1).max(max)).max(n);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const paise = z.coerce.number().int().min(0).max(1e9);
const order = z.coerce.number().int().min(0).max(10000).default(0);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and hyphens only').max(100).optional();

export const planSchema = z.object({
  name: text(60, 1), slug, tier: z.enum(['basic', 'standard', 'premium', 'elite']), tagline: opt(120), description: opt(1000),
  benefits: strList(120, 20).default([]),
  comparison: z.array(z.object({ label: text(80, 1), value: text(40) })).max(30).default([]),
  pricing: z.array(z.object({ period: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']), pricePaise: paise, discountPercent: z.coerce.number().min(0).max(90).default(0) }))
    .min(1, 'Add at least one price').max(4)
    .refine((a) => new Set(a.map((p) => p.period)).size === a.length, 'Each billing period can be listed once'),
  joiningFeePaise: paise.default(0),
  limits: z.object({ ptSessionsPerMonth: z.coerce.number().int().min(0).max(100).default(0), classesPerWeek: z.coerce.number().int().min(0).max(50).default(0), guestPassesPerMonth: z.coerce.number().int().min(0).max(30).default(0) }).default({}),
  isFeatured: z.boolean().default(false), isActive: z.boolean().default(true), status: z.enum(['draft', 'published']).default('draft'), order,
});

export const trainerSchema = z.object({
  user: objectId.nullable().optional(),
  name: text(80, 2), slug, title: opt(80), photo: image.optional(), bio: opt(2000),
  specializations: strList(60).default([]), qualifications: strList(120).default([]), languages: strList(30, 10).default([]),
  certifications: z.array(z.object({ name: text(120, 1), issuer: opt(120), year: z.coerce.number().int().min(1970).max(2100).optional() })).max(20).default([]),
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
  availability: z.array(z.object({ dayOfWeek: z.coerce.number().int().min(0).max(6), start: time, end: time }).refine((s) => s.start < s.end, 'End must be after start')).max(50).default([]),
  sessionDurationMin: z.coerce.number().int().min(15).max(180).default(60), ptPricePaise: paise.default(0),
  social: z.object({ instagram: safeUrl.optional(), linkedin: safeUrl.optional() }).optional(),
  isFeatured: z.boolean().default(false), isActive: z.boolean().default(true), order,
});

export const programSchema = z.object({
  title: text(100, 2), slug, category: z.enum(PROGRAM_CATEGORIES), summary: opt(240), description: opt(5000),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']), durationWeeks: z.coerce.number().int().min(1).max(104),
  sessionsPerWeek: z.coerce.number().int().min(1).max(14).default(3), sessionLengthMin: z.coerce.number().int().min(10).max(240).default(60),
  highlights: strList(120, 10).default([]), image: image.optional(), trainers: z.array(objectId).max(20).default([]), eligiblePlans: z.array(objectId).max(10).default([]),
  isFeatured: z.boolean().default(false), isActive: z.boolean().default(true), order,
});

export const testimonialSchema = z.object({
  name: text(80, 1), headline: opt(120), quote: text(1000, 5), rating: z.coerce.number().int().min(1).max(5).default(5), photo: image.optional(),
  memberSince: opt(20), consentConfirmed: z.boolean().default(false), isDemo: z.boolean().default(false), isPublished: z.boolean().default(false), order,
});

export const galleryBase = z.object({
  title: opt(120), caption: opt(300), category: z.enum(['gym', 'facility', 'equipment', 'event', 'transformation']).default('gym'),
  image: image.optional(), beforeImage: image.optional(), afterImage: image.optional(), memberName: opt(80), durationLabel: opt(40),
  consentConfirmed: z.boolean().default(false), isPublished: z.boolean().default(true), order,
});
export const gallerySchema = galleryBase.refine((g) => (g.category === 'transformation' ? g.beforeImage?.url && g.afterImage?.url : g.image?.url), 'Upload the required image(s) for this category');

export const faqSchema = z.object({ question: text(200, 3), answer: text(2000, 3), category: opt(40), isPublished: z.boolean().default(true), order });

export const eventBase = z.object({
  title: text(120, 2), slug, kind: z.enum(['event', 'challenge']).default('event'), description: opt(3000), image: image.optional(), location: opt(120),
  startDate: z.coerce.date(), endDate: z.coerce.date(), metric: z.enum(['none', 'attendance', 'manual']).default('none'), unit: opt(20),
  isPublished: z.boolean().default(false),
});
export const eventSchema = eventBase.refine((e) => e.endDate >= e.startDate, { path: ['endDate'], message: 'End must be on or after start' });

export const announcementSchema = z.object({
  title: text(120, 2), body: opt(3000), audience: z.enum(['public', 'members', 'staff']).default('members'), showAsBanner: z.boolean().default(false),
  link: z.object({ label: opt(40), href: safeUrl.optional() }).optional(), sendEmail: z.boolean().default(false),
  startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), status: z.enum(['draft', 'published']).default('draft'),
});

export const blogSchema = z.object({
  title: text(160, 3), slug, excerpt: opt(300), content: z.string().max(50000).default(''), coverImage: image.optional(),
  tags: strList(30, 10).default([]), status: z.enum(['draft', 'published']).default('draft'),
  seo: z.object({ title: opt(70), description: opt(170) }).optional(),
});

export const couponBase = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, '3–30 letters, numbers, - or _'), description: opt(200),
  discountType: z.enum(['percent', 'fixed']), value: z.coerce.number().min(0), maxDiscountPaise: paise.optional(), minAmountPaise: paise.default(0),
  validFrom: z.coerce.date().nullable().optional(), validTo: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(), perUserLimit: z.coerce.number().int().min(0).default(1),
  applicablePlans: z.array(objectId).max(10).default([]), isActive: z.boolean().default(true),
});
export const couponSchema = couponBase.refine((c) => c.discountType !== 'percent' || c.value <= 100, { path: ['value'], message: 'Percent cannot exceed 100' });

export const classBase = z.object({
  title: text(100, 2), program: objectId.nullable().optional(), trainer: objectId, description: opt(1000), location: opt(80),
  startAt: z.coerce.date(), endAt: z.coerce.date(), capacity: z.coerce.number().int().min(1).max(500), waitlistLimit: z.coerce.number().int().min(0).max(100).default(10),
  eligiblePlans: z.array(objectId).max(10).default([]),
});
export const classSchema = classBase.refine((c) => c.endAt > c.startAt, { path: ['endAt'], message: 'End must be after start' });

export const inquiryUpdateSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'spam']).optional(),
  assignedTo: objectId.nullable().optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});
