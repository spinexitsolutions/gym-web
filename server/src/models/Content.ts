import { Schema, model, type InferSchemaType } from 'mongoose';

/** Public website content collections managed in the CMS. */

const programSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, maxlength: 300 },
    description: { type: String, maxlength: 4000 },
    imageUrl: { type: String, maxlength: 1000, default: '' },
    level: { type: String, enum: ['all', 'beginner', 'intermediate', 'advanced'], default: 'all' },
    durationWeeks: { type: Number, min: 1, max: 104 },
    sessionsPerWeek: { type: Number, min: 1, max: 14 },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);
export type Program = InferSchemaType<typeof programSchema>;
export const ProgramModel = model('Program', programSchema);

const faqSchema = new Schema(
  {
    question: { type: String, required: true, maxlength: 300 },
    answer: { type: String, required: true, maxlength: 3000 },
    category: { type: String, maxlength: 40, default: 'general' },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);
export const FaqModel = model('Faq', faqSchema);

const galleryItemSchema = new Schema(
  {
    category: { type: String, enum: ['transformation', 'before_after', 'facility', 'general'], required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    story: { type: String, maxlength: 3000 },
    memberDisplayName: { type: String, maxlength: 100 },
    imageUrl: { type: String, maxlength: 1000, default: '' },
    beforeUrl: { type: String, maxlength: 1000, default: '' },
    afterUrl: { type: String, maxlength: 1000, default: '' },
    durationWeeks: { type: Number, min: 0, max: 520 },
    resultSummary: { type: String, maxlength: 120 },
    /** Member images may only be published with recorded consent. Enforced on save and on public reads. */
    consent: {
      given: { type: Boolean, default: false },
      recordedAt: Date,
      recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reference: { type: String, maxlength: 200 },
    },
    published: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);
export const GalleryItemModel = model('GalleryItem', galleryItemSchema);

const facilitySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 600 },
    imageUrl: { type: String, maxlength: 1000, default: '' },
    icon: { type: String, maxlength: 40, default: 'dumbbell' },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);
export const FacilityModel = model('Facility', facilitySchema);

const promotionSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 600 },
    ctaLabel: { type: String, maxlength: 40 },
    ctaHref: { type: String, maxlength: 500 },
    imageUrl: { type: String, maxlength: 1000, default: '' },
    placement: { type: String, enum: ['banner', 'popup'], default: 'banner' },
    couponCode: { type: String, maxlength: 30 },
    startsAt: Date,
    endsAt: Date,
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);
export const PromotionModel = model('Promotion', promotionSchema);

const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    consentAt: { type: Date, required: true },
    source: { type: String, maxlength: 40 },
    unsubscribeTokenHash: { type: String, select: false },
  },
  { timestamps: true },
);
export const NewsletterSubscriberModel = model('NewsletterSubscriber', newsletterSubscriberSchema);

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 254 },
    phone: { type: String, maxlength: 30 },
    subject: { type: String, maxlength: 140 },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ['new', 'read', 'archived'], default: 'new', index: true },
  },
  { timestamps: true },
);
export const ContactMessageModel = model('ContactMessage', contactMessageSchema);
