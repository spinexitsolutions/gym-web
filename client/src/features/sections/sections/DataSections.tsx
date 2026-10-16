import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  Activity, Apple, Armchair, ArrowRight, Baby, Bath, Bike, Car, ChevronsLeftRight, Coffee, Droplets, Dumbbell, Flame, Footprints, Gauge, HandHeart, HeartPulse, Leaf, Lock, Medal,
  PersonStanding, Quote, Salad, ShieldCheck, ShowerHead, Snowflake, Sparkles, SquareParking, Star, Sun, Target, Thermometer, Timer, Trophy, Users, Waves, Wifi, Wind, Zap, type LucideIcon,
} from 'lucide-react';
import type { SectionProps } from '@apex/shared';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { Reveal, RevealGroup, RevealItem } from '@/components/layout/Reveal';
import type { Facility, GalleryItem } from '@/types/api';
import { FaqAccordion, PlanCard, PostCard, ProgramCard, ScheduleList, TrainerCard } from '../cards';
import { CardSkeletons, EmptyPlaceholder, Img, MonogramArt, QuietError, SectionHeading, SectionShell, useHeadingId, type CommonProps } from '../primitives';
import { useBlogLatest, useClasses, useFacilities, useFaqs, useGallery, usePlans, usePrograms, useReviews, useTestimonials, useTrainers } from '../queries';

/**
 * Generic loading / error / empty handling for data-bound sections.
 * Live site: empty collections hide the section. Preview: a subtle placeholder explains why.
 */
function DataSection<T>({
  type,
  p,
  query,
  label,
  where,
  what,
  skeleton,
  action,
  align,
  children,
}: {
  type: string;
  p: CommonProps;
  query: UseQueryResult<T[]>;
  label: string;
  where: string;
  what: string;
  skeleton?: ReactNode;
  action?: ReactNode;
  align?: 'left' | 'center';
  children: (data: T[]) => ReactNode;
}) {
  const headingId = useHeadingId(p);
  if (query.isSuccess && query.data.length === 0) return <EmptyPlaceholder type={type} label={label} where={where} />;
  return (
    <SectionShell type={type} props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} action={query.isSuccess ? action : undefined} align={align} />
        {query.isLoading ? skeleton ?? <CardSkeletons /> : query.isError ? <QuietError what={what} onRetry={() => query.refetch()} /> : children(query.data ?? [])}
      </div>
    </SectionShell>
  );
}

const ViewAll = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="group inline-flex items-center gap-2 text-sm font-medium text-fg/80 transition hover:text-primary">
    {children} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
  </Link>
);

/* ---------------------------------------------------------------- programs */

export function ProgramsSection({ p }: { p: SectionProps<'programs'> }) {
  const q = usePrograms(p.limit, p.featuredOnly);
  return (
    <DataSection type="programs" p={p} query={q} label="Training programs" where="Admin → Website → Programs" what="Programs" action={<ViewAll to="/programs">All programs</ViewAll>}>
      {(programs) => (
        <>
          {programs.length >= 3 && (
            <div aria-hidden className="marquee relative -mx-5 mb-12 overflow-hidden border-y border-fg/[0.06] py-5 md:-mx-8 xl:-mx-10">
              <div className="marquee-track flex w-max gap-10 whitespace-nowrap">
                {[...programs, ...programs].map((pr, i) => (
                  <span key={i} className="flex items-center gap-10 font-display text-4xl font-semibold uppercase tracking-tight md:text-6xl">
                    <span className={i % 2 ? 'text-outline' : 'text-fg/80'}>{pr.title}</span>
                    <span className="h-2 w-2 rounded-full bg-primary/80" />
                  </span>
                ))}
              </div>
            </div>
          )}
          <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((pr, i) => (
              <RevealItem key={pr._id}>
                <ProgramCard program={pr} index={i} />
              </RevealItem>
            ))}
          </RevealGroup>
        </>
      )}
    </DataSection>
  );
}

/* ---------------------------------------------------------------- trainers */

export function TrainersSection({ p }: { p: SectionProps<'trainers'> }) {
  const q = useTrainers(p.limit);
  return (
    <DataSection type="trainers" p={p} query={q} label="Trainers" where="Admin → Trainers (enable “show on website”)" what="Coach profiles" action={<ViewAll to="/trainers">Meet the team</ViewAll>} skeleton={<CardSkeletons count={4} className="lg:grid-cols-4" itemClassName="aspect-[4/5] h-auto" />}>
      {(trainers) => (
        <RevealGroup className="grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-5 lg:grid-cols-4">
          {trainers.map((t) => (
            <RevealItem key={t.id}>
              <TrainerCard trainer={t} />
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* ----------------------------------------------------------------- pricing */

export function PricingSection({ p }: { p: SectionProps<'pricing'> }) {
  const q = usePlans();
  const filtered = { ...q, data: q.data?.filter((pl) => p.showTrial || !pl.isTrial) } as typeof q;
  return (
    <DataSection type="pricing" p={p} query={filtered} label="Membership pricing" where="Admin → Plans" what="Membership plans" align="center" action={undefined}>
      {(plans) => {
        const highlight = p.highlightPlanSlug || plans.find((pl) => pl.highlight)?.slug;
        return (
          <>
            <RevealGroup className={cn('grid gap-5 md:grid-cols-2', plans.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3')}>
              {plans.map((pl) => (
                <RevealItem key={pl.id}>
                  <PlanCard plan={pl} highlighted={pl.slug === highlight} />
                </RevealItem>
              ))}
            </RevealGroup>
            <p className="mt-10 text-center text-sm text-muted">
              Prices include taxes where applicable.{' '}
              <Link to="/memberships" className="text-fg underline underline-offset-4 hover:text-primary">
                Compare memberships
              </Link>
            </p>
          </>
        );
      }}
    </DataSection>
  );
}

/* ---------------------------------------------------------------- schedule */

export function ScheduleSection({ p }: { p: SectionProps<'schedule'> }) {
  const q = useClasses(p.days, p.limit);
  return (
    <DataSection type="schedule" p={p} query={q} label="Class schedule" where="Admin → Classes" what="Class times" action={<ViewAll to="/schedule">Full timetable</ViewAll>} skeleton={<CardSkeletons count={2} className="sm:grid-cols-1 lg:grid-cols-1" itemClassName="h-40" />}>
      {(classes) => <ScheduleList classes={classes} dense />}
    </DataSection>
  );
}

/* ---------------------------------------------------------- transformations */

export function TransformationsSection({ p }: { p: SectionProps<'transformations'> }) {
  const q = useGallery('transformation', p.limit);
  return (
    <DataSection type="transformations" p={p} query={q} label="Transformation stories" where="Admin → Website → Gallery (category: transformation, with consent)" what="Member stories">
      {(items) => (
        <RevealGroup className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <RevealItem key={it._id} as="article" className="card flex h-full flex-col overflow-hidden">
              <div className="aspect-[4/3] border-b border-fg/[0.06]">{it.imageUrl ? <Img src={it.imageUrl} alt={`${it.memberDisplayName || 'Member'} — ${it.title}`} /> : <MonogramArt text={initials(it.memberDisplayName || it.title)} label={it.durationWeeks ? `${it.durationWeeks} weeks` : undefined} />}</div>
              <div className="flex flex-1 flex-col p-6">
                {it.resultSummary && <p className="font-display text-2xl font-semibold tracking-tight text-primary">{it.resultSummary}</p>}
                <h3 className="mt-2 font-display text-lg font-semibold">{it.title}</h3>
                {it.story && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted">{it.story}</p>}
                <p className="mt-auto pt-5 text-xs uppercase tracking-[0.18em] text-muted">
                  {[it.memberDisplayName, it.durationWeeks ? `${it.durationWeeks} weeks` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* ------------------------------------------------------------- testimonials */

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i < rating ? 'fill-primary text-primary' : 'text-fg/20')} aria-hidden />
      ))}
    </span>
  );
}

export function TestimonialsSection({ p }: { p: SectionProps<'testimonials'> }) {
  const t = useTestimonials(p.limit);
  const r = useReviews(p.limit);
  type Item = { id: string; name: string; subtitle?: string; quote: string; rating: number; avatarUrl?: string };
  const items: Item[] = [
    ...(t.data ?? []).map((x) => ({ id: x._id, name: x.name, subtitle: x.subtitle, quote: x.quote, rating: x.rating, avatarUrl: x.avatarUrl })),
    ...(r.data ?? []).filter((x) => x.body).map((x) => ({ id: x._id, name: x.displayName || 'Member', subtitle: x.title || 'Verified member', quote: x.body!, rating: x.rating })),
  ].slice(0, p.limit);
  const merged = { ...t, isLoading: t.isLoading || r.isLoading, isSuccess: t.isSuccess && !r.isLoading, isError: t.isError && r.isError, data: items } as unknown as UseQueryResult<Item[]>;
  return (
    <DataSection type="testimonials" p={p} query={merged} label="Testimonials" where="Admin → Website → Testimonials or Reviews" what="Testimonials">
      {(list) => (
        <RevealGroup className="columns-1 gap-5 md:columns-2 lg:columns-3">
          {list.map((x) => (
            <RevealItem key={x.id} as="article" className="card mb-5 break-inside-avoid p-7">
              <Quote className="h-6 w-6 text-primary/70" aria-hidden />
              <blockquote className="mt-4 text-pretty leading-relaxed text-fg/85">“{x.quote}”</blockquote>
              <footer className="mt-6 flex items-center justify-between gap-4 border-t border-fg/[0.07] pt-5">
                <div className="flex items-center gap-3">
                  {x.avatarUrl ? <img src={x.avatarUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-fg/[0.06] text-sm font-semibold">{initials(x.name)}</span>}
                  <div>
                    <p className="text-sm font-semibold">{x.name}</p>
                    {x.subtitle && <p className="text-xs text-muted">{x.subtitle}</p>}
                  </div>
                </div>
                {p.showRatings && <Stars rating={x.rating} />}
              </footer>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* ------------------------------------------------------------- before/after */

/** Accessible comparison slider: a native range input drives the clip (keyboard + screen reader friendly). */
function BeforeAfterSlider({ item }: { item: GalleryItem }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  const who = item.memberDisplayName || 'Member';
  return (
    <figure className="card overflow-hidden">
      <div className="relative aspect-[4/5] select-none overflow-hidden">
        <img src={item.afterUrl} alt={`${who} after${item.durationWeeks ? ` ${item.durationWeeks} weeks` : ''}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={item.beforeUrl} alt={`${who} before`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-fg/80" style={{ left: `${pos}%` }}>
          <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-fg/40 bg-bg/70 backdrop-blur">
            <ChevronsLeftRight className="h-4 w-4" />
          </span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] backdrop-blur">Before</span>
        <span className="absolute right-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] backdrop-blur">After</span>
        <label htmlFor={id} className="sr-only">
          Compare before and after for {who}
        </label>
        <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-valuetext={`${pos}% before image shown`} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      <figcaption className="p-5">
        <p className="font-display text-lg font-semibold">{item.title}</p>
        <p className="mt-1 text-sm text-muted">{[item.resultSummary, item.durationWeeks ? `${item.durationWeeks} weeks` : ''].filter(Boolean).join(' · ')}</p>
      </figcaption>
    </figure>
  );
}

export function BeforeAfterSection({ p }: { p: SectionProps<'beforeAfter'> }) {
  const q = useGallery('before_after', p.limit);
  const filtered = { ...q, data: q.data?.filter((i) => i.beforeUrl && i.afterUrl) } as typeof q;
  return (
    <DataSection type="beforeAfter" p={p} query={filtered} label="Before & after" where="Admin → Website → Gallery (category: before & after, with consent)" what="Results">
      {(items) => (
        <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <RevealItem key={it._id}>
              <BeforeAfterSlider item={it} />
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* --------------------------------------------------------------- facilities */

/** Curated icon set for facilities (admin picks by name); unknown names fall back to a dumbbell. */
const FACILITY_ICONS: Record<string, LucideIcon> = {
  activity: Activity, apple: Apple, armchair: Armchair, baby: Baby, bath: Bath, bike: Bike, car: Car, parking: SquareParking, 'square-parking': SquareParking, coffee: Coffee, droplets: Droplets,
  dumbbell: Dumbbell, flame: Flame, footprints: Footprints, gauge: Gauge, 'hand-heart': HandHeart, heart: HeartPulse, 'heart-pulse': HeartPulse, leaf: Leaf, lock: Lock, medal: Medal,
  'person-standing': PersonStanding, salad: Salad, shield: ShieldCheck, 'shield-check': ShieldCheck, shower: ShowerHead, 'shower-head': ShowerHead, snowflake: Snowflake, sparkles: Sparkles,
  sun: Sun, target: Target, thermometer: Thermometer, sauna: Thermometer, timer: Timer, trophy: Trophy, users: Users, waves: Waves, pool: Waves, wifi: Wifi, wind: Wind, zap: Zap,
};

function FacilityIcon({ name }: { name: string }) {
  const C = FACILITY_ICONS[name.trim().toLowerCase().replace(/[_\s]+/g, '-')] ?? Dumbbell;
  return <C className="h-5 w-5" aria-hidden strokeWidth={1.5} />;
}

export function FacilitiesSection({ p }: { p: SectionProps<'facilities'> }) {
  const q = useFacilities(p.limit);
  return (
    <DataSection type="facilities" p={p} query={q} label="Facilities" where="Admin → Website → Facilities" what="Facilities">
      {(items: Facility[]) => (
        <RevealGroup className="grid border-l border-t border-fg/[0.08] sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f, i) => (
            <RevealItem key={f._id} className="group relative border-b border-r border-fg/[0.08] p-7 transition-colors hover:bg-fg/[0.02] md:p-8">
              {f.imageUrl && (
                <div className="mb-6 aspect-[16/10] overflow-hidden rounded-theme-sm">
                  <Img src={f.imageUrl} alt={f.name} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-fg/10 text-primary transition group-hover:border-primary/40">
                  <FacilityIcon name={f.icon} />
                </span>
                <span className="font-display text-xs tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-8 font-display text-lg font-semibold tracking-tight">{f.name}</h3>
              {f.description && <p className="mt-2 text-sm leading-relaxed text-muted">{f.description}</p>}
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* --------------------------------------------------------------------- blog */

export function BlogSection({ p }: { p: SectionProps<'blog'> }) {
  const q = useBlogLatest(p.limit);
  return (
    <DataSection type="blog" p={p} query={q} label="Blog" where="Admin → Website → Blog" what="Articles" action={<ViewAll to="/blog">All articles</ViewAll>}>
      {(posts) => (
        <RevealGroup className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <RevealItem key={post._id}>
              <PostCard post={post} />
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </DataSection>
  );
}

/* ---------------------------------------------------------------------- faq */

export function FaqSection({ p }: { p: SectionProps<'faq'> }) {
  const q = useFaqs(p.limit, p.category);
  const headingId = useHeadingId(p);
  if (q.isSuccess && q.data.length === 0) return <EmptyPlaceholder type="faq" label="FAQ" where="Admin → Website → FAQs" />;
  return (
    <SectionShell type="faq" props={p} labelledBy={headingId}>
      <div className="container grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-28">
            {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
            {p.heading && (
              <h2 id={headingId} className="text-balance font-display text-display-md font-semibold">
                {p.heading}
              </h2>
            )}
            {p.subheading && <p className="mt-4 text-muted">{p.subheading}</p>}
            <p className="mt-8 text-sm text-muted">
              Still curious?{' '}
              <Link to="/contact" className="text-fg underline underline-offset-4 hover:text-primary">
                Talk to the team
              </Link>
            </p>
          </Reveal>
        </div>
        <div className="lg:col-span-8">{q.isLoading ? <CardSkeletons count={4} className="sm:grid-cols-1 lg:grid-cols-1" itemClassName="h-16" /> : q.isError ? <QuietError what="FAQs" onRetry={() => q.refetch()} /> : <FaqAccordion faqs={q.data ?? []} />}</div>
      </div>
    </SectionShell>
  );
}
