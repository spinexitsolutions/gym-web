import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Crown } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Button } from '../ui/Button.jsx';
import { ErrorState, Skeleton, EmptyState } from '../ui/States.jsx';
import { formatPaise, PERIODS } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: contentApi.plans, staleTime: 60_000 });
}

export function PeriodToggle({ periods, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Billing period" className="mx-auto mb-12 flex w-fit flex-wrap justify-center gap-1 rounded-full border border-line/15 bg-surface p-1">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn('rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition sm:px-5', value === p ? 'bg-gold-metal text-[#0B0B0C]' : 'text-muted hover:text-ink')}
        >
          {PERIODS[p].label}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({ plan, period }) {
  const option = plan.pricing.find((p) => p.period === period) || plan.pricing[0];
  const months = PERIODS[option.period].months;
  const featured = plan.isFeatured;
  return (
    <div className={cn('relative flex h-full flex-col rounded-brand border p-8 transition', featured ? 'border-gold/60 bg-gradient-to-b from-gold/10 to-surface shadow-glow' : 'border-line/10 bg-surface hover:border-gold/30')}>
      {featured && (
        <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-gold-metal px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[#0B0B0C]">
          <Crown className="h-3 w-3" aria-hidden /> Most popular
        </span>
      )}
      <p className="eyebrow">{plan.tier}</p>
      <h3 className="mt-2 text-3xl font-semibold">{plan.name}</h3>
      {plan.tagline && <p className="mt-2 text-sm text-muted">{plan.tagline}</p>}
      <div className="mt-8 border-t border-line/10 pt-6">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold">{formatPaise(option.pricePaise)}</span>
          <span className="text-sm text-muted">{PERIODS[option.period].short}</span>
        </p>
        <p className="mt-2 min-h-5 text-xs text-muted">
          {months > 1 && <>{formatPaise(option.pricePaise / months)} per month</>}
          {option.discountPercent > 0 && <span className="ml-2 font-semibold text-gold">Save {option.discountPercent}%</span>}
        </p>
        <p className="mt-1 text-xs text-muted">
          {plan.joiningFeePaise > 0 ? <>+ {formatPaise(plan.joiningFeePaise)} one-time joining fee</> : 'No joining fee'}
        </p>
      </div>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{b}</li>
        ))}
      </ul>
      <Button to={`/register?plan=${plan.slug}&period=${option.period}`} variant={featured ? 'primary' : 'outline'} className="mt-10 w-full">
        Choose {plan.name}
      </Button>
    </div>
  );
}

export function PricingGrid() {
  const q = usePlans();
  const periods = useMemo(() => {
    const set = new Set((q.data || []).flatMap((p) => p.pricing.map((o) => o.period)));
    return Object.keys(PERIODS).filter((p) => set.has(p));
  }, [q.data]);
  const [period, setPeriod] = useState('monthly');
  const active = periods.includes(period) ? period : periods[0];

  if (q.isError) return <ErrorState message="Could not load membership plans." onRetry={q.refetch} />;
  if (q.isLoading) return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[560px]" />)}</div>;
  if (!q.data.length) return <EmptyState title="Plans coming soon" message="Membership plans will be announced shortly. Contact us for founding-member rates." />;
  return (
    <>
      {periods.length > 1 && <PeriodToggle periods={periods} value={active} onChange={setPeriod} />}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {q.data.map((plan, i) => (
          <Reveal key={plan._id} delay={i * 0.08}><PlanCard plan={plan} period={active} /></Reveal>
        ))}
      </div>
    </>
  );
}

export function PricingSection() {
  return (
    <Section id="plans" className="bg-surface/30">
      <SectionHeading align="center" eyebrow="Membership" title="Invest in the best version of you" lead="Transparent pricing with no hidden fees. Save more with longer commitments." />
      <PricingGrid />
      <p className="mt-10 text-center text-sm text-muted">
        Compare every benefit on the <a href="/memberships" className="text-gold underline underline-offset-4">memberships page</a>.
      </p>
    </Section>
  );
}
