import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../../services/content.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Button } from '../ui/Button.jsx';
import { ErrorState } from '../ui/States.jsx';
import { TrainerCard, TrainerCardSkeleton } from './TrainerCard.jsx';

export function FeaturedTrainers() {
  const q = useQuery({ queryKey: ['trainers', { featured: 'true' }], queryFn: () => contentApi.trainers({ featured: 'true', limit: 4 }) });
  if (q.isSuccess && !q.data.data.length) return null;
  return (
    <Section id="trainers">
      <SectionHeading
        eyebrow="Personal trainers"
        title="Coached by the best in the country"
        lead="Certified specialists in strength, transformation, mobility and conditioning."
        action={<Button to="/trainers" variant="outline">All trainers</Button>}
      />
      {q.isError ? (
        <ErrorState message="Could not load trainers." onRetry={q.refetch} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {q.isLoading
            ? Array.from({ length: 4 }, (_, i) => <TrainerCardSkeleton key={i} />)
            : q.data.data.map((t, i) => (
              <Reveal key={t._id} delay={i * 0.08}><TrainerCard trainer={t} /></Reveal>
            ))}
        </div>
      )}
    </Section>
  );
}
