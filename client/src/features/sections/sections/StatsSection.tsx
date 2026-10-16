import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import type { SectionProps } from '@apex/shared';
import { RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { SectionHeading, SectionShell, useHeadingId } from '../primitives';
import { useLiveStats } from '../queries';

const nf = new Intl.NumberFormat('en-IN');

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(value);
      return;
    }
    const ctrl = animate(0, value, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => ctrl.stop();
  }, [inView, value, reduced]);
  return (
    <span ref={ref} className="tabular-nums">
      {/* Screen readers get the final value immediately. */}
      <span aria-hidden>{nf.format(shown)}</span>
      <span className="sr-only">{nf.format(value)}</span>
      {suffix && <span className="text-primary">{suffix}</span>}
    </span>
  );
}

export function StatsSection({ p }: { p: SectionProps<'stats'> }) {
  const headingId = useHeadingId(p);
  const needsLive = p.items.some((i) => i.metric !== 'manual');
  const live = useLiveStats(needsLive);
  const items = p.items.map((i) => ({ ...i, value: i.metric === 'manual' ? i.value : live.data?.[i.metric] ?? null }));

  return (
    <SectionShell type="stats" props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} />
        <RevealGroup as="ul" className={`grid grid-cols-2 gap-y-10 border-t border-fg/[0.08] ${items.length <= 2 ? 'md:grid-cols-2' : items.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {items.map((it, i) => (
            <RevealItem as="li" key={`${it.label}-${i}`} className="relative border-fg/[0.08] pr-4 pt-8 md:border-l md:pl-8 md:first:border-l-0 md:first:pl-0">
              <p className="font-display text-[clamp(2.75rem,6vw,4.75rem)] font-semibold leading-none tracking-tight">
                {it.value === null ? <span className="text-fg/20">—</span> : <CountUp value={it.value} suffix={it.suffix} />}
              </p>
              <p className="mt-4 text-sm uppercase tracking-[0.16em] text-muted">{it.label}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </SectionShell>
  );
}
