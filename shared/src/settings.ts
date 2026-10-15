import { z } from 'zod';
import { mediaUrl, safeHref, seoSchema } from './common';

const dayHours = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closed: z.boolean().default(false),
});

export const siteSettingsSchema = z.object({
  brand: z.object({
    name: z.string().trim().min(1).max(60),
    shortName: z.string().trim().max(20).default(''),
    logoUrl: mediaUrl.default(''),
    logoAlt: z.string().trim().max(120).default(''),
    faviconUrl: mediaUrl.default(''),
  }),
  announcement: z.object({
    enabled: z.boolean().default(false),
    text: z.string().trim().max(160).default(''),
    href: safeHref.default(''),
  }),
  contact: z.object({
    email: z.string().trim().email().or(z.literal('')).default(''),
    phone: z.string().trim().max(30).default(''),
    whatsapp: z.string().trim().max(30).default(''),
    addressLine: z.string().trim().max(200).default(''),
    city: z.string().trim().max(80).default(''),
    region: z.string().trim().max(80).default(''),
    postalCode: z.string().trim().max(20).default(''),
    country: z.string().trim().max(2).default('IN'),
  }),
  location: z.object({
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    /** Optional Google Maps embed URL (must be https://www.google.com/maps/embed?...). */
    mapEmbedUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https:\/\/(www\.)?google\.com\/maps\/embed\?/.test(v), 'Must be a Google Maps embed URL')
      .default(''),
    directionsUrl: safeHref.default(''),
  }),
  hours: z.array(dayHours).max(7).default([]),
  social: z
    .object({
      instagram: safeHref.default(''),
      facebook: safeHref.default(''),
      youtube: safeHref.default(''),
      x: safeHref.default(''),
      linkedin: safeHref.default(''),
    })
    .default({}),
  business: z.object({
    legalName: z.string().trim().max(120).default(''),
    gstin: z.string().trim().max(20).default(''),
    currency: z.literal('INR').default('INR'),
    timezone: z.string().trim().default('Asia/Kolkata'),
    foundedYear: z.number().int().min(1900).max(2100).nullable().default(null),
  }),
  seo: seoSchema.extend({ siteUrl: z.string().trim().url().or(z.literal('')).default(''), titleTemplate: z.string().max(60).default('%s | Apex Athletics') }),
  notifications: z.object({
    emailEnabled: z.boolean().default(true),
    whatsappEnabled: z.boolean().default(false),
    expiryReminderDays: z.array(z.number().int().min(1).max(60)).max(5).default([7, 3, 1]),
    classReminderHours: z.number().int().min(1).max(48).default(12),
    adminAlertEmail: z.string().trim().email().or(z.literal('')).default(''),
  }),
  privacy: z.object({
    requireConsentForTransformations: z.literal(true).default(true),
    cookieBanner: z.boolean().default(true),
    privacyPolicyUrl: safeHref.default('/privacy'),
    termsUrl: safeHref.default('/terms'),
    dataRetentionNote: z.string().trim().max(500).default(''),
  }),
  bookings: z.object({
    cancellationWindowHours: z.number().int().min(0).max(72).default(4),
    rescheduleWindowHours: z.number().int().min(0).max(72).default(4),
    maxActiveBookingsPerMember: z.number().int().min(1).max(50).default(8),
    allowWaitlist: z.boolean().default(true),
  }),
  loyalty: z.object({
    enabled: z.boolean().default(true),
    pointsPerCheckIn: z.number().int().min(0).max(100).default(5),
    referralRewardPoints: z.number().int().min(0).max(10000).default(200),
  }),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export const siteSettingsUpdateSchema = siteSettingsSchema.deepPartial();
