import { Router } from 'express';
import { env } from '../config/env';
import { BlogPostModel, PageModel, PageVersionModel, ProgramModel } from '../models';
import { getSiteSettings } from '../services/settings.service';
import { asyncHandler } from '../utils/http';

const r = Router();
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

async function baseUrl() {
  const s = await getSiteSettings();
  return (s.seo.siteUrl || env.PUBLIC_SITE_URL).replace(/\/$/, '');
}

r.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = await baseUrl();
    const [pages, posts, programs] = await Promise.all([
      PageModel.find({ status: 'published' }).select('slug isHome publishedAt publishedVersion').lean(),
      BlogPostModel.find({ status: 'published', publishedAt: { $lte: new Date() }, 'seo.noIndex': { $ne: true } }).select('slug updatedAt').lean(),
      ProgramModel.find({ published: true }).select('slug updatedAt').lean(),
    ]);
    const versions = await PageVersionModel.find({ _id: { $in: pages.map((p) => p.publishedVersion) } }).select('seo').lean();
    const noIndex = new Set(versions.filter((v) => (v.seo as { noIndex?: boolean })?.noIndex).map((v) => String(v._id)));
    const urls = [
      ...pages.filter((p) => !noIndex.has(String(p.publishedVersion))).map((p) => ({ loc: p.isHome ? `${base}/` : `${base}/${p.slug}`, lastmod: p.publishedAt })),
      ...['programs', 'trainers', 'memberships', 'schedule', 'blog', 'contact'].map((s) => ({ loc: `${base}/${s}`, lastmod: undefined })),
      ...programs.map((p) => ({ loc: `${base}/programs/${p.slug}`, lastmod: p.updatedAt })),
      ...posts.map((p) => ({ loc: `${base}/blog/${p.slug}`, lastmod: p.updatedAt })),
    ];
    res.type('application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}</url>`)
        .join('\n')}\n</urlset>`,
    );
  }),
);

r.get(
  '/robots.txt',
  asyncHandler(async (_req, res) => {
    const base = await baseUrl();
    res.type('text/plain');
    res.send(['User-agent: *', 'Disallow: /admin', 'Disallow: /member', 'Disallow: /trainer', 'Disallow: /api/', 'Disallow: /preview', 'Allow: /', `Sitemap: ${base}/sitemap.xml`].join('\n'));
  }),
);

export default r;
