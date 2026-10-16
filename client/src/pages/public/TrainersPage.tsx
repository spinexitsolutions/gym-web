import { Seo } from '@/components/layout/Seo';
import { PageHero } from '@/components/layout/PageHero';
import { RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { TrainerCard } from '@/features/sections/cards';
import { CardSkeletons, QuietError } from '@/features/sections/primitives';
import { useTrainers } from '@/features/sections/queries';
import { CmsBottomCta } from './shared';

export default function TrainersPage() {
  const q = useTrainers(50);
  return (
    <>
      <Seo title="Trainers" description="Meet the certified coaches who program, cue and track every session." />
      <PageHero eyebrow="Coaches" title="Coaching that changes outcomes." description="Certified specialists in strength, conditioning, mobility and performance — each one accountable for your progress." />
      <section className="section" aria-label="Coaching team">
        <div className="container">
          {q.isLoading ? (
            <CardSkeletons count={4} className="grid-cols-2 lg:grid-cols-4" itemClassName="aspect-[4/5] h-auto" />
          ) : q.isError ? (
            <QuietError what="Coach profiles" onRetry={() => q.refetch()} />
          ) : !q.data?.length ? (
            <p className="py-16 text-center text-muted">Our coaching team profiles are coming soon.</p>
          ) : (
            <RevealGroup className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
              {q.data.map((t) => (
                <RevealItem key={t.id}>
                  <TrainerCard trainer={t} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
        </div>
      </section>
      <CmsBottomCta title="Train one-to-one." body="Personal training sessions are bookable from your member dashboard once you join." />
    </>
  );
}
