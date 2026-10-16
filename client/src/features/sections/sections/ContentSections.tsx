import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { SectionProps } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { Reveal, RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { CtaButton, CtaRow } from '@/components/layout/SmartLink';
import { EmptyPlaceholder, Img, Markdown, Paragraphs, SectionHeading, SectionShell, useHeadingId, useRenderContext } from '../primitives';

/** Decorative panel used when an optional image is missing. */
function ArtPanel({ word, caption, className }: { word: string; caption?: string; className?: string }) {
  return (
    <div aria-hidden className={cn('metal-panel relative overflow-hidden rounded-theme border border-fg/[0.08]', className)}>
      <div className="bg-grid-fade absolute inset-0 opacity-70" />
      <div className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/[0.05]" />
      <div className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/[0.07]" />
      <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30" />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      <span className="text-outline absolute -bottom-4 left-6 font-display text-[clamp(4rem,10vw,8rem)] font-semibold uppercase leading-none tracking-tighter">{word}</span>
      {caption && <span className="absolute left-6 top-6 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted">{caption}</span>}
    </div>
  );
}

const firstWord = (s: string) => (s.split(/\s+/).find((w) => w.length > 3) ?? s.split(/\s+/)[0] ?? '').replace(/[^\p{L}\p{N}]/gu, '');

/* ------------------------------------------------------------------- about */

export function AboutSection({ p }: { p: SectionProps<'about'> }) {
  const headingId = useHeadingId(p);
  const { site } = useSite();
  const s = site?.settings;
  const est = s?.business.foundedYear;
  return (
    <SectionShell type="about" props={p} labelledBy={headingId}>
      <div className="container grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          {p.imageUrl ? (
            <Reveal className="mb-10 aspect-[4/5] overflow-hidden rounded-theme border border-fg/[0.08]">
              <Img src={p.imageUrl} alt={p.imageAlt} />
            </Reveal>
          ) : null}
          <Reveal>
            {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
            {p.heading && (
              <h2 id={headingId} className="text-balance font-display text-display-lg font-semibold">
                {p.heading}
              </h2>
            )}
            {p.subheading && <p className="mt-5 text-lg text-muted">{p.subheading}</p>}
            {(est || s?.contact.city) && !p.imageUrl && (
              <div className="mt-10 flex items-center gap-6 text-xs uppercase tracking-[0.24em] text-muted">
                {est && (
                  <span>
                    Est. <span className="font-display text-base tracking-normal text-fg">{est}</span>
                  </span>
                )}
                {est && s?.contact.city && <span className="h-px w-10 bg-fg/20" aria-hidden />}
                {s?.contact.city && <span>{s.contact.city}</span>}
              </div>
            )}
          </Reveal>
        </div>
        <div className="lg:col-span-7 lg:pt-14">
          {p.body && (
            <Reveal>
              <Paragraphs text={p.body} className="text-lg leading-relaxed text-fg/75 md:text-xl md:leading-relaxed [&>p:first-child]:text-fg" />
            </Reveal>
          )}
          {p.bullets.length > 0 && (
            <RevealGroup as="ul" className="mt-12 grid border-t border-fg/[0.08] sm:grid-cols-2 sm:gap-x-10">
              {p.bullets.map((b, i) => (
                <RevealItem as="li" key={i} className="flex items-start gap-4 border-b border-fg/[0.08] py-5">
                  <span className="mt-0.5 font-display text-xs tabular-nums text-primary">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-fg/90">{b}</span>
                </RevealItem>
              ))}
            </RevealGroup>
          )}
          {p.cta && (
            <Reveal className="mt-10">
              <CtaButton cta={p.cta} size="md" />
            </Reveal>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- richText */

export function RichTextSection({ p }: { p: SectionProps<'richText'> }) {
  const headingId = useHeadingId(p);
  const center = p.align === 'center';
  return (
    <SectionShell type="richText" props={p} labelledBy={headingId}>
      <div className={cn('container max-w-3xl', center && 'text-center')}>
        <SectionHeading props={p} id={headingId} align={p.align} className="mb-8 md:mb-10" />
        {p.body && (
          <Reveal>
            <Markdown className={cn(center && 'mx-auto [&_ul]:inline-block [&_ul]:text-left')}>{p.body}</Markdown>
          </Reveal>
        )}
      </div>
    </SectionShell>
  );
}

/* --------------------------------------------------------------------- cta */

export function CtaSection({ p }: { p: SectionProps<'cta'> }) {
  const headingId = useHeadingId(p);
  return (
    <SectionShell type="cta" props={p} labelledBy={headingId}>
      <div className="container">
        <Reveal className="glow-accent relative overflow-hidden rounded-theme border border-fg/[0.08] px-6 py-16 text-center md:px-16 md:py-24">
          <div aria-hidden className="metal-panel absolute inset-0 -z-10" />
          <div aria-hidden className="bg-aura absolute inset-0 -z-10" />
          <div aria-hidden className="bg-grid-fade absolute inset-0 -z-10 opacity-60" />
          {p.eyebrow && <p className="eyebrow mb-5 justify-center">{p.eyebrow}</p>}
          {p.heading && (
            <h2 id={headingId} className="mx-auto max-w-3xl text-balance font-display text-display-lg font-semibold">
              {p.heading}
            </h2>
          )}
          {(p.subheading || p.body) && <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted">{p.body || p.subheading}</p>}
          <CtaRow ctas={p.ctas} className="mt-10 justify-center" />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* --------------------------------------------------------------- imageText */

export function ImageTextSection({ p }: { p: SectionProps<'imageText'> }) {
  const headingId = useHeadingId(p);
  const left = p.imageSide === 'left';
  return (
    <SectionShell type="imageText" props={p} labelledBy={headingId}>
      <div className="container grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className={cn('aspect-[5/4] lg:aspect-[4/5]', left ? 'lg:order-1' : 'lg:order-2')}>
          {p.imageUrl ? (
            <div className="h-full overflow-hidden rounded-theme border border-fg/[0.08]">
              <Img src={p.imageUrl} alt={p.imageAlt} />
            </div>
          ) : (
            <ArtPanel word={firstWord(p.heading || p.eyebrow || '')} caption={p.eyebrow} className="h-full" />
          )}
        </Reveal>
        <Reveal className={cn(left ? 'lg:order-2' : 'lg:order-1')}>
          {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
          {p.heading && (
            <h2 id={headingId} className="text-balance font-display text-display-lg font-semibold">
              {p.heading}
            </h2>
          )}
          {p.subheading && <p className="mt-5 text-lg text-muted">{p.subheading}</p>}
          {p.body && <Paragraphs text={p.body} className="mt-6 text-lg leading-relaxed text-fg/75" />}
          <CtaRow ctas={p.ctas} size="md" className="mt-9" />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ----------------------------------------------------------------- gallery */

export function GallerySection({ p }: { p: SectionProps<'gallery'> }) {
  const headingId = useHeadingId(p);
  const images = p.images.filter((i) => i.url);
  if (!images.length) return <EmptyPlaceholder type="gallery" label="Image gallery" where="this section's settings (add images from the media library)" />;
  return (
    <SectionShell type="gallery" props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} />
        <RevealGroup as="ul" className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {images.map((img, i) => (
            <RevealItem as="li" key={`${img.url}-${i}`} className="mb-4 break-inside-avoid overflow-hidden rounded-theme border border-fg/[0.08]">
              <figure>
                <img src={img.url} alt={img.alt} loading="lazy" decoding="async" className="w-full object-cover transition duration-700 hover:scale-[1.03]" />
              </figure>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------- promo */

function useCountdown(endsAt: string) {
  const target = endsAt ? new Date(endsAt).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, target - now);
  return { ended: diff <= 0, d: Math.floor(diff / 86400000), h: Math.floor((diff / 3600000) % 24), m: Math.floor((diff / 60000) % 60), s: Math.floor((diff / 1000) % 60) };
}

export function PromoSection({ p }: { p: SectionProps<'promo'> }) {
  const headingId = useHeadingId(p);
  const { preview } = useRenderContext();
  const cd = useCountdown(p.endsAt);
  if (cd?.ended && !preview) return null;
  return (
    <SectionShell type="promo" props={p} labelledBy={headingId}>
      <div className="container">
        <Reveal className="glow-accent relative isolate grid overflow-hidden rounded-theme border border-primary/25 lg:grid-cols-[1.4fr_1fr]">
          <div aria-hidden className="metal-panel absolute inset-0 -z-20" />
          {p.imageUrl ? (
            <div aria-hidden className="absolute inset-0 -z-10">
              <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
            </div>
          ) : (
            <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          )}
          <div className="p-8 md:p-14">
            {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
            {p.heading && (
              <h2 id={headingId} className="text-balance font-display text-display-md font-semibold">
                {p.heading}
              </h2>
            )}
            {(p.body || p.subheading) && <p className="mt-4 max-w-xl text-lg text-fg/70">{p.body || p.subheading}</p>}
            {p.cta && (
              <div className="mt-8">
                <CtaButton cta={p.cta} />
              </div>
            )}
            {cd?.ended && preview && <p className="mt-6 text-sm text-warning">This offer has ended — it is hidden on the live site.</p>}
          </div>
          <div className="flex items-center border-t border-fg/[0.08] p-8 md:p-14 lg:border-l lg:border-t-0">
            {cd && !cd.ended ? (
              <div className="w-full">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Offer ends {fmtDate(p.endsAt, { day: 'numeric', month: 'long' })}</p>
                <div className="mt-5 grid grid-cols-4 gap-2" role="timer" aria-label={`Offer ends ${fmtDate(p.endsAt, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}`}>
                  {(
                    [
                      ['Days', cd.d],
                      ['Hrs', cd.h],
                      ['Min', cd.m],
                      ['Sec', cd.s],
                    ] as const
                  ).map(([l, v]) => (
                    <div key={l} className="rounded-theme-sm border border-fg/10 bg-bg/40 px-2 py-4 text-center">
                      <span aria-hidden className="block font-display text-3xl font-semibold tabular-nums md:text-4xl">
                        {String(v).padStart(2, '0')}
                      </span>
                      <span aria-hidden className="mt-1 block text-[0.65rem] uppercase tracking-[0.2em] text-muted">
                        {l}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="w-full space-y-3 text-sm text-fg/80">
                <li className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-display text-xl font-semibold">Limited availability</span>
                </li>
                {p.cta && (
                  <li className="pl-12 text-muted">
                    <span className="inline-flex items-center gap-1">
                      {p.cta.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
