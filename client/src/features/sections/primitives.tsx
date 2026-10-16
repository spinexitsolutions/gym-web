import { createContext, useContext, useId, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Info } from 'lucide-react';
import type { sectionBackground } from '@apex/shared';
import type { z } from 'zod';
import { cn } from '@/lib/cn';
import { Reveal } from '@/components/layout/Reveal';
import { SmartLink } from '@/components/layout/SmartLink';
import { Skeleton } from '@/components/ui';

/* ----------------------------------------------------------------- context */

export interface RenderContextValue {
  /** Admin preview: invalid/empty sections show inline guidance instead of disappearing. */
  preview: boolean;
}
export const RenderContext = createContext<RenderContextValue>({ preview: false });
export const useRenderContext = () => useContext(RenderContext);

/* ------------------------------------------------------------------ shell */

type Background = z.infer<typeof sectionBackground>;

export interface CommonProps {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  anchorId?: string;
  background?: Background;
}

/**
 * Section wrapper: anchor id, background variant (default / surface / gradient / image+overlay /
 * contrast) and vertical rhythm from the theme spacing token.
 */
export function SectionShell({
  type,
  props,
  children,
  className,
  padded = true,
  labelledBy,
}: {
  type: string;
  props: CommonProps;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  labelledBy?: string;
}) {
  const bg = props.background ?? { variant: 'default', imageUrl: '', overlay: 0.6 };
  const variant = bg.variant === 'image' && !bg.imageUrl ? 'gradient' : bg.variant;
  const inner = (
    <section
      id={props.anchorId || undefined}
      data-section-type={type}
      aria-labelledby={labelledBy}
      className={cn(
        'relative isolate overflow-hidden',
        padded && 'section',
        variant === 'surface' && 'border-y border-fg/[0.06] bg-surface',
        variant === 'contrast' && 'section-contrast',
        className,
      )}
    >
      {variant === 'gradient' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-aura absolute inset-0" />
          <div className="absolute inset-x-0 top-0 hairline" />
        </div>
      )}
      {variant === 'image' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <img src={bg.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `rgb(var(--c-background) / ${bg.overlay})` }} />
          <div className="bg-vignette absolute inset-0" />
        </div>
      )}
      {children}
    </section>
  );
  return variant === 'contrast' ? <div className="section-contrast-outer">{inner}</div> : inner;
}

/** Eyebrow + heading + subheading with an optional action on the right. */
export function SectionHeading({ props, id, align = 'left', action, className, as: H = 'h2' }: { props: CommonProps; id?: string; align?: 'left' | 'center'; action?: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  if (!props.eyebrow && !props.heading && !props.subheading && !action) return null;
  return (
    <Reveal className={cn('mb-12 flex flex-col gap-6 md:mb-16', align === 'center' ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between', className)}>
      <div className={cn('max-w-3xl', align === 'center' && 'mx-auto')}>
        {props.eyebrow && <p className="eyebrow mb-5">{props.eyebrow}</p>}
        {props.heading && (
          <H id={id} className="text-balance font-display text-display-lg font-semibold">
            {props.heading}
          </H>
        )}
        {props.subheading && <p className={cn('mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-lg', align === 'center' && 'mx-auto')}>{props.subheading}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}

export function useHeadingId(props: CommonProps) {
  const id = useId().replace(/:/g, '');
  return props.heading ? `h-${id}` : undefined;
}

/* ------------------------------------------------------------ data states */

/** Preview-only placeholder for empty data collections (live site hides the section). */
export function EmptyPlaceholder({ type, label, where }: { type: string; label: string; where: string }) {
  const { preview } = useRenderContext();
  if (!preview) return null;
  return (
    <section data-section-type={type} className="container py-10">
      <div className="flex items-start gap-3 rounded-theme border border-dashed border-fg/15 bg-fg/[0.02] px-5 py-4 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-fg">{label}:</span> no published items yet — add them in {where}. This section is hidden on the live site until then.
        </p>
      </div>
    </section>
  );
}

/** Quiet inline error — the public site degrades gracefully instead of shouting. */
export function QuietError({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <p role="status" className="rounded-theme border border-fg/10 px-5 py-4 text-sm text-muted">
      {what} are temporarily unavailable.{' '}
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-fg underline underline-offset-4 hover:text-primary">
          Try again
        </button>
      )}
    </p>
  );
}

export function CardSkeletons({ count = 3, className, itemClassName }: { count?: number; className?: string; itemClassName?: string }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-72 rounded-theme', itemClassName)} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- media */

export function Img({ src, alt, className, sizes }: { src: string; alt: string; className?: string; sizes?: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" sizes={sizes} className={cn('h-full w-full object-cover', className)} />;
}

/** Typographic placeholder used where an image is optional and missing: intentional, not broken. */
export function MonogramArt({ text, label, className, index }: { text: string; label?: string; className?: string; index?: number }) {
  return (
    <div aria-hidden className={cn('metal-panel relative h-full w-full overflow-hidden', className)}>
      <div className="bg-grid-fade absolute inset-0 opacity-60" />
      <div className="absolute -right-6 -top-10 h-56 w-56 rounded-full border border-fg/[0.07]" />
      <div className="absolute -right-2 -top-6 h-40 w-40 rounded-full border border-fg/[0.05]" />
      <span className="absolute bottom-4 left-5 font-display text-[5.5rem] font-semibold leading-none tracking-tighter text-fg/[0.09]">{text}</span>
      {label && <span className="absolute left-5 top-5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted">{label}</span>}
      {index !== undefined && <span className="absolute right-5 top-5 font-display text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</span>}
    </div>
  );
}

/* -------------------------------------------------------------- markdown */

const mdComponents: Components = {
  a: ({ href, children }) => <SmartLink href={href ?? ''}>{children}</SmartLink>,
  img: ({ src, alt }) => (src && /^(\/(?!\/)|https:\/\/)/.test(src) ? <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" /> : null),
  h1: ({ children }) => <h2>{children}</h2>,
};

/** Markdown renderer. Raw HTML is skipped entirely (no rehype-raw, `skipHtml`). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-apex', className)}>
      <ReactMarkdown skipHtml components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Plain text with paragraphs preserved (for non-markdown long text fields). */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cn('space-y-4', className)}>
      {parts.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
