import { api, getData } from './api.js';

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString();
  return s ? `?${s}` : '';
};

export const contentApi = {
  settings: () => getData('/settings/public'),
  plans: () => getData('/memberships/plans'),
  trainers: (params) => api.get(`/trainers${qs(params)}`), // returns { data, meta }
  trainer: (slug) => getData(`/trainers/${slug}`),
  programs: (params) => api.get(`/programs${qs(params)}`),
  program: (slug) => getData(`/programs/${slug}`),
  testimonials: () => getData('/reviews/testimonials'),
  gallery: (params) => getData(`/gallery${qs(params)}`),
  faqs: () => getData('/faqs'),
  events: () => getData('/events'),
  contact: (body) => api.post('/contact', body),
  newsletter: (email) => api.post('/contact/newsletter', { email }),
};
