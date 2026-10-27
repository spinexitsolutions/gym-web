import { Router } from 'express';
import * as c from '../controllers/public.controller.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { trainerListQuery, programListQuery, galleryQuery, slugParam } from '../validators/content.validator.js';

// Read-only public content. Admin CRUD for the same collections lives under /api/admin (Phase 4).
export const membershipsRouter = Router().get('/plans', h(c.listPlans));

export const trainersRouter = Router()
  .get('/', validate({ query: trainerListQuery }), h(c.listTrainers))
  .get('/:slug', validate({ params: slugParam }), h(c.getTrainer));

export const programsRouter = Router()
  .get('/', validate({ query: programListQuery }), h(c.listPrograms))
  .get('/:slug', validate({ params: slugParam }), h(c.getProgram));

export const reviewsRouter = Router().get('/testimonials', h(c.listTestimonials));
export const galleryRouter = Router().get('/', validate({ query: galleryQuery }), h(c.listGallery));
export const faqsRouter = Router().get('/', h(c.listFaqs));
export const eventsRouter = Router().get('/', h(c.listEvents));
