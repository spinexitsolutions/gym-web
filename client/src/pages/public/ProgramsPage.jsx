import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { ProgramCard } from '../../components/sections/ProgramCard.jsx';
import { ErrorState, EmptyState, Skeleton } from '../../components/ui/States.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CATEGORY_LABELS } from '../../utils/format.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../utils/cn.js';

export default function ProgramsPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const difficulty = params.get('difficulty') || '';
  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const debouncedQ = useDebounced(q, 300);
  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const query = useQuery({
    queryKey: ['programs', { category, difficulty, q: debouncedQ, page }],
    queryFn: () => contentApi.programs({ category, difficulty, q: debouncedQ, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <Seo title="Workout programs" description="Weight loss, muscle building, strength, HIIT, yoga, cardio and beginner programs." path="/programs" />
      <PageHero eyebrow="Programs" title="Find the program built for your goal" lead="Every program lists its difficulty, duration, coaches and which memberships include it." />
      <Section className="pt-12 md:pt-16">
        <div className="mb-10 space-y-5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="program-search" className="sr-only">Search programs</label>
            <input id="program-search" type="search" className="input pl-11" placeholder="Search programs" value={q} onChange={(e) => update({ q: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {[['', 'All'], ...Object.entries(CATEGORY_LABELS)].map(([k, label]) => (
              <button key={k || 'all'} type="button" aria-pressed={category === k} onClick={() => update({ category: k })}
                className={cn('rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition', category === k ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by difficulty">
            {['', 'beginner', 'intermediate', 'advanced'].map((d) => (
              <button key={d || 'any'} type="button" aria-pressed={difficulty === d} onClick={() => update({ difficulty: d })}
                className={cn('rounded-full px-3 py-1 text-xs capitalize transition', difficulty === d ? 'bg-ink/10 text-ink' : 'text-muted hover:text-ink')}>{d || 'Any level'}</button>
            ))}
          </div>
        </div>

        {query.isError ? <ErrorState message="Could not load programs." onRetry={query.refetch} />
          : query.isLoading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[380px]" />)}</div>
            : !query.data.data.length ? <EmptyState title="No programs match" message="Try a different category or clear the filters." action={<Button size="sm" variant="outline" onClick={() => setParams({})}>Clear filters</Button>} />
              : (
                <>
                  <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity', query.isFetching && 'opacity-60')}>
                    {query.data.data.map((p) => <ProgramCard key={p._id} program={p} />)}
                  </div>
                  <Pagination meta={query.data.meta} onPage={(p) => update({ page: String(p) })} />
                </>
              )}
      </Section>
    </>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-3">
      <Button size="sm" variant="subtle" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
      <span className="text-sm text-muted">Page {meta.page} of {meta.pages}</span>
      <Button size="sm" variant="subtle" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
    </nav>
  );
}
