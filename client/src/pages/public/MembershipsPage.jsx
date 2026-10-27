import { useMemo, useState } from 'react';
import { Check, Minus, BadgePercent, CalendarClock, ShieldCheck, Ticket } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { PricingGrid, usePlans } from '../../components/sections/Pricing.jsx';
import { Section, SectionHeading } from '../../components/ui/Section.jsx';
import { Reveal } from '../../components/ui/Reveal.jsx';
import { Faq } from '../../components/sections/Faq.jsx';
import { formatPaise, PERIODS } from '../../utils/format.js';

function ComparisonTable() {
  const { data: plans } = usePlans();
  const rows = useMemo(() => {
    const labels = [];
    (plans || []).forEach((p) => p.comparison?.forEach((r) => !labels.includes(r.label) && labels.push(r.label)));
    return labels;
  }, [plans]);
  const [period, setPeriod] = useState('monthly');
  if (!plans?.length || !rows.length) return null;

  const cell = (value) => {
    if (!value || /^(no|0|-)$/i.test(value)) return <Minus className="mx-auto h-4 w-4 text-muted/50" aria-label="Not included" />;
    if (/^yes$/i.test(value)) return <Check className="mx-auto h-4 w-4 text-gold" aria-label="Included" />;
    return value;
  };

  return (
    <Section id="compare" className="bg-surface/30">
      <SectionHeading eyebrow="Compare" title="Plan comparison" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Object.entries(PERIODS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${period === k ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted'}`}>{v.label}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-brand border border-line/10">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Membership plan comparison</caption>
          <thead>
            <tr className="border-b border-line/10 bg-surface">
              <th scope="col" className="p-5 text-left font-medium text-muted">Feature</th>
              {plans.map((p) => (
                <th key={p._id} scope="col" className={`p-5 text-center ${p.isFeatured ? 'text-gold' : ''}`}>
                  <span className="block font-display text-lg">{p.name}</span>
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {(() => { const o = p.pricing.find((x) => x.period === period); return o ? `${formatPaise(o.pricePaise)} ${PERIODS[period].short}` : 'Not offered'; })()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((label) => (
              <tr key={label} className="border-b border-line/10 last:border-0">
                <th scope="row" className="p-5 text-left font-normal">{label}</th>
                {plans.map((p) => <td key={p._id} className="p-5 text-center text-muted">{cell(p.comparison.find((r) => r.label === label)?.value)}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row" className="p-5 text-left font-normal">Joining fee</th>
              {plans.map((p) => <td key={p._id} className="p-5 text-center text-muted">{p.joiningFeePaise ? formatPaise(p.joiningFeePaise) : 'Waived'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const BENEFITS = [
  { icon: BadgePercent, title: 'Save up to 25%', text: 'Quarterly, half-yearly and yearly plans include automatic discounts.' },
  { icon: Ticket, title: 'Coupons & referrals', text: 'Apply promo codes at checkout. Refer a friend and both of you save.' },
  { icon: CalendarClock, title: 'Easy renewal', text: 'Renew from your dashboard in a few taps — we remind you before expiry.' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'UPI, cards and netbanking via Razorpay. We never store card details.' },
];

export default function MembershipsPage() {
  const { data: s } = useSettings();
  const policy = s.membershipPolicy;
  return (
    <>
      <Seo title="Membership plans" description="Compare Basic, Standard, Premium and Elite memberships with monthly to yearly options." path="/memberships" />
      <PageHero eyebrow="Memberships" title="Choose how you train" lead="Four tiers, four billing periods, one standard of excellence. Upgrade or renew any time from your dashboard." />
      <Section><PricingGrid /></Section>
      <ComparisonTable />
      <Section>
        <SectionHeading eyebrow="Member benefits" title="More than a gym membership" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.06} className="rounded-brand border border-line/10 bg-surface p-6">
              <Icon className="h-6 w-6 text-gold" aria-hidden />
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </Reveal>
          ))}
        </div>
      </Section>
      <Section id="policies" className="bg-surface/30">
        <SectionHeading eyebrow="Policies" title="Terms, cancellation & refunds" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[['Membership terms', policy.terms], ['Cancellation policy', policy.cancellation], ['Refund policy', policy.refund]].map(([title, text]) => (
            <article key={title} className="rounded-brand border border-line/10 bg-surface p-6">
              <h3 className="font-sans text-lg font-semibold">{title}</h3>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{text.split(/\n+/).map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
            </article>
          ))}
        </div>
      </Section>
      <Faq />
    </>
  );
}
