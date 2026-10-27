import { Router } from 'express';
import { WorkoutProgram, Trainer, BlogPost, Challenge } from '../models/index.js';
import { getPublishedSettings } from '../services/settings.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { clientOrigins } from '../config/env.js';

const r = Router();
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

r.get('/sitemap.xml', h(async (_req, res) => {
  const s = await getPublishedSettings();
  const base = (s.seo.siteUrl || clientOrigins[0]).replace(/\/$/, '');
  const [programs, trainers, posts, events] = await Promise.all([
    WorkoutProgram.find({ isActive: true }).select('slug updatedAt').lean(),
    Trainer.find({ isActive: true }).select('slug updatedAt').lean(),
    BlogPost.find({ status: 'published', publishedAt: { $lte: new Date() } }).select('slug updatedAt').lean(),
    Challenge.find({ isPublished: true }).select('slug updatedAt').lean(),
  ]);
  const urls = [
    ...['/', '/about', '/memberships', '/programs', '/trainers', '/schedule', '/blog', '/events', '/contact'].map((p) => ({ loc: p, priority: p === '/' ? '1.0' : '0.8' })),
    ...programs.map((d) => ({ loc: `/programs/${d.slug}`, lastmod: d.updatedAt })),
    ...trainers.map((d) => ({ loc: `/trainers/${d.slug}`, lastmod: d.updatedAt })),
    ...posts.map((d) => ({ loc: `/blog/${d.slug}`, lastmod: d.updatedAt })),
    ...events.map((d) => ({ loc: `/events/${d.slug}`, lastmod: d.updatedAt })),
  ];
  const body = urls.map((u) => `  <url><loc>${xml(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}${u.priority ? `<priority>${u.priority}</priority>` : ''}</url>`).join('\n');
  res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}));

r.get('/robots.txt', h(async (_req, res) => {
  const s = await getPublishedSettings();
  const base = (s.seo.siteUrl || clientOrigins[0]).replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /trainer\nDisallow: /account\n\nSitemap: ${base}/sitemap.xml\n`);
}));

export default r;
