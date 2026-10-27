// Builds responsive srcsets for Unsplash and Cloudinary URLs (both negotiate WebP/AVIF automatically).
const WIDTHS = [480, 768, 1080, 1440, 1920, 2560];

function sized(url, w) {
  if (!url) return url;
  if (url.includes('images.unsplash.com')) {
    const u = new URL(url);
    u.searchParams.set('w', String(w));
    u.searchParams.set('auto', 'format');
    if (!u.searchParams.has('q')) u.searchParams.set('q', '75');
    return u.toString();
  }
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${w}/`);
  }
  return url;
}

export function responsive(url, maxWidth = 2560) {
  if (!url) return {};
  const supports = url.includes('images.unsplash.com') || url.includes('res.cloudinary.com');
  if (!supports) return { src: url };
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  return {
    src: sized(url, widths.at(-1) >= 1080 ? 1080 : widths.at(-1)),
    srcSet: widths.map((w) => `${sized(url, w)} ${w}w`).join(', '),
  };
}

export const posterUrl = (url, w = 1600) => sized(url, w);
