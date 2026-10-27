import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { cn } from '../../utils/cn.js';

function Item({ q, a, open, onToggle }) {
  const id = useId();
  return (
    <div className="border-b border-line/10">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="flex w-full items-center justify-between gap-6 py-6 text-left font-sans text-base font-medium transition hover:text-gold md:text-lg">
          {q}
          <Plus className={cn('h-5 w-5 shrink-0 text-gold transition-transform duration-300', open && 'rotate-45')} aria-hidden />
        </button>
      </h3>
      <div id={id} role="region" hidden={!open} className="pb-6 pr-10 leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export function Faq() {
  const q = useQuery({ queryKey: ['faqs'], queryFn: contentApi.faqs });
  const [open, setOpen] = useState(0);
  if (!q.data?.length) return null;
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading className="mb-0" eyebrow="FAQ" title="Questions, answered" lead="Can't find what you need? Message us on WhatsApp or use the contact form." />
        <div className="border-t border-line/10">
          {q.data.map((f, i) => <Item key={f._id} q={f.question} a={f.answer} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />)}
        </div>
      </div>
    </Section>
  );
}
