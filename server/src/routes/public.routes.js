import { Router } from 'express';
import * as c from '../controllers/public.controller.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { programListQuery, galleryQuery, slugParam } from '../validators/content.validator.js';

// Read-only public content. Admin CRUD for the same collections lives under /api/admin.
export const programsRouter = Router()
  .get('/', validate({ query: programListQuery }), h(c.listPrograms))
  .get('/:slug', validate({ params: slugParam }), h(c.getProgram));

export const galleryRouter = Router().get('/', validate({ query: galleryQuery }), h(c.listGallery));
export const faqsRouter = Router().get('/', h(c.listFaqs));
