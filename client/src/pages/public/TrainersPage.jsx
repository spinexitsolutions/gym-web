import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { TrainerCard, TrainerCardSkeleton } from '../../components/sections/TrainerCard.jsx';
import { ErrorState, EmptyState } from '../../components/ui/States.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';
import { Pagination } from './ProgramsPage.jsx';
import { cn } from '../../utils/cn.js';

export default function TrainersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const specialization = params.get('specialization') || '';
  const page = Number(params.get('page') || 1);
  const debouncedQ = useDebounced(q, 300);
  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const query = useQuery({
    queryKey: ['trainers', { q: debouncedQ, specialization, page }],
    queryFn: () => contentApi.trainers({ q: debouncedQ, specialization, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
  const specs = query.data?.meta?.specializations || [];

  return (
    <>
      <Seo title="Personal trainers" description="Meet our certified personal trainers and book one-to-one sessions." path="/trainers" />
      <PageHero eyebrow="Trainers" title="World-class coaches, personally invested in you" lead="Search by name or specialisation, see qualifications and availability, and book a personal training session." />
      <Section className="pt-12 md:pt-16">
        <div className="mb-10 space-y-5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="trainer-search" className="sr-only">Search trainers</label>
            <input id="trainer-search" type="search" className="input pl-11" placeholder="Search by name or specialisation" value={q} onChange={(e) => update({ q: e.target.value })} />
          </div>
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by specialisation">
              {['', ...specs].map((s) => (
                <button key={s || 'all'} type="button" aria-pressed={specialization === s} onClick={() => update({ specialization: s })}
                  className={cn('rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition', specialization === s ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>{s || 'All'}</button>
              ))}
            </div>
          )}
        </div>
        {query.isError ? <ErrorState message="Could not load trainers." onRetry={query.refetch} />
          : query.isLoading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <TrainerCardSkeleton key={i} />)}</div>
            : !query.data.data.length ? <EmptyState title="No trainers found" message="Try another search or specialisation." action={<Button size="sm" variant="outline" onClick={() => setParams({})}>Clear filters</Button>} />
              : (
                <>
                  <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-4 transition-opacity', query.isFetching && 'opacity-60')}>
                    {query.data.data.map((t) => <TrainerCard key={t._id} trainer={t} />)}
                  </div>
                  <Pagination meta={query.data.meta} onPage={(p) => update({ page: String(p) })} />
                </>
              )}
      </Section>
    </>
  );
}
