import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { SectionProps } from '@apex/shared';
import { cn } from '@/lib/cn';
import { SceneCanvas } from '@/3d/SceneCanvas';
import { CtaRow } from '@/components/layout/SmartLink';
import { useLiveStats } from '../queries';

const ease = [0.2, 0.7, 0.2, 1] as const;
const fade = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease } });
const nf = new Intl.NumberFormat('en-IN');

/**
 * Headline with a masked word-by-word rise. The final word gets the accent treatment
 * (theme gradient). Reduced motion: MotionConfig drops the transform, words simply appear.
 */
function Headline({ text, className }: { text: string; className?: string }) {
  const words = text.trim().split(/\s+/);
  return (
    <h1 id="hero-heading" className={className}>
      {words.map((w, i) => {
        const last = i === words.length - 1;
        return (
          <span key={i}>
            <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
              <motion.span className={cn('inline-block', last ? 'text-gradient pr-[0.04em]' : 'text-fg')} initial={{ y: '108%' }} animate={{ y: '0%' }} transition={{ duration: 1, delay: 0.2 + i * 0.07, ease }}>
                {w}
              </motion.span>
            </span>
            {i < words.length - 1 && ' '}
          </span>
        );
      })}
    </h1>
  );
}

/** Live trust stats from /cms/stats; each shown only when > 0, bar hidden when none. */
function TrustBar({ showScrollHint }: { showScrollHint: boolean }) {
  const stats = useLiveStats(true);
  const items = stats.data
    ? [
        { label: 'Active members', value: stats.data.activeMembers },
        { label: 'Expert coaches', value: stats.data.trainers },
        { label: 'Classes this week', value: stats.data.classesThisWeek },
      ].filter((x) => x.value > 0)
    : [];
  if (!items.length && !showScrollHint) return null;
  return (
    <motion.div {...fade(0.9)} className="flex w-full items-end justify-between gap-6 border-t border-fg/[0.08] pt-5">
      {items.length > 0 ? (
        <dl className="flex flex-wrap">
          {items.map((it, i) => (
            <div key={it.label} className={cn('flex flex-col-reverse gap-1 pr-6 sm:pr-10', i > 0 && 'border-l border-fg/[0.1] pl-6 sm:pl-10')}>
              <dt className="text-[0.65rem] uppercase tracking-[0.22em] text-muted">{it.label}</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{nf.format(it.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span />
      )}
      {showScrollHint && (
        <span aria-hidden className="hidden items-center gap-3 text-[0.65rem] uppercase tracking-[0.3em] text-muted sm:inline-flex">
          Scroll
          <span className="relative block h-10 w-px overflow-hidden bg-fg/15">
            <span className="scroll-hint-dot absolute left-0 top-0 block h-2 w-px bg-primary" />
          </span>
        </span>
      )}
    </motion.div>
  );
}

/**
 * Full-viewport cinematic hero.
 *  - left align: copy left, 3D stage right (desktop) / stage above the copy (mobile, ~42vh)
 *  - center align: stage behind the copy, dimmed
 * The 3D scene is lazy-loaded and degrades to a static poster; colours are theme tokens only.
 */
export function HeroSection({ p }: { p: SectionProps<'hero'> }) {
  const ref = useRef<HTMLElement>(null);
  const centered = p.align === 'center';
  const showScene = p.mediaType === 'scene' && p.scene.enabled;
  const showImage = p.mediaType === 'image' && Boolean(p.imageUrl);
  const sideMedia = !centered && (showScene || showImage);
  const bgImage = p.background.variant === 'image' && p.background.imageUrl;
  const label = "3D render of the club's training equipment";

  const stage = showScene ? (
    <SceneCanvas config={p.scene} label={label} scrollTarget={ref} fallbackImageUrl={p.imageUrl || undefined} className="h-full w-full" />
  ) : showImage ? (
    <img src={p.imageUrl} alt="" decoding="async" className="h-full w-full object-cover" />
  ) : null;

  return (
    <section ref={ref} id={p.anchorId || undefined} data-section-type="hero" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-heading">
      {/* Atmosphere: faint grid, soft light sweep, vignette (grain comes from the theme) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        {bgImage ? (
          <>
            <img src={p.background.imageUrl} alt="" decoding="async" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `rgb(var(--c-background) / ${p.background.overlay})` }} />
          </>
        ) : (
          <>
            <div className="bg-grid-fade absolute inset-0 opacity-60" />
            <div className="absolute inset-0 bg-[linear-gradient(112deg,transparent_25%,rgb(var(--c-text)/0.035)_45%,transparent_62%)]" />
          </>
        )}
        <div className="bg-vignette absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>

      {/* Centered layout: stage sits behind the copy */}
      {centered && stage && <div className="absolute inset-0 -z-10 opacity-45 md:opacity-55">{stage}</div>}

      {/* Side stage: in flow above the copy on mobile, right half on desktop */}
      {sideMedia && (
        <div className="relative -z-10 mt-[var(--chrome-h,6rem)] h-[42svh] min-h-[280px] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:h-auto lg:w-[54%]">
          {/* Soft spotlight in the theme primary colour behind the object */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[90px] [[data-glow='false']_&]:bg-fg/[0.06]" />
          <div className="relative h-full w-full">{stage}</div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-bg to-transparent lg:hidden" />
        </div>
      )}

      <div
        className={cn(
          'container pointer-events-none relative flex flex-1 flex-col',
          sideMedia ? 'pt-2 lg:pt-[calc(var(--chrome-h,6rem)+1rem)]' : 'pt-[calc(var(--chrome-h,6rem)+2rem)]',
          centered && 'items-center text-center',
        )}
      >
        <div className={cn('pointer-events-auto flex flex-1 flex-col justify-center py-6 lg:py-10', centered ? 'max-w-4xl items-center' : 'max-w-[36rem] xl:max-w-[40rem]')}>
          {p.eyebrow && (
            <motion.p {...fade(0.1)} className={cn('eyebrow mb-5 md:mb-7', centered && 'justify-center')}>
              {p.eyebrow}
            </motion.p>
          )}
          <Headline text={p.headline} className="text-balance font-display text-[clamp(2.35rem,5.6vw,5.4rem)] font-semibold leading-[0.95] tracking-[-0.04em]" />
          {p.subheadline && (
            <motion.p {...fade(0.55)} className={cn('mt-5 max-w-lg text-pretty text-[0.98rem] leading-relaxed text-fg/65 md:mt-7 md:text-lg', centered && 'mx-auto')}>
              {p.subheadline}
            </motion.p>
          )}
          {p.ctas.length > 0 && (
            <motion.div {...fade(0.7)} className="mt-8 md:mt-10">
              <CtaRow
                ctas={p.ctas}
                className={cn(
                  'grid grid-cols-2 gap-3 sm:flex [&>*:first-child]:col-span-2 [&>*]:w-full sm:[&>*]:w-auto',
                  p.ctas.length === 2 && '[&>*:last-child]:col-span-2',
                  centered && 'sm:justify-center',
                )}
              />
            </motion.div>
          )}
        </div>
        <div className="pointer-events-auto pb-7 pt-4">
          <TrustBar showScrollHint={p.showScrollHint} />
        </div>
      </div>
    </section>
  );
}
