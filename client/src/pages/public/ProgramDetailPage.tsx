import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Gauge, Repeat } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import type { Program } from '@/types/api';
import { Seo } from '@/components/layout/Seo';
import { PageHero } from '@/components/layout/PageHero';
import { Reveal } from '@/components/layout/Reveal';
import { Skeleton } from '@/components/ui';
import { ScheduleList } from '@/features/sections/cards';
import { Img, Paragraphs, QuietError } from '@/features/sections/primitives';
import { useClasses } from '@/features/sections/queries';
import { BackLink, CmsBottomCta, DetailMessage } from './shared';

export default function ProgramDetailPage() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['public', 'program', slug], queryFn: () => api.get<Program>(`/cms/public/programs/${encodeURIComponent(slug)}`) });
  const classes = useClasses(14, 200);

  if (q.isLoading)
    return (
      <div className="container space-y-6 pb-24 pt-[calc(var(--chrome-h,6rem)+5rem)]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full max-w-3xl" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
    );
  if (q.isError)
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <DetailMessage title="Program not found" body="This program may have been retired or renamed." back={{ to: '/programs', label: 'All programs' }} />
    ) : (
      <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+5rem)]">
        <QuietError what="Program details" onRetry={() => q.refetch()} />
      </div>
    );

  const p = q.data!;
  const upcoming = (classes.data ?? []).filter((c) => c.program?.slug === p.slug && c.status === 'scheduled');
  const facts = [
    { icon: Gauge, label: 'Level', value: p.level === 'all' ? 'All levels' : titleCase(p.level) },
    p.durationWeeks && { icon: CalendarDays, label: 'Duration', value: `${p.durationWeeks} weeks` },
    p.sessionsPerWeek && { icon: Repeat, label: 'Frequency', value: `${p.sessionsPerWeek} sessions / week` },
  ].filter(Boolean) as { icon: typeof Gauge; label: string; value: string }[];

  return (
    <>
      <Seo title={p.title} description={p.summary} image={p.imageUrl} />
      <PageHero back={<BackLink to="/programs">All programs</BackLink>} eyebrow={p.level === 'all' ? 'All levels' : titleCase(p.level)} title={p.title} description={p.summary} />
      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            {p.imageUrl && (
              <Reveal className="mb-10 aspect-[16/10] overflow-hidden rounded-theme border border-fg/[0.08]">
                <Img src={p.imageUrl} alt={p.title} />
              </Reveal>
            )}
            {p.description && (
              <Reveal>
                <h2 className="font-display text-2xl font-semibold tracking-tight">About this program</h2>
                <Paragraphs text={p.description} className="mt-5 text-lg leading-relaxed text-fg/75" />
              </Reveal>
            )}
            {p.tags.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
                {p.tags.map((t) => (
                  <li key={t} className="rounded-full border border-fg/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="lg:col-span-5">
            <Reveal className="card p-7 lg:sticky lg:top-28">
              <dl className="divide-y divide-fg/[0.07]">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                    <dt className="flex items-center gap-3 text-sm text-muted">
                      <f.icon className="h-4 w-4" aria-hidden /> {f.label}
                    </dt>
                    <dd className="font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 grid gap-3">
                <Link to="/#trial" className="btn btn-primary w-full">
                  Try it free
                </Link>
                <Link to="/memberships" className="btn btn-secondary w-full">
                  See memberships
                </Link>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>
      {upcoming.length > 0 && (
        <section className="section border-t border-fg/[0.06] pt-16" aria-labelledby="upcoming-h">
          <div className="container">
            <h2 id="upcoming-h" className="mb-10 font-display text-display-md font-semibold">
              Upcoming sessions
            </h2>
            <ScheduleList classes={upcoming.slice(0, 12)} dense />
          </div>
        </section>
      )}
      <CmsBottomCta />
    </>
  );
}
