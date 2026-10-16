import { useMemo, useState } from 'react';
import { Seo } from '@/components/layout/Seo';
import { PageHero } from '@/components/layout/PageHero';
import { ScheduleList } from '@/features/sections/cards';
import { CardSkeletons, QuietError } from '@/features/sections/primitives';
import { useClasses } from '@/features/sections/queries';
import { titleCase } from '@/lib/format';

export default function SchedulePage() {
  const q = useClasses(14, 200);
  const [level, setLevel] = useState('');
  const [trainer, setTrainer] = useState('');
  const all = q.data ?? [];
  const trainers = useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((c) => c.trainer && m.set(c.trainer.id, c.trainer.name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);
  const levels = useMemo(() => Array.from(new Set(all.map((c) => c.level))).sort(), [all]);
  const list = all.filter((c) => (!level || c.level === level) && (!trainer || c.trainer?.id === trainer));

  const sel = 'input h-11 w-full appearance-none rounded-btn pr-9 sm:w-56';
  return (
    <>
      <Seo title="Class schedule" description="Upcoming coached classes for the next two weeks. Members book from their dashboard." />
      <PageHero eyebrow="Schedule" title="The next two weeks on the floor." description="Small-group, coach-led classes. Members can book or join the waitlist from their dashboard.">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => e.preventDefault()} aria-label="Filter classes">
          <div>
            <label htmlFor="f-level" className="label">
              Level
            </label>
            <select id="f-level" className={sel} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l === 'all' ? 'Open to all' : titleCase(l)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-trainer" className="label">
              Coach
            </label>
            <select id="f-trainer" className={sel} value={trainer} onChange={(e) => setTrainer(e.target.value)}>
              <option value="">All coaches</option>
              {trainers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {(level || trainer) && (
            <button type="button" className="btn btn-ghost h-11" onClick={() => (setLevel(''), setTrainer(''))}>
              Clear filters
            </button>
          )}
        </form>
      </PageHero>
      <section className="section" aria-label="Classes">
        <div className="container" aria-live="polite">
          {q.isLoading ? (
            <CardSkeletons count={3} className="sm:grid-cols-1 lg:grid-cols-1" itemClassName="h-40" />
          ) : q.isError ? (
            <QuietError what="Class times" onRetry={() => q.refetch()} />
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-muted">{all.length ? 'No classes match these filters.' : 'No classes are scheduled in the next two weeks yet.'}</p>
          ) : (
            <ScheduleList classes={list} />
          )}
        </div>
      </section>
    </>
  );
}
