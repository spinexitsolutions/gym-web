import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { SmartLink } from './SmartLink';

const KEY = 'apex-announcement-dismissed';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Thin bar above the header: settings.announcement, or the first active "banner" promotion. */
export function AnnouncementBar({ collapsed }: { collapsed: boolean }) {
  const { site } = useSite();
  const [dismissed, setDismissed] = useState(readDismissed);
  const a = site?.settings.announcement;
  const banner = site?.promotions.find((p) => p.placement === 'banner');
  const text = a?.enabled && a.text ? a.text : banner ? [banner.title, banner.couponCode && `Code ${banner.couponCode}`].filter(Boolean).join(' — ') : '';
  const href = a?.enabled && a.text ? a.href : banner?.ctaHref ?? '';
  if (!text || dismissed === text) return null;

  const dismiss = () => {
    setDismissed(text);
    try {
      sessionStorage.setItem(KEY, text);
    } catch {
      /* private mode */
    }
  };

  return (
    <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out', collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')} aria-hidden={collapsed || undefined}>
      <div className="overflow-hidden">
        <div className="relative border-b border-fg/[0.07] bg-surface/70 backdrop-blur">
          <div className="container flex h-9 items-center justify-center gap-3 pr-10 text-[0.78rem]">
            <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-primary" />
            {href ? (
              <SmartLink href={href} tabIndex={collapsed ? -1 : undefined} className="group inline-flex min-w-0 items-center gap-2 text-fg/80 transition hover:text-fg">
                <span className="truncate">{text}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </SmartLink>
            ) : (
              <span className="truncate text-fg/80">{text}</span>
            )}
          </div>
          <button type="button" onClick={dismiss} tabIndex={collapsed ? -1 : undefined} className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-fg/5 hover:text-fg" aria-label="Dismiss announcement">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
