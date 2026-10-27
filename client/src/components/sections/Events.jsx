import { useQuery } from '@tanstack/react-query';
import { MapPin, Trophy, CalendarDays } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Img } from '../ui/Img.jsx';
import { Badge } from '../ui/Badge.jsx';
import { formatDate } from '../../utils/format.js';

export function Events() {
  const q = useQuery({ queryKey: ['events'], queryFn: contentApi.events });
  if (!q.data?.length) return null;
  return (
    <Section id="events">
      <SectionHeading eyebrow="Events & challenges" title="Train together. Compete together." />
      <div className="grid gap-6 lg:grid-cols-3">
        {q.data.map((e, i) => {
          const sameDay = new Date(e.startDate).toDateString() === new Date(e.endDate).toDateString();
          return (
            <Reveal key={e._id} delay={i * 0.08} className="group overflow-hidden rounded-brand border border-line/10 bg-surface">
              <div className="relative aspect-[16/9] overflow-hidden">
                <Img image={e.image} sizes="(min-width: 1024px) 33vw, 100vw" className="h-full w-full transition duration-700 group-hover:scale-105" />
                <div className="absolute left-4 top-4">
                  <Badge tone="gold" className="bg-[#0B0B0C]/60 backdrop-blur">{e.kind === 'challenge' ? <><Trophy className="h-3 w-3" aria-hidden /> Challenge</> : 'Event'}</Badge>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold">{e.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{e.description}</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gold" aria-hidden />
                    {sameDay ? formatDate(e.startDate) : `${formatDate(e.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(e.endDate)}`}
                  </span>
                  {e.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gold" aria-hidden />{e.location}</span>}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
