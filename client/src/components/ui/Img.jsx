import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { responsive } from '../../utils/media.js';
import { cn } from '../../utils/cn.js';

// Responsive, lazy-loaded image with a graceful fallback panel if the source fails.
// `decorative` hides the fallback icon (for full-bleed backgrounds behind text).
export function Img({ image, src, alt, sizes = '100vw', className, priority = false, maxWidth, decorative = false, ...props }) {
  const url = src || image?.url;
  const [failed, setFailed] = useState(false);
  const label = alt ?? image?.alt ?? '';

  if (!url || failed) {
    return (
      <div role={label ? 'img' : undefined} aria-label={label || undefined} className={cn('flex items-center justify-center bg-gradient-to-br from-elevated to-surface text-muted/50', className)}>
        {!decorative && <ImageOff className="h-6 w-6" aria-hidden />}
      </div>
    );
  }
  const r = responsive(url, maxWidth);
  return (
    <img
      src={r.src}
      srcSet={r.srcSet}
      sizes={r.srcSet ? sizes : undefined}
      alt={label}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchpriority={priority ? 'high' : undefined}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
      {...props}
    />
  );
}
