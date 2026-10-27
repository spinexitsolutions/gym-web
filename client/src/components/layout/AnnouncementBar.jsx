import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings.js';

const DISMISS_KEY = 'aurum-announcement-dismissed';

export function AnnouncementBar() {
  const { data: s } = useSettings();
  const bar = s?.announcementBar;
  const banner = s?.banners?.[0]; // admin-published promotional announcement takes priority
  const text = banner?.title || (bar?.enabled ? bar.text : '');
  const link = banner?.link?.href ? banner.link : bar?.link;
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === text; } catch { return false; }
  });
  if (!text || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, text); } catch { /* ignore */ }
  };
  return (
    <div className="relative z-50 bg-gold-metal text-[#0B0B0C]">
      <div className="container flex min-h-10 items-center justify-center gap-3 py-2 pr-10 text-center text-xs font-semibold tracking-wide sm:text-[0.8rem]">
        <span>{text}</span>
        {link?.href && (
          <Link to={link.href} className="inline-flex items-center gap-1 underline underline-offset-4">
            {link.label || 'Learn more'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
        <button type="button" onClick={dismiss} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/10" aria-label="Dismiss announcement">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
