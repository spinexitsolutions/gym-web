import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { Modal } from '@/components/ui';
import { SmartLink } from './SmartLink';

const store = {
  get(k: string, s: Storage | undefined) {
    try {
      return s?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string, s: Storage | undefined) {
    try {
      s?.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/** Restores scroll on navigation and scrolls to #anchors once async sections have rendered. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tries = 0;
    const find = () =>
      document.getElementById(id) ??
      (id === 'results' ? document.querySelector('[data-section-type="transformations"],[data-section-type="beforeAfter"],[data-section-type="testimonials"],[data-section-type="stats"]') : null);
    const timer = window.setInterval(() => {
      const el = find();
      tries += 1;
      if (el || tries > 40) {
        window.clearInterval(timer);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 72;
          window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
        }
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);
  return null;
}

/** First "popup" promotion, once per session, after the visitor has had time to look around. */
export function PromoPopup() {
  const { site } = useSite();
  const { pathname } = useLocation();
  const promo = site?.promotions.find((p) => p.placement === 'popup');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = promo ? `apex-promo-${promo._id}` : '';

  useEffect(() => {
    if (!promo || pathname.startsWith('/preview') || store.get(key, window.sessionStorage)) return;
    const t = window.setTimeout(() => {
      setOpen(true);
      store.set(key, '1', window.sessionStorage);
    }, 9000);
    return () => window.clearTimeout(t);
  }, [promo, key, pathname]);

  if (!promo) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promo.couponCode ?? '');
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <Modal open={open} onClose={() => setOpen(false)} title={promo.title} size="sm">
      {promo.imageUrl && <img src={promo.imageUrl} alt="" loading="lazy" decoding="async" className="mb-5 aspect-[16/9] w-full rounded-theme-sm object-cover" />}
      {promo.body && <p className="text-muted">{promo.body}</p>}
      {promo.couponCode && (
        <button type="button" onClick={copy} className="mt-5 flex w-full items-center justify-between rounded-theme-sm border border-dashed border-primary/50 px-4 py-3 font-display text-lg tracking-[0.2em] text-primary">
          {promo.couponCode}
          <span className="inline-flex items-center gap-1.5 text-xs tracking-normal text-muted" aria-live="polite">
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? 'Copied' : 'Copy code'}
          </span>
        </button>
      )}
      {promo.ctaHref && promo.ctaLabel && (
        <SmartLink href={promo.ctaHref} onClick={() => setOpen(false)} className="btn btn-primary mt-6 w-full">
          {promo.ctaLabel}
        </SmartLink>
      )}
    </Modal>
  );
}

/** Lightweight notice: the site only uses essential cookies (session + CSRF). */
export function CookieNotice() {
  const { site } = useSite();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => Boolean(store.get('apex-cookie-ok', typeof window !== 'undefined' ? window.localStorage : undefined)));
  if (!site?.settings.privacy.cookieBanner || hidden || pathname.startsWith('/preview')) return null;
  const ok = () => {
    store.set('apex-cookie-ok', '1', window.localStorage);
    setHidden(true);
  };
  return (
    <div role="region" aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 z-[70] max-w-sm rounded-theme border border-fg/10 bg-surface/95 p-4 text-sm shadow-theme backdrop-blur sm:right-auto">
      <p className="text-fg/80">
        We use essential cookies to keep you signed in and secure. No advertising trackers.{' '}
        {site.settings.privacy.privacyPolicyUrl && (
          <SmartLink href={site.settings.privacy.privacyPolicyUrl} className="text-fg underline underline-offset-4">
            Privacy policy
          </SmartLink>
        )}
      </p>
      <button type="button" onClick={ok} className="btn btn-secondary btn-sm mt-3">
        Got it
      </button>
    </div>
  );
}
