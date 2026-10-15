import type { Permission, Role, SceneConfig, SiteSettings, ThemeTokens, DraftSection, Seo } from '@apex/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  status: 'active' | 'suspended' | 'pending';
  phone: string;
  avatarUrl: string;
  emailVerified: boolean;
  notificationPrefs: { email: boolean; whatsapp: boolean; marketing: boolean };
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
  kind: 'procedural' | 'gltf';
  url: string | null;
}

export interface SiteBootstrap {
  settings: Omit<SiteSettings, 'notifications'>;
  theme: ThemeTokens;
  nav: { slug: string; title: string }[];
  promotions: Promotion[];
  models: ModelOption[];
  payments: { provider: 'razorpay' | 'sandbox' | 'disabled'; keyId?: string; testMode?: boolean };
  contentVersion: number;
}

export interface PublishedPage {
  id: string;
  slug: string;
  isHome: boolean;
  title: string;
  seo: Seo;
  featuredImage: string;
  version: number;
  publishedAt: string;
  sections: DraftSection[];
}

export interface Plan {
  _id: string;
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  durationDays: number;
  priceMinor: number;
  compareAtMinor?: number | null;
  currency: 'INR';
  benefits: string[];
  limits: { classesPerWeek: number | null; ptSessions: number; guestPasses: number };
  isTrial: boolean;
  promoLabel?: string;
  highlight: boolean;
  active: boolean;
  order: number;
  cancellationPolicy?: string;
  refundableDays?: number;
}

export interface Program {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  imageUrl?: string;
  level: 'all' | 'beginner' | 'intermediate' | 'advanced';
  durationWeeks?: number;
  sessionsPerWeek?: number;
  tags: string[];
  featured: boolean;
  published: boolean;
  order: number;
}

export interface TrainerPublic {
  id: string;
  slug: string;
  displayName: string;
  title?: string;
  bio?: string;
  specializations: string[];
  certifications: string[];
  experienceYears: number;
  photoUrl?: string;
  instagram?: string;
  ptSessionMinutes?: number;
}

export interface ClassItem {
  id: string;
  title: string;
  description?: string;
  trainer: { id: string; name: string } | null;
  program?: { title: string; slug: string } | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  spotsLeft: number;
  waitlistCount: number;
  location?: string;
  level: string;
  status: 'scheduled' | 'cancelled' | 'completed';
}

export interface Faq { _id: string; question: string; answer: string; category: string }
export interface Facility { _id: string; name: string; description?: string; imageUrl?: string; icon: string }
export interface Testimonial { _id: string; name: string; subtitle?: string; quote: string; rating: number; avatarUrl?: string }
export interface GalleryItem {
  _id: string;
  category: 'transformation' | 'before_after' | 'facility' | 'general';
  title: string;
  story?: string;
  memberDisplayName?: string;
  imageUrl?: string;
  beforeUrl?: string;
  afterUrl?: string;
  durationWeeks?: number;
  resultSummary?: string;
}
export interface Promotion { _id: string; title: string; body?: string; ctaLabel?: string; ctaHref?: string; imageUrl?: string; placement: 'banner' | 'popup'; couponCode?: string; endsAt?: string | null }
export interface BlogPostSummary { _id: string; title: string; slug: string; excerpt?: string; coverImage?: string; category?: string; tags: string[]; authorName?: string; publishedAt: string; readingMinutes: number }
export interface BlogPost extends BlogPostSummary { content: string; seo?: Seo }

export interface MembershipView {
  id: string;
  plan: string;
  planName: string;
  isTrial: boolean;
  status: 'upcoming' | 'active' | 'expired' | 'cancelled' | 'upgraded' | 'refunded';
  startDate: string;
  endDate: string;
  daysLeft: number | null;
  source: 'online' | 'offline' | 'admin' | 'trial';
  payment: string | null;
  cancellationRequestedAt: string | null;
  createdAt: string;
}

export interface PaymentView {
  id: string;
  planName: string;
  plan: string | null;
  membership: string | null;
  provider: 'razorpay' | 'sandbox' | 'offline';
  method: string | null;
  mode: 'new' | 'renewal' | 'upgrade';
  orderId: string | null;
  providerPaymentId: string | null;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  couponCode: string | null;
  status: 'created' | 'pending' | 'captured' | 'failed' | 'refunded' | 'partially_refunded' | 'expired';
  failureReason: string | null;
  receiptNumber: string | null;
  capturedAt: string | null;
  refund: { status: string; amountMinor: number } | null;
  createdAt: string;
}

export interface Booking {
  _id: string;
  type: 'class' | 'personal_training' | 'trial';
  user?: { _id: string; name: string; email?: string; phone?: string } | string;
  guest?: { name?: string; email?: string; phone?: string };
  gymClass?: { _id: string; title: string; location?: string } | null;
  trainer?: { _id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  status: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';
  active: boolean;
  notes?: string;
  goal?: string;
  createdAt: string;
}

export interface NotificationItem { _id: string; type: string; title: string; body?: string; link?: string; readAt?: string | null; createdAt: string }

export type { SceneConfig, SiteSettings, ThemeTokens, DraftSection };
