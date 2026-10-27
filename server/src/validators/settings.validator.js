import { z } from 'zod';
import { image, safeUrl } from './common.js';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #C9A54C');
const cta = z.object({ label: z.string().max(40), href: safeUrl });
const FONTS = ['Playfair Display', 'Cormorant Garamond', 'Bebas Neue', 'Oswald', 'Inter', 'Manrope', 'Montserrat', 'Outfit'];

export const siteSettingsSchema = z.object({
  brand: z.object({
    name: z.string().min(1).max(60),
    tagline: z.string().max(120),
    logo: image,
    logoDark: image, // optional variant for light theme
    favicon: image,
  }),
  theme: z.object({
    defaultMode: z.enum(['dark', 'light']),
    allowToggle: z.boolean(),
    accent: hex,
    accentSoft: hex,
    background: hex,
    surface: hex,
    headingFont: z.enum(FONTS),
    bodyFont: z.enum(FONTS),
    radius: z.enum(['none', 'sm', 'md', 'lg']),
  }),
  announcementBar: z.object({
    enabled: z.boolean(),
    text: z.string().max(160),
    link: cta,
  }),
  hero: z.object({
    eyebrow: z.string().max(60),
    title: z.string().min(1).max(120),
    highlight: z.string().max(60), // part of the title rendered in gold
    subtitle: z.string().max(300),
    primaryCta: cta,
    secondaryCta: cta,
    backgroundImage: image,
    backgroundVideo: z.object({ url: safeUrl.default(''), publicId: z.string().optional() }),
    overlayOpacity: z.number().min(0).max(0.95),
    show3d: z.boolean(),
  }),
  stats: z.object({
    // 'live' counts come from the database; 'manual' values are typed by the admin (and shown as such).
    source: z.enum(['live', 'manual']),
    items: z
      .array(z.object({
          // key ties an item to a live database count when source = 'live'
          key: z.enum(['members', 'trainers', 'programs', 'transformations', 'custom']).default('custom'),
          label: z.string().max(40),
          value: z.number().min(0),
          suffix: z.string().max(4),
        }))
      .max(6),
  }),
  about: z.object({
    eyebrow: z.string().max(60),
    title: z.string().max(120),
    body: z.string().max(3000),
    story: z.string().max(5000),
    mission: z.string().max(600),
    vision: z.string().max(600),
    image: image,
    secondaryImage: image,
    highlights: z.array(z.string().max(80)).max(8),
  }),
  facilities: z
    .array(z.object({ title: z.string().max(60), description: z.string().max(300), image, icon: z.string().max(30) }))
    .max(16),
  certifications: z.array(z.object({ title: z.string().max(80), issuer: z.string().max(80), year: z.string().max(10) })).max(16),
  safety: z.array(z.object({ title: z.string().max(60), description: z.string().max(300) })).max(12),
  contact: z.object({
    address: z.string().max(300),
    city: z.string().max(80),
    phone: z.string().max(30),
    email: z.string().max(254),
    whatsapp: z.string().max(20), // digits incl. country code, e.g. 919876543210
    whatsappMessage: z.string().max(200),
    mapQuery: z.string().max(300), // used for the Google Maps embed
    hours: z.array(z.object({ days: z.string().max(40), open: z.string().max(10), close: z.string().max(10) })).max(10),
  }),
  social: z.object({
    instagram: safeUrl,
    facebook: safeUrl,
    youtube: safeUrl,
    x: safeUrl,
    linkedin: safeUrl,
  }),
  footer: z.object({
    blurb: z.string().max(400),
    copyright: z.string().max(120),
    links: z.array(cta).max(12),
  }),
  newsletter: z.object({ enabled: z.boolean(), title: z.string().max(80), subtitle: z.string().max(200) }),
  membershipPolicy: z.object({
    terms: z.string().max(8000),
    cancellation: z.string().max(4000),
    refund: z.string().max(4000),
  }),
  sections: z.object({
    // Toggle homepage sections without code changes.
    stats: z.boolean(),
    about: z.boolean(),
    facilities: z.boolean(),
    trainers: z.boolean(),
    plans: z.boolean(),
    programs: z.boolean(),
    transformations: z.boolean(),
    testimonials: z.boolean(),
    events: z.boolean(),
    tools: z.boolean(),
    faq: z.boolean(),
    contact: z.boolean(),
    newsletter: z.boolean(),
  }),
  seo: z.object({
    title: z.string().max(70),
    description: z.string().max(170),
    keywords: z.string().max(300),
    ogImage: image,
    siteUrl: safeUrl,
  }),
});

// Admin saves may send any subset of sections; deep-partial is merged onto the current draft.
export const siteSettingsPatchSchema = siteSettingsSchema.deepPartial();
