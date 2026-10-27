import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { clientOrigins, isTest } from './config/env.js';
import api from './routes/index.js';
import seoRoutes from './routes/seo.routes.js';
import { webhook } from './controllers/payment.controller.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind one reverse proxy (Render, Railway, Nginx) so req.ip is the client

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || clientOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(compression());
  // Morgan logs method, path, status and time only — never bodies, cookies or query strings.
  morgan.token('path', (req) => req.originalUrl.split('?')[0]);
  if (!isTest) app.use(morgan(':method :path :status :response-time ms'));

  // Razorpay signs the raw body, so the webhook is mounted before the JSON parser (no auth/CSRF; signature-verified).
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), asyncHandler(webhook));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.use('/api', apiLimiter, csrfProtection(), api);
  app.use(seoRoutes); // /sitemap.xml and /robots.txt

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
