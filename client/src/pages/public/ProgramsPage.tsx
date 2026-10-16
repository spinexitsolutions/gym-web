import { useMemo, useState } from 'react';
import { Seo } from '@/components/layout/Seo';
import { FilterChips, PageHero } from '@/components/layout/PageHero';
import { RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { ProgramCard } from '@/features/sections/cards';
import { CardSkeletons, QuietError } from '@/features/sections/primitives';
import { usePrograms } from '@/features/sections/queries';
import { CmsBottomCta } from './shared';

type Level = 'any' | 'beginner' | 'intermediate' | 'advanced';

export default function ProgramsPage() {
  const q = usePrograms(50);
  const [level, setLevel] = useState<Level>('any');
  const list = useMemo(() => (q.data ?? []).filter((p) => level === 'any' || p.level === level || p.level === 'all'), [q.data, level]);
  const levels = new Set((q.data ?? []).map((p) => p.level));
  const options = [{ value: 'any' as Level, label: 'All programs' }, ...(['beginner', 'intermediate', 'advanced'] as const).filter((l) => levels.has(l)).map((l) => ({ value: l as Level, label: l[0].toUpperCase() + l.slice(1) }))];

  return (
    <>
      <Seo title="Programs" description="Structured, coach-led training programs — from your first barbell session to the competition platform." />
      <PageHero eyebrow="Programs" title="Train with structure. Progress with intent." description="Every program is built by our coaching team with clear phases, measurable targets and small-group coaching.">
        {options.length > 2 && <FilterChips label="Filter by level" options={options} value={level} onChange={setLevel} />}
      </PageHero>
      <section className="section" aria-label="Program list">
        <div className="container">
          {q.isLoading ? (
            <CardSkeletons count={6} />
          ) : q.isError ? (
            <QuietError what="Programs" onRetry={() => q.refetch()} />
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-muted">{q.data?.length ? 'No programs at this level right now.' : 'New programs are being finalised — check back soon or book a free trial to talk to a coach.'}</p>
          ) : (
            <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p, i) => (
                <RevealItem key={p._id}>
                  <ProgramCard program={p} index={i} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
        </div>
      </section>
      <CmsBottomCta />
    </>
  );
}
