import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSite } from '@/app/SiteProvider';

interface SeoProps {
  /** Page title; the site's title template is applied. Omit on the home page to use the site SEO title. */
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  /** Adds ExerciseGym structured data (home page only). */
  structuredData?: boolean;
  /** Extra JSON-LD objects (e.g. BlogPosting). */
  jsonLd?: Record<string, unknown>[];
  publishedTime?: string;
}

const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as const;

/** Escapes `<` so JSON-LD can never close its <script> element. */
const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

export function Seo({ title, description, image, noIndex, type = 'website', structuredData, jsonLd = [], publishedTime }: SeoProps) {
  const { site, brandName } = useSite();
  const { pathname } = useLocation();
  const s = site?.settings;
  const template = s?.seo.titleTemplate || `%s | ${brandName}`;
  const fullTitle = title ? (template.includes('%s') ? template.replace('%s', title) : `${title} | ${brandName}`) : s?.seo.title || brandName;
  const desc = description || s?.seo.description || '';
  const origin = (s?.seo.siteUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const canonical = `${origin}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const img = image || s?.seo.image || '';
  const absImg = img && img.startsWith('/') ? `${origin}${img}` : img;
  const robots = noIndex || s?.seo.noIndex ? 'noindex, nofollow' : 'index, follow';

  const blocks: Record<string, unknown>[] = [...jsonLd];
  if (structuredData && s && s.contact.addressLine) {
    const days = s.hours.filter((h) => !h.closed);
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ExerciseGym',
      name: s.brand.name,
      url: origin || undefined,
      description: desc || undefined,
      image: absImg || undefined,
      logo: s.brand.logoUrl ? (s.brand.logoUrl.startsWith('/') ? origin + s.brand.logoUrl : s.brand.logoUrl) : undefined,
      telephone: s.contact.phone || undefined,
      email: s.contact.email || undefined,
      foundingDate: s.business.foundedYear ? String(s.business.foundedYear) : undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.contact.addressLine,
        addressLocality: s.contact.city || undefined,
        addressRegion: s.contact.region || undefined,
        postalCode: s.contact.postalCode || undefined,
        addressCountry: s.contact.country || undefined,
      },
      geo: s.location.lat != null && s.location.lng != null ? { '@type': 'GeoCoordinates', latitude: s.location.lat, longitude: s.location.lng } : undefined,
      openingHoursSpecification: days.length ? days.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_NAMES[h.day], opens: h.open, closes: h.close })) : undefined,
      sameAs: Object.values(s.social).filter(Boolean),
    });
  }

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />
      <meta property="og:site_name" content={brandName} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:url" content={canonical} />
      {absImg && <meta property="og:image" content={absImg} />}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      <meta name="twitter:card" content={absImg ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      {desc && <meta name="twitter:description" content={desc} />}
      {absImg && <meta name="twitter:image" content={absImg} />}
      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">
          {safeJson(b)}
        </script>
      ))}
    </Helmet>
  );
}
