import { Link } from 'react-router-dom';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';

/** Logo from settings, or a typographic wordmark when no logo is uploaded. */
export function BrandMark({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { site, brandName } = useSite();
  const brand = site?.settings.brand;
  return (
    <Link to="/" onClick={onClick} className={cn('group inline-flex items-center gap-2.5', className)} aria-label={`${brandName} — home`}>
      {brand?.logoUrl ? (
        <img src={brand.logoUrl} alt={brand.logoAlt || brandName} className="h-8 w-auto max-w-[180px] object-contain" decoding="async" />
      ) : (
        <>
          <span aria-hidden className="relative grid h-8 w-8 place-items-center rounded-full border border-fg/20 transition-colors group-hover:border-primary/60">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.32em]">{brand?.shortName || brandName}</span>
        </>
      )}
    </Link>
  );
}
