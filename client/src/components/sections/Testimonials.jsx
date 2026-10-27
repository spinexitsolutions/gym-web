import { useQuery } from '@tanstack/react-query';
import { Quote, Star } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Img } from '../ui/Img.jsx';
import { DemoBadge } from '../ui/Badge.jsx';

export function Testimonials() {
  const q = useQuery({ queryKey: ['testimonials'], queryFn: contentApi.testimonials });
  if (!q.data?.length) return null;
  return (
    <Section id="testimonials" className="bg-surface/30">
      <SectionHeading align="center" eyebrow="Success stories" title="What our members say" />
      <div className="grid gap-6 md:grid-cols-3">
        {q.data.map((t, i) => (
          <Reveal key={t._id} delay={i * 0.08} className="glass flex h-full flex-col rounded-brand p-8">
            <Quote className="h-8 w-8 text-gold/70" aria-hidden />
            {t.headline && <p className="mt-5 font-display text-xl font-semibold">{t.headline}</p>}
            <blockquote className="mt-3 flex-1 text-pretty leading-relaxed text-muted">“{t.quote}”</blockquote>
            <div className="mt-6 flex items-center gap-4 border-t border-line/10 pt-6">
              {t.photo?.url && <Img image={t.photo} alt={t.name} className="h-12 w-12 rounded-full" sizes="48px" />}
              <div className="flex-1">
                <p className="font-semibold">{t.name}</p>
                {t.memberSince && <p className="text-xs text-muted">Member since {t.memberSince}</p>}
              </div>
              <div className="flex" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: t.rating }, (_, k) => <Star key={k} className="h-4 w-4 fill-gold text-gold" aria-hidden />)}
              </div>
            </div>
            {t.isDemo && <div className="mt-4"><DemoBadge show /></div>}
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
