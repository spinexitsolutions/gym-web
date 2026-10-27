import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import settingsRoutes from './settings.routes.js';
import contactRoutes from './contact.routes.js';
import membershipsRoutes from './memberships.routes.js';
import membersRoutes from './members.routes.js';
import paymentsRoutes from './payments.routes.js';
import trainersRoutes from './trainers.routes.js';
import bookingsRoutes from './bookings.routes.js';
import classesRoutes from './classes.routes.js';
import attendanceRoutes from './attendance.routes.js';
import notificationsRoutes from './notifications.routes.js';
import supportRoutes from './support.routes.js';
import reviewsRoutes from './reviews.routes.js';
import workoutsRoutes from './workouts.routes.js';
import eventsRoutes from './events.routes.js';
import blogRoutes from './blog.routes.js';
import adminRoutes from './admin.routes.js';
import reportsRoutes from './reports.routes.js';
import assistantRoutes from './assistant.routes.js';
import { programsRouter, galleryRouter, faqsRouter } from './public.routes.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';
import { smtpConfigured } from '../services/email.service.js';
import { activeProvider } from '../services/gateway.service.js';

const api = Router();

api.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    data: {
      status: dbUp ? 'ok' : 'degraded',
      database: dbUp ? 'connected' : 'disconnected',
      integrations: { cloudinary: cloudinaryEnabled, smtp: smtpConfigured(), payments: activeProvider() || 'not configured' },
      uptime: Math.round(process.uptime()),
    },
  });
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/settings', settingsRoutes);
api.use('/memberships', membershipsRoutes);
api.use('/members', membersRoutes);
api.use('/payments', paymentsRoutes);
api.use('/trainers', trainersRoutes);
api.use('/programs', programsRouter);
api.use('/bookings', bookingsRoutes);
api.use('/classes', classesRoutes);
api.use('/attendance', attendanceRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/support', supportRoutes);
api.use('/reviews', reviewsRoutes);
api.use('/workouts', workoutsRoutes);
api.use('/gallery', galleryRouter);
api.use('/faqs', faqsRouter);
api.use('/events', eventsRoutes);
api.use('/blogs', blogRoutes);
api.use('/contact', contactRoutes);
api.use('/admin', adminRoutes);
api.use('/reports', reportsRoutes);
api.use('/assistant', assistantRoutes);

export default api;
