/**
 * Section renderer registry: one React component per CMS section type (SECTION_TYPES in
 * shared/src/sections.ts). Props arrive already validated + defaulted by PageRenderer.
 * To add a section type: add its schema/meta in shared, then a renderer here.
 */
import type { ComponentType } from 'react';
import type { SectionProps, SectionType } from '@apex/shared';
import { AboutSection, CtaSection, GallerySection, ImageTextSection, PromoSection, RichTextSection } from './sections/ContentSections';
import { BeforeAfterSection, BlogSection, FacilitiesSection, FaqSection, PricingSection, ProgramsSection, ScheduleSection, TestimonialsSection, TrainersSection, TransformationsSection } from './sections/DataSections';
import { HeroSection } from './sections/HeroSection';
import { StatsSection } from './sections/StatsSection';
import { BmiSection, ContactSection, Equipment3dSection, LocationSection, NewsletterSection, TrialFormSection } from './sections/ToolSections';

export type SectionRenderer<T extends SectionType> = ComponentType<{ p: SectionProps<T> }>;

export const SECTION_RENDERERS: { [K in SectionType]: SectionRenderer<K> } = {
  hero: HeroSection,
  stats: StatsSection,
  about: AboutSection,
  programs: ProgramsSection,
  equipment3d: Equipment3dSection,
  trainers: TrainersSection,
  pricing: PricingSection,
  schedule: ScheduleSection,
  transformations: TransformationsSection,
  testimonials: TestimonialsSection,
  beforeAfter: BeforeAfterSection,
  facilities: FacilitiesSection,
  bmi: BmiSection,
  promo: PromoSection,
  blog: BlogSection,
  faq: FaqSection,
  location: LocationSection,
  trialForm: TrialFormSection,
  contact: ContactSection,
  newsletter: NewsletterSection,
  richText: RichTextSection,
  cta: CtaSection,
  imageText: ImageTextSection,
  gallery: GallerySection,
};
