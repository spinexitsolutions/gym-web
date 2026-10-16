import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, Instagram } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { initials } from '@/lib/format';
import type { TrainerPublic } from '@/types/api';
import { Seo } from '@/components/layout/Seo';
import { Reveal } from '@/components/layout/Reveal';
import { Skeleton } from '@/components/ui';
import { ScheduleList } from '@/features/sections/cards';
import { Img, MonogramArt, Paragraphs, QuietError } from '@/features/sections/primitives';
import { useClasses } from '@/features/sections/queries';
import { BackLink, CmsBottomCta, DetailMessage } from './shared';

export default function TrainerDetailPage() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['public', 'trainer', slug], queryFn: () => api.get<TrainerPublic>(`/trainers/profile/${encodeURIComponent(slug)}`) });
  const classes = useClasses(14, 50, q.data?.id);

  if (q.isLoading)
    return (
      <div className="container grid gap-10 pb-24 pt-[calc(var(--chrome-h,6rem)+4rem)] lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] w-full rounded-theme" />
        <div className="space-y-5">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  if (q.isError)
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <DetailMessage title="Coach not found" body="This profile isn’t available right now." back={{ to: '/trainers', label: 'Meet the team' }} />
    ) : (
      <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+5rem)]">
        <QuietError what="Coach details" onRetry={() => q.refetch()} />
      </div>
    );

  const t = q.data!;
  const book = `/member/personal-training?trainer=${encodeURIComponent(t.id)}`;
  const upcoming = (classes.data ?? []).filter((c) => c.status === 'scheduled');
  return (
    <>
      <Seo title={`${t.displayName}${t.title ? ` — ${t.title}` : ''}`} description={t.bio?.slice(0, 160)} image={t.photoUrl} />
      <section className="relative isolate overflow-hidden pb-16 pt-[calc(var(--chrome-h,6rem)+3rem)] md:pb-24">
        <div aria-hidden className="bg-aura pointer-events-none absolute inset-0 -z-10" />
        <div className="container">
          <BackLink to="/trainers">All coaches</BackLink>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="relative aspect-[4/5] overflow-hidden rounded-theme border border-fg/[0.08] lg:col-span-5">
              {t.photoUrl ? <Img src={t.photoUrl} alt={`Portrait of ${t.displayName}`} /> : <MonogramArt text={initials(t.displayName)} label={t.title} />}
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-7 lg:pt-6">
              {t.title && <p className="eyebrow mb-5">{t.title}</p>}
              <h1 className="text-balance font-display text-display-xl font-semibold">{t.displayName}</h1>
              <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-fg/[0.08] py-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted">Experience</dt>
                  <dd className="mt-1 font-display text-3xl font-semibold">{t.experienceYears}+ yrs</dd>
                </div>
                {t.ptSessionMinutes ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted">PT session</dt>
                    <dd className="mt-1 font-display text-3xl font-semibold">{t.ptSessionMinutes} min</dd>
                  </div>
                ) : null}
                {t.specializations.length > 0 && (
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted">Focus</dt>
                    <dd className="mt-1 text-fg/85">{t.specializations.join(', ')}</dd>
                  </div>
                )}
              </dl>
              {t.bio && <Paragraphs text={t.bio} className="mt-8 text-lg leading-relaxed text-fg/75" />}
              {t.certifications.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Certifications</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {t.certifications.map((c) => (
                      <li key={c} className="inline-flex items-center gap-2 rounded-full border border-fg/10 px-3 py-1.5 text-sm">
                        <Award className="h-3.5 w-3.5 text-primary" aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to={book} className="btn btn-primary btn-lg group">
                  Book personal training <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                {t.instagram && /^https?:\/\//.test(t.instagram) && (
                  <a href={t.instagram} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-lg">
                    <Instagram className="h-4 w-4" aria-hidden /> Instagram<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
              <p className="mt-3 text-xs text-muted">Members book sessions from their dashboard — you’ll be asked to log in or join first.</p>
            </Reveal>
          </div>
        </div>
      </section>
      {upcoming.length > 0 && (
        <section className="section border-t border-fg/[0.06] pt-16" aria-labelledby="t-classes">
          <div className="container">
            <h2 id="t-classes" className="mb-10 font-display text-display-md font-semibold">
              Classes with {t.displayName.split(' ')[0]}
            </h2>
            <ScheduleList classes={upcoming.slice(0, 10)} dense />
          </div>
        </section>
      )}
      <CmsBottomCta />
    </>
  );
}
