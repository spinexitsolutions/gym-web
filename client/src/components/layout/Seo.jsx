import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../hooks/useSettings.js';
import { posterUrl } from '../../utils/media.js';

export function Seo({ title, description, image, path = '', noindex = false, jsonLd }) {
  const { data: s } = useSettings();
  const brand = s?.brand?.name || 'Aurum Fitness Club';
  const fullTitle = title ? `${title} | ${brand}` : s?.seo?.title || brand;
  const desc = description || s?.seo?.description || '';
  const img = posterUrl(image || s?.seo?.ogImage?.url, 1200);
  const base = (s?.seo?.siteUrl || '').replace(/\/$/, '');
  const url = base ? `${base}${path}` : undefined;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      {s?.seo?.keywords && <meta name="keywords" content={s.seo.keywords} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {url && <link rel="canonical" href={url} />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={brand} />
      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      {img && <meta property="og:image" content={img} />}
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      {s?.brand?.favicon?.url && <link rel="icon" href={s.brand.favicon.url} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
