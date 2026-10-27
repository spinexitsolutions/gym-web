import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { clientOrigins, isTest, isProd } from './config/env.js';
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

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginEmbedderPolicy: false, // allow CDN images and the Google Maps embed
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://checkout.razorpay.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // inline style attributes from animations
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'], // admins may use licensed images from any https CDN
        'media-src': ["'self'", 'blob:', 'https:'],
        'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', ...(isProd ? [] : ['ws:'])],
        'frame-src': ['https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://www.google.com', 'https://maps.google.com'],
        'worker-src': ["'self'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': isProd ? [] : null,
      },
    },
  }));
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

  serveClient(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// Optional single-process deployment: serve the built React app (client/dist) with SPA fallback.
function serveClient(app) {
  const dist = process.env.CLIENT_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (!isProd || process.env.SERVE_CLIENT === 'false' || !fs.existsSync(path.join(dist, 'index.html'))) return;
  // Missing hashed assets must 404 (not fall back to index.html) so stale clients fail cleanly after a deploy.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}
