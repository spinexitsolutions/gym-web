import { Link } from 'react-router-dom';
import { Clock, CalendarDays, Gauge } from 'lucide-react';
import { Img } from '../ui/Img.jsx';
import { Badge } from '../ui/Badge.jsx';
import { CATEGORY_LABELS } from '../../utils/format.js';

export function ProgramCard({ program }) {
  return (
    <Link to={`/programs/${program.slug}`} className="group flex h-full flex-col overflow-hidden rounded-brand border border-line/10 bg-surface transition hover:-translate-y-1 hover:border-gold/40">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Img image={program.image} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-full w-full transition duration-700 group-hover:scale-105" />
        <div className="absolute left-4 top-4"><Badge tone="gold" className="bg-[#0B0B0C]/60 backdrop-blur">{CATEGORY_LABELS[program.category]}</Badge></div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-semibold transition group-hover:text-gold">{program.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{program.summary}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line/10 pt-4 text-xs text-muted">
          <div className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-gold" aria-hidden /><dt className="sr-only">Difficulty</dt><dd className="capitalize">{program.difficulty}</dd></div>
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gold" aria-hidden /><dt className="sr-only">Duration</dt><dd>{program.durationWeeks} weeks</dd></div>
          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gold" aria-hidden /><dt className="sr-only">Sessions</dt><dd>{program.sessionsPerWeek}×/week</dd></div>
        </dl>
      </div>
    </Link>
  );
}
