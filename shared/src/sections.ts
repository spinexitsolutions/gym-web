import { z } from 'zod';
import { ctaSchema, mediaUrl, safeHref } from './common';
import { sceneConfigSchema } from './scene';

/**
 * CMS section registry.
 *
 * Every page is an ordered list of sections. Each section has a `type` that maps to:
 *  - a zod `props` schema (validated on the server on save/publish and on the client before rendering)
 *  - a list of `fields` the admin Section Builder uses to render an editing form
 *  - a React component on the client (client/src/features/sections/registry.tsx)
 *
 * To add a section type: add it here, then add a renderer on the client. See docs/cms.md.
 */

const text = (max = 120) => z.string().trim().max(max).default('');
const longText = (max = 2000) => z.string().trim().max(max).default('');

export const sectionBackground = z.object({
  variant: z.enum(['default', 'surface', 'gradient', 'image', 'contrast']).default('default'),
  imageUrl: mediaUrl.default(''),
  overlay: z.number().min(0).max(1).default(0.6),
});

const common = {
  eyebrow: text(60),
  heading: text(140),
  subheading: longText(400),
  anchorId: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/)
    .default(''),
  background: sectionBackground.default({}),
};

const statItem = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.number().min(0).max(10_000_000).default(0),
  suffix: z.string().trim().max(6).default(''),
  /** `manual` shows `value`; other metrics are calculated live from the database. */
  metric: z.enum(['manual', 'activeMembers', 'trainers', 'programs', 'classesThisWeek']).default('manual'),
});

const equipmentItem = z.object({
  title: z.string().trim().min(1).max(60),
  description: text(240),
  modelId: sceneConfigSchema.shape.modelId,
});

const galleryImage = z.object({ url: mediaUrl, alt: z.string().trim().max(160).default('') });

export const sectionPropsSchemas = {
  hero: z.object({
    ...common,
    headline: z.string().trim().min(1).max(120),
    subheadline: longText(300),
    ctas: z.array(ctaSchema).max(3).default([]),
    mediaType: z.enum(['scene', 'image', 'none']).default('scene'),
    imageUrl: mediaUrl.default(''),
    scene: sceneConfigSchema.default({}),
    align: z.enum(['left', 'center']).default('left'),
    showScrollHint: z.boolean().default(true),
  }),
  stats: z.object({ ...common, items: z.array(statItem).min(1).max(6) }),
  about: z.object({
    ...common,
    body: longText(3000),
    imageUrl: mediaUrl.default(''),
    imageAlt: text(160),
    bullets: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    cta: ctaSchema.optional(),
  }),
  programs: z.object({ ...common, limit: z.number().int().min(1).max(24).default(6), featuredOnly: z.boolean().default(false) }),
  equipment3d: z.object({
    ...common,
    items: z.array(equipmentItem).min(1).max(6),
    scene: sceneConfigSchema.default({ modelId: 'dumbbell' }),
  }),
  trainers: z.object({ ...common, limit: z.number().int().min(1).max(24).default(4) }),
  pricing: z.object({ ...common, highlightPlanSlug: text(80), showTrial: z.boolean().default(true) }),
  schedule: z.object({ ...common, days: z.number().int().min(1).max(14).default(7), limit: z.number().int().min(1).max(50).default(12) }),
  transformations: z.object({ ...common, limit: z.number().int().min(1).max(12).default(3) }),
  testimonials: z.object({ ...common, limit: z.number().int().min(1).max(24).default(6), showRatings: z.boolean().default(true) }),
  beforeAfter: z.object({ ...common, limit: z.number().int().min(1).max(12).default(4) }),
  facilities: z.object({ ...common, limit: z.number().int().min(1).max(24).default(8) }),
  bmi: z.object({ ...common, showCalorieEstimate: z.boolean().default(true) }),
  promo: z.object({
    ...common,
    body: longText(600),
    imageUrl: mediaUrl.default(''),
    cta: ctaSchema.optional(),
    endsAt: z.string().datetime().or(z.literal('')).default(''),
  }),
  blog: z.object({ ...common, limit: z.number().int().min(1).max(12).default(3) }),
  faq: z.object({ ...common, limit: z.number().int().min(1).max(50).default(8), category: text(40) }),
  location: z.object({ ...common, showMap: z.boolean().default(true), showHours: z.boolean().default(true) }),
  trialForm: z.object({ ...common, body: longText(600), successMessage: text(200) }),
  contact: z.object({ ...common, body: longText(600) }),
  newsletter: z.object({ ...common, body: longText(400) }),
  richText: z.object({ ...common, body: longText(10000), align: z.enum(['left', 'center']).default('left') }),
  cta: z.object({ ...common, body: longText(600), ctas: z.array(ctaSchema).max(3).default([]) }),
  imageText: z.object({
    ...common,
    body: longText(3000),
    imageUrl: mediaUrl.default(''),
    imageAlt: text(160),
    imageSide: z.enum(['left', 'right']).default('right'),
    ctas: z.array(ctaSchema).max(2).default([]),
  }),
  gallery: z.object({ ...common, images: z.array(galleryImage).max(24).default([]) }),
} as const;

export type SectionType = keyof typeof sectionPropsSchemas;
export const SECTION_TYPES = Object.keys(sectionPropsSchemas) as SectionType[];
export type SectionProps<T extends SectionType> = z.infer<(typeof sectionPropsSchemas)[T]>;

const sectionIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{4,40}$/);

export const sectionSchema = z.discriminatedUnion(
  'type',
  SECTION_TYPES.map((type) =>
    z.object({
      id: sectionIdSchema,
      type: z.literal(type),
      enabled: z.boolean().default(true),
      props: sectionPropsSchemas[type],
    }),
  ) as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]],
);

export type Section = {
  [K in SectionType]: { id: string; type: K; enabled: boolean; props: SectionProps<K> };
}[SectionType];

/** Loose shape used for drafts: drafts may be saved while incomplete, publish requires `sectionSchema`. */
export const draftSectionSchema = z.object({
  id: sectionIdSchema,
  type: z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]),
  enabled: z.boolean().default(true),
  props: z.record(z.unknown()).default({}),
});
export type DraftSection = z.infer<typeof draftSectionSchema>;

export const sectionsSchema = z.array(sectionSchema).max(60);

export function validateSections(sections: unknown[]): { ok: true; sections: Section[] } | { ok: false; errors: { index: number; id?: string; type?: string; issues: { path: string; message: string }[] }[] } {
  const errors: { index: number; id?: string; type?: string; issues: { path: string; message: string }[] }[] = [];
  const out: Section[] = [];
  sections.forEach((raw, index) => {
    const parsed = sectionSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data as unknown as Section);
    else {
      const r = raw as { id?: string; type?: string };
      errors.push({
        index,
        id: r?.id,
        type: r?.type,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
  });
  const ids = new Set<string>();
  out.forEach((s, index) => {
    if (ids.has(s.id)) errors.push({ index, id: s.id, type: s.type, issues: [{ path: 'id', message: 'Duplicate section id' }] });
    ids.add(s.id);
  });
  return errors.length ? { ok: false, errors } : { ok: true, sections: out };
}

/* ----------------------------- Admin form metadata ---------------------------- */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'image'
  | 'link'
  | 'datetime'
  | 'ctas'
  | 'cta'
  | 'scene'
  | 'stringList'
  | 'statItems'
  | 'equipmentItems'
  | 'galleryImages'
  | 'background'
  | 'model';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

const commonFields: FieldDef[] = [
  { key: 'eyebrow', label: 'Eyebrow (small label above heading)', type: 'text' },
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'subheading', label: 'Subheading', type: 'textarea' },
];
const tailFields: FieldDef[] = [
  { key: 'background', label: 'Background', type: 'background' },
  { key: 'anchorId', label: 'Anchor id (for #links)', type: 'text', help: 'Lowercase letters, numbers and hyphens' },
];
const limit = (max: number, label = 'Items to show'): FieldDef => ({ key: 'limit', label, type: 'number', min: 1, max });

export interface SectionMeta {
  label: string;
  description: string;
  /** Where the content comes from, shown in the builder. */
  dataSource?: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}

export const SECTION_META: Record<SectionType, SectionMeta> = {
  hero: {
    label: 'Hero',
    description: 'Full-screen cinematic hero with headline, CTAs and an optional 3D scene.',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'headline', label: 'Headline', type: 'text' },
      { key: 'subheadline', label: 'Subheadline', type: 'textarea' },
      { key: 'ctas', label: 'Buttons', type: 'ctas' },
      {
        key: 'mediaType',
        label: 'Media',
        type: 'select',
        options: [
          { value: 'scene', label: '3D scene' },
          { value: 'image', label: 'Image' },
          { value: 'none', label: 'None' },
        ],
      },
      { key: 'imageUrl', label: 'Hero image (used when media is Image, and as 3D fallback)', type: 'image' },
      { key: 'scene', label: '3D scene', type: 'scene' },
      { key: 'align', label: 'Text alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }] },
      { key: 'showScrollHint', label: 'Show scroll hint', type: 'boolean' },
      ...tailFields,
    ],
    defaults: {
      eyebrow: 'Performance club',
      headline: 'Forge the strongest version of you',
      subheadline: 'Elite coaching, precision equipment and a training floor engineered for results.',
      ctas: [
        { label: 'Explore Programs', href: '/programs', variant: 'primary' },
        { label: 'View Memberships', href: '/memberships', variant: 'secondary' },
        { label: 'Book a Free Trial', href: '#trial', variant: 'ghost' },
      ],
      mediaType: 'scene',
      scene: {},
    },
  },
  stats: {
    label: 'Animated statistics',
    description: 'Counters that animate into view. Values can be manual or calculated live.',
    fields: [...commonFields, { key: 'items', label: 'Statistics', type: 'statItems' }, ...tailFields],
    defaults: {
      items: [
        { label: 'Active members', value: 1200, suffix: '+', metric: 'manual' },
        { label: 'Expert coaches', value: 18, suffix: '', metric: 'manual' },
        { label: 'Years of experience', value: 12, suffix: '', metric: 'manual' },
        { label: 'Competition podiums', value: 140, suffix: '+', metric: 'manual' },
      ],
    },
  },
  about: {
    label: 'About',
    description: 'Story block with image, body copy and highlights.',
    fields: [
      ...commonFields,
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'imageUrl', label: 'Image', type: 'image' },
      { key: 'imageAlt', label: 'Image alt text', type: 'text' },
      { key: 'bullets', label: 'Highlights', type: 'stringList' },
      { key: 'cta', label: 'Button', type: 'cta' },
      ...tailFields,
    ],
    defaults: { heading: 'Built for people who train with intent', body: '' },
  },
  programs: {
    label: 'Training programs',
    description: 'Cards for programs managed under CMS → Programs.',
    dataSource: 'Programs',
    fields: [...commonFields, limit(24), { key: 'featuredOnly', label: 'Featured programs only', type: 'boolean' }, ...tailFields],
    defaults: { heading: 'Programs', limit: 6 },
  },
  equipment3d: {
    label: '3D equipment showcase',
    description: 'Interactive 3D showcase. Visitors switch between installed models.',
    fields: [...commonFields, { key: 'items', label: 'Equipment', type: 'equipmentItems' }, { key: 'scene', label: 'Scene settings', type: 'scene' }, ...tailFields],
    defaults: {
      heading: 'Precision equipment',
      items: [
        { title: 'Hex dumbbells', description: 'Knurled chrome handles, 2.5–60 kg.', modelId: 'dumbbell' },
        { title: 'Competition kettlebells', description: 'Uniform size at every weight.', modelId: 'kettlebell' },
        { title: 'Olympic barbells', description: '20 kg, needle bearings, IWF spec.', modelId: 'barbell' },
      ],
      scene: { modelId: 'dumbbell' },
    },
  },
  trainers: {
    label: 'Trainers',
    description: 'Public trainer profiles (Trainers marked “show on website”).',
    dataSource: 'Trainers',
    fields: [...commonFields, limit(24), ...tailFields],
    defaults: { heading: 'Coaches', limit: 4 },
  },
  pricing: {
    label: 'Membership pricing',
    description: 'Active membership plans, priced from the database.',
    dataSource: 'Membership plans',
    fields: [
      ...commonFields,
      { key: 'highlightPlanSlug', label: 'Highlight plan (slug)', type: 'text' },
      { key: 'showTrial', label: 'Show trial plans', type: 'boolean' },
      ...tailFields,
    ],
    defaults: { heading: 'Memberships', showTrial: true },
  },
  schedule: {
    label: 'Class schedule preview',
    description: 'Upcoming scheduled classes.',
    dataSource: 'Classes',
    fields: [...commonFields, { key: 'days', label: 'Days ahead', type: 'number', min: 1, max: 14 }, limit(50, 'Max classes'), ...tailFields],
    defaults: { heading: 'This week on the floor', days: 7, limit: 12 },
  },
  transformations: {
    label: 'Transformation stories',
    description: 'Member stories from the Gallery (category: transformation, consent recorded).',
    dataSource: 'Gallery',
    fields: [...commonFields, limit(12), ...tailFields],
    defaults: { heading: 'Transformations', limit: 3 },
  },
  testimonials: {
    label: 'Testimonials',
    description: 'Approved testimonials with ratings.',
    dataSource: 'Testimonials',
    fields: [...commonFields, limit(24), { key: 'showRatings', label: 'Show ratings', type: 'boolean' }, ...tailFields],
    defaults: { heading: 'What members say', limit: 6 },
  },
  beforeAfter: {
    label: 'Before & after gallery',
    description: 'Before/after comparison sliders. Only items with recorded member consent are shown.',
    dataSource: 'Gallery',
    fields: [...commonFields, limit(12), ...tailFields],
    defaults: { heading: 'Before & after', limit: 4 },
  },
  facilities: {
    label: 'Facilities & amenities',
    description: 'Facilities managed under CMS → Facilities.',
    dataSource: 'Facilities',
    fields: [...commonFields, limit(24), ...tailFields],
    defaults: { heading: 'The facility', limit: 8 },
  },
  bmi: {
    label: 'BMI & calorie calculator',
    description: 'BMI calculator with clear limitations and an optional calorie estimate.',
    fields: [...commonFields, { key: 'showCalorieEstimate', label: 'Show calorie estimate', type: 'boolean' }, ...tailFields],
    defaults: { heading: 'Know your numbers', showCalorieEstimate: true },
  },
  promo: {
    label: 'Promotional banner',
    description: 'Time-limited offer with optional countdown.',
    fields: [
      ...commonFields,
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'imageUrl', label: 'Image', type: 'image' },
      { key: 'cta', label: 'Button', type: 'cta' },
      { key: 'endsAt', label: 'Offer ends at', type: 'datetime' },
      ...tailFields,
    ],
    defaults: { heading: 'Limited offer', body: '' },
  },
  blog: {
    label: 'Blog & articles',
    description: 'Latest published blog posts.',
    dataSource: 'Blog',
    fields: [...commonFields, limit(12), ...tailFields],
    defaults: { heading: 'From the journal', limit: 3 },
  },
  faq: {
    label: 'FAQ',
    description: 'Accordion of published FAQs.',
    dataSource: 'FAQs',
    fields: [...commonFields, limit(50), { key: 'category', label: 'Category filter (optional)', type: 'text' }, ...tailFields],
    defaults: { heading: 'Questions, answered', limit: 8 },
  },
  location: {
    label: 'Location & map',
    description: 'Address, opening hours and map from Settings.',
    dataSource: 'Settings',
    fields: [...commonFields, { key: 'showMap', label: 'Show map', type: 'boolean' }, { key: 'showHours', label: 'Show opening hours', type: 'boolean' }, ...tailFields],
    defaults: { heading: 'Find us', showMap: true, showHours: true },
  },
  trialForm: {
    label: 'Free trial booking',
    description: 'Form that creates a trial booking request.',
    fields: [...commonFields, { key: 'body', label: 'Body', type: 'textarea' }, { key: 'successMessage', label: 'Success message', type: 'text' }, ...tailFields],
    defaults: { heading: 'Book a free trial session', anchorId: 'trial' },
  },
  contact: {
    label: 'Contact',
    description: 'Contact form plus contact details from Settings.',
    fields: [...commonFields, { key: 'body', label: 'Body', type: 'textarea' }, ...tailFields],
    defaults: { heading: 'Talk to us', anchorId: 'contact' },
  },
  newsletter: {
    label: 'Newsletter',
    description: 'Email signup with consent.',
    fields: [...commonFields, { key: 'body', label: 'Body', type: 'textarea' }, ...tailFields],
    defaults: { heading: 'Training notes, monthly' },
  },
  richText: {
    label: 'Rich text',
    description: 'Free-form text. Supports **bold**, _italic_, lists and links (Markdown).',
    fields: [...commonFields, { key: 'body', label: 'Body (Markdown)', type: 'textarea' }, { key: 'align', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }] }, ...tailFields],
    defaults: { heading: 'Heading', body: '' },
  },
  cta: {
    label: 'Call to action',
    description: 'Bold call to action with buttons.',
    fields: [...commonFields, { key: 'body', label: 'Body', type: 'textarea' }, { key: 'ctas', label: 'Buttons', type: 'ctas' }, ...tailFields],
    defaults: { heading: 'Ready when you are', ctas: [{ label: 'Join Now', href: '/memberships', variant: 'primary' }] },
  },
  imageText: {
    label: 'Image + text',
    description: 'Two-column image and copy.',
    fields: [
      ...commonFields,
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'imageUrl', label: 'Image', type: 'image' },
      { key: 'imageAlt', label: 'Image alt text', type: 'text' },
      { key: 'imageSide', label: 'Image side', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
      { key: 'ctas', label: 'Buttons', type: 'ctas' },
      ...tailFields,
    ],
    defaults: { heading: 'Heading', body: '' },
  },
  gallery: {
    label: 'Image gallery',
    description: 'Grid of images from the media library.',
    fields: [...commonFields, { key: 'images', label: 'Images', type: 'galleryImages' }, ...tailFields],
    defaults: { heading: 'Inside the club', images: [] },
  },
};

export function newSectionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `s_${Date.now().toString(36)}${rand}`.slice(0, 32);
}

/** Builds a section with defaults applied (validates when possible, falls back to raw defaults for drafts). */
export function createSection(type: SectionType, overrides: Record<string, unknown> = {}): DraftSection {
  const props = { ...SECTION_META[type].defaults, ...overrides };
  const parsed = sectionPropsSchemas[type].safeParse(props);
  return { id: newSectionId(), type, enabled: true, props: parsed.success ? (parsed.data as Record<string, unknown>) : props };
}
