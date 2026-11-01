/* ──────────────────────────────────────────────────────────────
   Shared types — the whole site is driven by `SiteContent`
   which the admin CMS edits. CRM data lives alongside it.
   ────────────────────────────────────────────────────────────── */

export type SectionId =
  | "manifesto"
  | "stats"
  | "programs"
  | "reveal"
  | "trainers"
  | "schedule"
  | "pricing"
  | "bmi"
  | "testimonials"
  | "gallery"
  | "faq"
  | "join";

export interface SectionToggle {
  id: SectionId;
  label: string;
  enabled: boolean;
}

export type IntroStyle = "counter" | "words" | "minimal";

export interface IntroSettings {
  enabled: boolean;
  style: IntroStyle;
  words: string[];
  durationMs: number;
  oncePerSession: boolean;
}

export interface BrandSettings {
  name: string;
  shortName: string;
  tagline: string;
  accent: string;
  /** "dark" = moody iron, "light" = chalk-white */
  theme: "dark" | "light";
  announcement: { enabled: boolean; text: string; link: string };
  cursor: boolean;
  smoothScroll: boolean;
}

export interface HeroContent {
  eyebrow: string;
  lines: string[];
  /** word in the headline rendered in italic serif + accent */
  highlight: string;
  subtitle: string;
  image: string;
  primaryCta: string;
  secondaryCta: string;
  marquee: string[];
}

export interface Program {
  id: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  duration: string;
  intensity: number; // 1–5
  tags: string[];
}

export interface Trainer {
  id: string;
  name: string;
  role: string;
  image: string;
  experience: string;
  speciality: string;
  instagram: string;
}

export interface Plan {
  id: string;
  name: string;
  monthly: number;
  yearly: number;
  description: string;
  features: string[];
  featured: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatar: string;
  result: string;
}

export interface GalleryItem {
  id: string;
  image: string;
  caption: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface Principle {
  id: string;
  title: string;
  text: string;
}

export interface Stat {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

export interface ScheduleSlot {
  id: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  time: string;
  className: string;
  coach: string;
  spots: number;
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapUrl: string;
  hoursWeekday: string;
  hoursWeekend: string;
  openHour: number;
  closeHour: number;
  instagram: string;
  youtube: string;
  facebook: string;
}

export interface SiteContent {
  brand: BrandSettings;
  intro: IntroSettings;
  hero: HeroContent;
  sections: SectionToggle[];
  manifesto: {
    eyebrow: string;
    title: string;
    /** each principle = one plate loaded on the bar (max 4 per side shown) */
    principles: Principle[];
    closing: string;
  };
  stats: Stat[];
  programs: Program[];
  reveal: { eyebrow: string; title: string; text: string; image: string };
  trainers: Trainer[];
  schedule: ScheduleSlot[];
  plans: Plan[];
  currency: string;
  testimonials: Testimonial[];
  gallery: GalleryItem[];
  faqs: FaqItem[];
  join: { title: string; subtitle: string; goals: string[]; image: string };
  contact: ContactInfo;
  seo: { title: string; description: string };
}

/* ───────────────────────────── CRM ───────────────────────────── */

export type LeadStage = "new" | "contacted" | "trial" | "won" | "lost";

export interface LeadNote {
  id: string;
  text: string;
  at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  goal: string;
  preferredTime: string;
  message: string;
  source: string;
  stage: LeadStage;
  value: number;
  notes: LeadNote[];
  createdAt: string;
  updatedAt: string;
}

export type MemberStatus = "active" | "frozen" | "expired";

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  plan: string;
  status: MemberStatus;
  joinedAt: string;
  expiresAt: string;
  trainer: string;
  checkIns: number;
  notes: string;
}

export interface Database {
  content: SiteContent;
  leads: Lead[];
  members: Member[];
}

export const LEAD_STAGES: { id: LeadStage; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "#0A84FF" },
  { id: "contacted", label: "Contacted", tone: "#BF5AF2" },
  { id: "trial", label: "Trial booked", tone: "#FF9F0A" },
  { id: "won", label: "Won", tone: "#30D158" },
  { id: "lost", label: "Lost", tone: "#8E8E93" },
];
