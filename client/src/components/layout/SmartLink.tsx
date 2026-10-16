import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Cta } from '@apex/shared';
import { cn } from '@/lib/cn';

const isExternal = (href: string) => /^https?:\/\//i.test(href);
const isSpecial = (href: string) => /^(mailto:|tel:)/i.test(href);

/**
 * Link that does the right thing for CMS-provided hrefs:
 * internal paths use the router, `#anchors` stay native, external links open safely in a new tab.
 */
export const SmartLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }>(function SmartLink({ href, children, ...rest }, ref) {
  if (!href) return <span className={rest.className}>{children}</span>;
  if (isExternal(href))
    return (
      <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  if (href.startsWith('#') || isSpecial(href))
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <Link ref={ref} to={href} {...rest}>
      {children}
    </Link>
  );
});

const variantClass: Record<Cta['variant'], string> = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost' };

/** Button-styled CMS call to action. */
export function CtaButton({ cta, size = 'lg', className }: { cta: Cta; size?: 'md' | 'lg' | 'sm'; className?: string }) {
  const ext = isExternal(cta.href);
  return (
    <SmartLink href={cta.href} className={cn('btn group', variantClass[cta.variant ?? 'primary'], size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm', className)}>
      {cta.label}
      {cta.variant === 'primary' &&
        (ext ? <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />)}
    </SmartLink>
  );
}

export function CtaRow({ ctas, className, size }: { ctas: Cta[]; className?: string; size?: 'md' | 'lg' | 'sm' }) {
  if (!ctas.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {ctas.map((c, i) => (
        <CtaButton key={`${c.href}-${i}`} cta={c} size={size} />
      ))}
    </div>
  );
}
