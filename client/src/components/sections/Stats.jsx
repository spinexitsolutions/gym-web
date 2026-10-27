import { useEffect, useState } from 'react';
import { useInView } from '../../hooks/useInView.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

function Counter({ value, suffix, start }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!start || reduced) { if (reduced) setN(value); return undefined; }
    let raf;
    const t0 = performance.now();
    const dur = 1600;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, value, reduced]);
  return <>{n.toLocaleString('en-IN')}{suffix}</>;
}

export function Stats({ stats }) {
  const [ref, inView] = useInView({ rootMargin: '-80px' });
  if (!stats?.items?.length) return null;
  return (
    <section id="stats" ref={ref} aria-label="Club statistics" className="relative border-y border-line/10 bg-surface/50">
      <div className="container grid grid-cols-2 divide-line/10 md:grid-cols-4 md:divide-x">
        {stats.items.map((s) => (
          <div key={s.label} className="px-4 py-10 text-center md:py-14">
            <p className="font-display text-4xl font-semibold text-gold-metal md:text-6xl">
              <Counter value={s.value} suffix={s.suffix} start={inView} />
            </p>
            <p className="mt-3 text-[0.7rem] uppercase tracking-eyebrow text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
