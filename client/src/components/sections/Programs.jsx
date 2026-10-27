import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Button } from '../ui/Button.jsx';
import { ErrorState, Skeleton } from '../ui/States.jsx';
import { ProgramCard } from './ProgramCard.jsx';

export function FeaturedPrograms() {
  const q = useQuery({ queryKey: ['programs', { featured: 'true' }], queryFn: () => contentApi.programs({ featured: 'true', limit: 6 }) });
  if (q.isSuccess && !q.data.data.length) return null;
  return (
    <Section id="programs">
      <SectionHeading eyebrow="Workout programs" title="Structured paths to every goal" lead="From your first session to your next personal best — every program is coached, tracked and adjusted."
        action={<Button to="/programs" variant="outline">All programs</Button>} />
      {q.isError ? <ErrorState message="Could not load programs." onRetry={q.refetch} /> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {q.isLoading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[380px]" />)
            : q.data.data.map((p, i) => <Reveal key={p._id} delay={(i % 3) * 0.08}><ProgramCard program={p} /></Reveal>)}
        </div>
      )}
    </Section>
  );
}
