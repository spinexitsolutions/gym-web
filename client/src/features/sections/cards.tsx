/** Presentational building blocks shared by CMS sections and public pages. */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Clock, Minus, Plus, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, initials, money, titleCase } from '@/lib/format';
import type { BlogPostSummary, ClassItem, Faq, Plan, Program, TrainerPublic } from '@/types/api';
import { Img, MonogramArt } from './primitives';

/* ---------------------------------------------------------------- programs */

const levelLabel = (l: string) => (l === 'all' ? 'All levels' : titleCase(l));

export function ProgramCard({ program, index }: { program: Program; index: number }) {
  const meta = [program.durationWeeks && `${program.durationWeeks} weeks`, program.sessionsPerWeek && `${program.sessionsPerWeek}× / week`].filter(Boolean).join(' · ');
  return (
    <Link to={`/programs/${program.slug}`} className="card lift group flex h-full flex-col overflow-hidden hover:border-fg/20">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-fg/[0.06]">
        {program.imageUrl ? (
          <Img src={program.imageUrl} alt={program.title} className="transition duration-700 group-hover:scale-[1.04]" />
        ) : (
          <MonogramArt text={initials(program.title)} label={levelLabel(program.level)} index={index} />
        )}
        {program.featured && <span className="absolute bottom-4 right-4 rounded-full bg-bg/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">Featured</span>}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <span>{levelLabel(program.level)}</span>
          {meta && <span className="h-px w-4 bg-fg/20" aria-hidden />}
          {meta && <span className="normal-case tracking-normal">{meta}</span>}
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">{program.title}</h3>
        {program.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{program.summary}</p>}
        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium text-fg/80 transition group-hover:text-primary">
          View program <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/* ---------------------------------------------------------------- trainers */

export function TrainerCard({ trainer }: { trainer: TrainerPublic }) {
  return (
    <Link to={`/trainers/${trainer.slug}`} className="group block">
      <div className="lift relative aspect-[4/5] overflow-hidden rounded-theme border border-fg/[0.08]">
        {trainer.photoUrl ? (
          <Img src={trainer.photoUrl} alt={`Portrait of ${trainer.displayName}`} className="grayscale-[35%] transition duration-700 group-hover:scale-[1.04] group-hover:grayscale-0" />
        ) : (
          <MonogramArt text={initials(trainer.displayName)} label={trainer.specializations[0]} />
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          {trainer.experienceYears > 0 && <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">{trainer.experienceYears}+ yrs coaching</p>}
          <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{trainer.displayName}</h3>
          {trainer.title && <p className="text-sm text-fg/70">{trainer.title}</p>}
        </div>
        <span aria-hidden className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-fg/15 bg-bg/40 opacity-0 backdrop-blur transition group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      {trainer.specializations.length > 0 && (
        <p className="mt-3 text-xs text-muted">{trainer.specializations.slice(0, 3).join(' · ')}</p>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ plans */

export function durationLabel(days: number) {
  if (days === 7) return 'week';
  if (days >= 28 && days <= 31) return 'month';
  if (days >= 88 && days <= 92) return '3 months';
  if (days >= 180 && days <= 184) return '6 months';
  if (days >= 364 && days <= 366) return 'year';
  return `${days} days`;
}

export function useJoinHref() {
  const { user } = useAuth();
  return (plan: Plan) => {
    const checkout = `/member/checkout/${plan.id}`;
    return user ? checkout : `/register?next=${encodeURIComponent(checkout)}`;
  };
}

export function PlanCard({ plan, highlighted }: { plan: Plan; highlighted: boolean }) {
  const joinHref = useJoinHref();
  const perMonth = plan.durationDays >= 85 && plan.priceMinor > 0 ? Math.round(plan.priceMinor / (plan.durationDays / 30) / 100) * 100 : null;
  const label = plan.promoLabel || (highlighted ? 'Most popular' : plan.isTrial ? 'Try it' : '');
  return (
    <div className={cn('card lift relative flex h-full flex-col p-7 md:p-8', highlighted && 'glow-accent border-primary/40')}>
      {highlighted && <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">{plan.name}</h3>
          {plan.tagline && <p className="mt-1 text-sm text-muted">{plan.tagline}</p>}
        </div>
        {label && <span className={cn('shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em]', highlighted ? 'bg-primary text-on-primary' : 'bg-fg/[0.06] text-fg/80')}>{label}</span>}
      </div>
      <div className="mt-8 flex items-end gap-2">
        <span className="font-display text-5xl font-semibold tracking-tight tabular-nums">{plan.priceMinor === 0 ? 'Free' : money(plan.priceMinor)}</span>
        <span className="pb-1.5 text-sm text-muted">{plan.priceMinor === 0 ? `for ${plan.durationDays} days` : `/ ${durationLabel(plan.durationDays)}`}</span>
      </div>
      <div className="mt-2 min-h-[1.25rem] text-xs text-muted">
        {plan.compareAtMinor && plan.compareAtMinor > plan.priceMinor ? <span className="mr-3 line-through">{money(plan.compareAtMinor)}</span> : null}
        {perMonth && <span>≈ {money(perMonth)} per month</span>}
      </div>
      <div className="my-7 hairline" />
      <ul className="flex-1 space-y-3 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-3 text-fg/85">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <Link to={joinHref(plan)} className={cn('btn mt-8 w-full', highlighted ? 'btn-primary' : 'btn-secondary')} aria-label={`${plan.isTrial ? 'Start' : 'Join'} ${plan.name}`}>
        {plan.isTrial ? 'Start trial' : 'Join now'} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {plan.cancellationPolicy && <p className="mt-4 text-xs leading-relaxed text-muted">{plan.cancellationPolicy}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- schedule */

export function groupClassesByDay(classes: ClassItem[]) {
  const map = new Map<string, { label: string; date: string; items: ClassItem[] }>();
  for (const c of classes) {
    const key = fmtDate(c.startsAt, { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!map.has(key)) map.set(key, { label: fmtDate(c.startsAt, { weekday: 'long' }), date: fmtDate(c.startsAt, { day: 'numeric', month: 'short' }), items: [] });
    map.get(key)!.items.push(c);
  }
  return [...map.values()];
}

export function ClassRow({ c }: { c: ClassItem }) {
  const cancelled = c.status === 'cancelled';
  const full = c.spotsLeft <= 0;
  return (
    <li className={cn('grid grid-cols-[4.5rem_1fr] items-center gap-x-4 gap-y-3 border-b border-fg/[0.07] py-5 sm:grid-cols-[6rem_1fr_auto_auto] sm:gap-x-6', cancelled && 'opacity-50')}>
      <div className="font-display text-lg font-semibold tabular-nums">
        {fmtTime(c.startsAt)}
        <span className="block text-xs font-normal text-muted">{Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60000)} min</span>
      </div>
      <div className="min-w-0">
        <p className={cn('truncate font-medium', cancelled && 'line-through')}>{c.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted">{[c.trainer?.name, c.location].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 text-xs sm:col-start-auto">
        <span className="rounded-full border border-fg/10 px-2.5 py-1 text-fg/70">{levelLabel(c.level)}</span>
        {!cancelled && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1', full ? 'bg-warning/10 text-warning' : 'text-muted')}>
            <Users className="h-3 w-3" aria-hidden />
            {full ? 'Full — waitlist' : `${c.spotsLeft} of ${c.capacity} spots`}
          </span>
        )}
        {cancelled && <span className="rounded-full bg-danger/10 px-2.5 py-1 text-danger">Cancelled</span>}
      </div>
      <div className="col-start-2 sm:col-start-auto">
        {!cancelled && (
          <Link to="/member/book" className="btn btn-secondary btn-sm" aria-label={`Book ${c.title} at ${fmtTime(c.startsAt)}`}>
            {full ? 'Join waitlist' : 'Book'}
          </Link>
        )}
      </div>
    </li>
  );
}

export function ScheduleList({ classes, dense }: { classes: ClassItem[]; dense?: boolean }) {
  const days = groupClassesByDay(classes);
  return (
    <div className={cn('grid gap-10', !dense && 'lg:gap-14')}>
      {days.map((d) => (
        <section key={d.label + d.date} aria-label={`${d.label} ${d.date}`} className="grid gap-4 md:grid-cols-[12rem_1fr] md:gap-10">
          <div className="md:sticky md:top-28 md:self-start">
            <p className="font-display text-2xl font-semibold tracking-tight">{d.label}</p>
            <p className="text-sm text-muted">
              {d.date} · {d.items.length} {d.items.length === 1 ? 'class' : 'classes'}
            </p>
          </div>
          <ul className="border-t border-fg/[0.07]">
            {d.items.map((c) => (
              <ClassRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- blog */

export function PostCard({ post, large }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <Link to={`/blog/${post.slug}`} className={cn('group flex h-full flex-col', large && 'lg:grid lg:grid-cols-2 lg:gap-10')}>
      <div className={cn('lift relative overflow-hidden rounded-theme border border-fg/[0.08]', large ? 'aspect-[16/10]' : 'aspect-[16/10]')}>
        {post.coverImage ? (
          <Img src={post.coverImage} alt="" className="transition duration-700 group-hover:scale-[1.04]" />
        ) : (
          <MonogramArt text={initials(post.title)} label={post.category} />
        )}
      </div>
      <div className={cn('flex flex-1 flex-col pt-5', large && 'lg:justify-center lg:pt-0')}>
        <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">
          {post.category && <span className="text-primary">{post.category}</span>}
          <span>{fmtDate(post.publishedAt)}</span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <Clock className="h-3 w-3" aria-hidden /> {post.readingMinutes} min
          </span>
        </p>
        <h3 className={cn('mt-3 text-balance font-display font-semibold tracking-tight transition group-hover:text-primary', large ? 'text-display-md' : 'text-xl')}>{post.title}</h3>
        {post.excerpt && <p className={cn('mt-2 text-muted', large ? 'text-lg' : 'line-clamp-2 text-sm')}>{post.excerpt}</p>}
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------------- faq */

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <li className="border-b border-fg/[0.08]">
      <h3>
        <button type="button" id={`${id}-btn`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={onToggle} className="flex w-full items-center justify-between gap-6 py-6 text-left font-display text-lg font-medium tracking-tight transition hover:text-primary md:text-xl">
          {faq.question}
          <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full border transition', open ? 'border-primary/50 text-primary' : 'border-fg/15 text-fg/70')}>
            {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </span>
        </button>
      </h3>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open} className="pb-6 pr-14">
        <p className="whitespace-pre-line leading-relaxed text-muted">{faq.answer}</p>
      </div>
    </li>
  );
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?._id ?? null);
  return (
    <ul className="border-t border-fg/[0.08]">
      {faqs.map((f) => (
        <FaqItem key={f._id} faq={f} open={open === f._id} onToggle={() => setOpen((o) => (o === f._id ? null : f._id))} />
      ))}
    </ul>
  );
}
