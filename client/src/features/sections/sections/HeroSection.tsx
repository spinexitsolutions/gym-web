import { useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import type { SectionProps } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { SceneCanvas } from '@/3d/SceneCanvas';
import { CtaRow } from '@/components/layout/SmartLink';
import { todaySummary } from '../hours';

const ease = [0.2, 0.7, 0.2, 1] as const;
const enter = (i: number) => ({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay: 0.15 + i * 0.1, ease } });

/**
 * Full-viewport cinematic hero. Headline left (scene right, bleeding off the edge) or centred
 * (scene behind, dimmed). The 3D scene is lazy and degrades to a static poster.
 */
export function HeroSection({ p }: { p: SectionProps<'hero'> }) {
  const ref = useRef<HTMLElement>(null);
  const { site } = useSite();
  const s = site?.settings;
  const centered = p.align === 'center';
  const showScene = p.mediaType === 'scene' && p.scene.enabled;
  const showImage = p.mediaType === 'image' && Boolean(p.imageUrl);
  const hours = todaySummary(s?.hours, s?.business.timezone);
  const place = [s?.contact.city, s?.contact.region].filter(Boolean).join(', ');
  const bgImage = p.background.variant === 'image' && p.background.imageUrl;

  return (
    <section ref={ref} id={p.anchorId || undefined} data-section-type="hero" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-heading">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        {bgImage ? (
          <>
            <img src={p.background.imageUrl} alt="" decoding="async" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `rgb(var(--c-background) / ${p.background.overlay})` }} />
          </>
        ) : (
          <>
            <div className="bg-aura absolute inset-0" />
            <div className="bg-grid-fade absolute inset-0 opacity-70" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>

      {/* Centered layouts and images sit behind the copy */}
      {showScene && centered && (
        <div className="absolute inset-0 -z-10 opacity-50 md:opacity-60">
          <SceneCanvas config={p.scene} label="Rotating 3D render of the club's training equipment" scrollTarget={ref} fallbackImageUrl={p.imageUrl || undefined} className="h-full w-full" />
        </div>
      )}
      {showImage && (
        <div aria-hidden className={cn('-z-10', centered ? 'absolute inset-0' : 'absolute inset-x-0 bottom-0 top-[45%] lg:inset-y-0 lg:left-auto lg:top-0 lg:w-[52%]')}>
          <img src={p.imageUrl} alt="" decoding="async" className={cn('h-full w-full object-cover', centered && 'opacity-40')} />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent lg:bg-gradient-to-r lg:from-bg lg:via-bg/30" />
        </div>
      )}

      <div className={cn('container pointer-events-none relative flex flex-col pt-[calc(var(--chrome-h,7rem)+2.5rem)] md:pt-[calc(var(--chrome-h,7rem)+4rem)] lg:flex-1', centered ? 'flex-1 items-center text-center' : '')}>
        <div className={cn('pointer-events-auto flex flex-1 flex-col', centered ? 'max-w-4xl items-center justify-center' : 'max-w-[38rem] lg:justify-center xl:max-w-[42rem]')}>
          {p.eyebrow && (
            <motion.p {...enter(0)} className="eyebrow mb-6">
              {p.eyebrow}
            </motion.p>
          )}
          <motion.h1 id="hero-heading" {...enter(1)} className="text-balance bg-gradient-to-b from-fg via-fg to-fg/55 bg-clip-text pb-2 font-display text-[clamp(2.6rem,6.2vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-transparent">
            {p.headline}
          </motion.h1>
          {p.subheadline && (
            <motion.p {...enter(2)} className={cn('mt-6 max-w-xl text-pretty text-base leading-relaxed text-fg/70 md:text-lg', centered && 'mx-auto')}>
              {p.subheadline}
            </motion.p>
          )}
          {p.ctas.length > 0 && (
            <motion.div {...enter(3)} className="mt-9">
              <CtaRow ctas={p.ctas} className={cn(centered && 'justify-center')} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Side-by-side scene: in flow on mobile, bleeding off the right edge on desktop */}
      {showScene && !centered && (
        <div className="relative -z-10 h-[46svh] min-h-[300px] w-full lg:absolute lg:inset-y-0 lg:right-[-4%] lg:h-auto lg:w-[60%]">
          <SceneCanvas config={p.scene} label="Rotating 3D render of the club's training equipment" scrollTarget={ref} fallbackImageUrl={p.imageUrl || undefined} className="h-full w-full" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/4 bg-gradient-to-r from-bg to-transparent lg:block" />
        </div>
      )}

      <div className="container relative pb-8 lg:pointer-events-none lg:[&>*]:pointer-events-auto">
        {(hours || place || p.showScrollHint) && (
          <motion.div {...enter(5)} className="mt-12 flex w-full items-end justify-between gap-6 border-t border-fg/[0.08] pt-5 text-xs text-muted">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {hours && (
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> {hours}
                </span>
              )}
              {place && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {place}
                </span>
              )}
            </div>
            {p.showScrollHint && (
              <span aria-hidden className="hidden items-center gap-3 uppercase tracking-[0.3em] sm:inline-flex">
                Scroll
                <span className="relative block h-10 w-px overflow-hidden bg-fg/15">
                  <span className="scroll-hint-dot absolute left-0 top-0 block h-1.5 w-px bg-primary" />
                </span>
              </span>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
