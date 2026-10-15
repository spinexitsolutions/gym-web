import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins, env, isProd, isTest } from './config/env';
import { logger } from './config/logger';
import { openapiSpec } from './docs/openapi';
import { authenticate } from './middleware/auth';
import { issueCsrf, verifyCsrf } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimit';
import attendanceRoutes from './routes/attendance.routes';
import authRoutes from './routes/auth.routes';
import blogRoutes from './routes/blog.routes';
import bookingRoutes from './routes/bookings.routes';
import classRoutes from './routes/classes.routes';
import cmsRoutes from './routes/cms.routes';
import mediaRoutes from './routes/media.routes';
import memberRoutes from './routes/members.routes';
import membershipRoutes from './routes/memberships.routes';
import notificationRoutes from './routes/notifications.routes';
import pageRoutes from './routes/pages.routes';
import paymentRoutes, { webhookRouter } from './routes/payments.routes';
import planRoutes from './routes/plans.routes';
import reportRoutes from './routes/reports.routes';
import seoRoutes from './routes/seo.routes';
import settingsRoutes from './routes/settings.routes';
import supportRoutes from './routes/support.routes';
import themeRoutes from './routes/themes.routes';
import trainerRoutes from './routes/trainers.routes';
import userRoutes from './routes/users.routes';
import workoutRoutes from './routes/workouts.routes';
import { uploadRoot } from './services/storage';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://checkout.razorpay.com'],
          'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://www.google.com', 'https://www.youtube-nocookie.com'],
          'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'worker-src': ["'self'", 'blob:'],
          'media-src': ["'self'", 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' || req.url?.startsWith('/assets') === true },
        serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0] }), res: (res) => ({ statusCode: res.statusCode }) },
      }),
    );
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Webhooks: raw body + signature verification, no cookies/CSRF.
  app.use('/api/v1/payments/webhook', webhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // Public uploads (private files live in uploads/private and are never served statically).
  app.use(
    '/uploads/public',
    express.static(path.join(uploadRoot(), 'public'), {
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  app.use(seoRoutes);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'Apex Athletics API' }));
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));

  const api = express.Router();
  api.use(apiLimiter);
  api.use(issueCsrf);
  api.use(verifyCsrf);
  api.use(authenticate);
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  api.use('/members', memberRoutes);
  api.use('/trainers', trainerRoutes);
  api.use('/memberships', membershipRoutes);
  api.use('/plans', planRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/bookings', bookingRoutes);
  api.use('/classes', classRoutes);
  api.use('/workouts', workoutRoutes);
  api.use('/attendance', attendanceRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/cms', cmsRoutes);
  api.use('/themes', themeRoutes);
  api.use('/pages', pageRoutes);
  api.use('/media', mediaRoutes);
  api.use('/blog', blogRoutes);
  api.use('/reports', reportRoutes);
  api.use('/settings', settingsRoutes);
  api.use('/support', supportRoutes);
  app.use('/api/v1', api);
  app.use('/api', notFoundHandler);

  // Optionally serve the built client (single-origin deployment).
  if (env.SERVE_CLIENT) {
    const dist = path.resolve(process.cwd(), env.CLIENT_DIST_DIR);
    if (fs.existsSync(dist)) {
      app.use(express.static(dist, { index: false, maxAge: isProd ? '1y' : 0, setHeaders: (res, file) => file.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
      app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    } else {
      logger.warn({ dist }, 'SERVE_CLIENT is true but the client build was not found');
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
