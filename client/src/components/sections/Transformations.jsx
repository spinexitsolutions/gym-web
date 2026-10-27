import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Img } from '../ui/Img.jsx';

// Keyboard-accessible before/after comparison slider.
function BeforeAfter({ item }) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="overflow-hidden rounded-brand border border-line/10 bg-surface">
      <div className="relative aspect-[4/5] select-none">
        <Img image={item.afterImage} alt={`${item.memberName || 'Member'} after`} sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Img image={item.beforeImage} alt={`${item.memberName || 'Member'} before`} sizes="(min-width: 1024px) 33vw, 100vw" className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-gold" style={{ left: `${pos}%` }} aria-hidden />
        <span className="absolute left-3 top-3 rounded-full bg-[#0B0B0C]/70 px-3 py-1 text-xs text-[#F4F1EA]">Before</span>
        <span className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-[#0B0B0C]">After</span>
        <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Drag to compare before and after" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      <figcaption className="p-5">
        <p className="font-semibold">{item.title}</p>
        <p className="text-sm text-muted">{[item.memberName, item.durationLabel].filter(Boolean).join(' · ')}</p>
        {item.caption && <p className="mt-2 text-sm text-muted">{item.caption}</p>}
      </figcaption>
    </figure>
  );
}

export function Transformations() {
  const q = useQuery({ queryKey: ['gallery', 'transformation'], queryFn: () => contentApi.gallery({ category: 'transformation', limit: 6 }) });
  const items = (q.data || []).filter((i) => i.beforeImage?.url && i.afterImage?.url);
  if (!items.length) return null; // only real, consented stories are ever shown
  return (
    <Section id="transformations">
      <SectionHeading eyebrow="Transformations" title="Real members. Real results." lead="Shared with each member's written consent. Individual results vary." />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => <Reveal key={it._id} delay={i * 0.08}><BeforeAfter item={it} /></Reveal>)}
      </div>
    </Section>
  );
}
