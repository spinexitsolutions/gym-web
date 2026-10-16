/**
 * Public data hooks. Every query key starts with 'public' so SiteProvider invalidates them
 * when the CMS publishes (content version changes).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BlogPostSummary, ClassItem, Facility, Faq, GalleryItem, Plan, Program, Testimonial, TrainerPublic } from '@/types/api';

const STALE = 60_000;

export interface PublicReview {
  _id: string;
  displayName?: string;
  rating: number;
  title?: string;
  body?: string;
  response?: string;
  createdAt: string;
}

export const usePrograms = (limit = 12, featured = false) =>
  useQuery({ queryKey: ['public', 'programs', limit, featured], queryFn: () => api.get<Program[]>('/cms/public/programs', { limit, featured: featured ? 'true' : undefined }), staleTime: STALE });

export const useTrainers = (limit = 24) => useQuery({ queryKey: ['public', 'trainers', limit], queryFn: () => api.get<TrainerPublic[]>('/trainers', { limit }), staleTime: STALE });

export const usePlans = () => useQuery({ queryKey: ['public', 'plans'], queryFn: () => api.get<Plan[]>('/plans'), staleTime: STALE });

export const useClasses = (days = 7, limit = 100, trainer?: string) =>
  useQuery({ queryKey: ['public', 'classes', days, limit, trainer ?? ''], queryFn: () => api.get<ClassItem[]>('/classes', { days, limit, trainer }), staleTime: 30_000 });

export const useGallery = (category: GalleryItem['category'], limit = 12) =>
  useQuery({ queryKey: ['public', 'gallery', category, limit], queryFn: () => api.get<GalleryItem[]>('/cms/public/gallery', { category, limit }), staleTime: STALE });

export const useTestimonials = (limit = 12) => useQuery({ queryKey: ['public', 'testimonials', limit], queryFn: () => api.get<Testimonial[]>('/cms/public/testimonials', { limit }), staleTime: STALE });

export const useReviews = (limit = 12) => useQuery({ queryKey: ['public', 'reviews', limit], queryFn: () => api.get<PublicReview[]>('/cms/public/reviews', { limit }), staleTime: STALE });

export const useFacilities = (limit = 12) => useQuery({ queryKey: ['public', 'facilities', limit], queryFn: () => api.get<Facility[]>('/cms/public/facilities', { limit }), staleTime: STALE });

export const useFaqs = (limit = 8, category = '') =>
  useQuery({ queryKey: ['public', 'faqs', limit, category], queryFn: () => api.get<Faq[]>('/cms/public/faqs', { limit, category: category || undefined }), staleTime: STALE });

export const useBlogLatest = (limit = 3) => useQuery({ queryKey: ['public', 'blog', 'latest', limit], queryFn: () => api.get<BlogPostSummary[]>('/blog', { limit }), staleTime: STALE });

export interface LiveStats {
  activeMembers: number;
  trainers: number;
  programs: number;
  classesThisWeek: number;
}
export const useLiveStats = (enabled: boolean) => useQuery({ queryKey: ['public', 'stats'], queryFn: () => api.get<LiveStats>('/cms/stats'), staleTime: STALE, enabled });
