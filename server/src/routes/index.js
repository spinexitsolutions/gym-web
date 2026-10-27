import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import settingsRoutes from './settings.routes.js';
import contactRoutes from './contact.routes.js';
import {
  membershipsRouter, trainersRouter, programsRouter, reviewsRouter, galleryRouter, faqsRouter, eventsRouter,
} from './public.routes.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';
import { smtpConfigured } from '../services/email.service.js';
import env from '../config/env.js';

const api = Router();

api.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    data: {
      status: dbUp ? 'ok' : 'degraded',
      database: dbUp ? 'connected' : 'disconnected',
      integrations: {
        cloudinary: cloudinaryEnabled,
        smtp: smtpConfigured(),
        razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      },
      uptime: Math.round(process.uptime()),
    },
  });
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/settings', settingsRoutes);
api.use('/memberships', membershipsRouter);
api.use('/trainers', trainersRouter);
api.use('/programs', programsRouter);
api.use('/reviews', reviewsRouter);
api.use('/gallery', galleryRouter);
api.use('/faqs', faqsRouter);
api.use('/events', eventsRouter);
api.use('/contact', contactRoutes);

export default api;
