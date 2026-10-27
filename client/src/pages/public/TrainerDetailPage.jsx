import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, GraduationCap, Languages, Star, CalendarClock } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { formatPaise, to12h } from '../../utils/format.js';
import NotFoundPage from './NotFoundPage.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TrainerDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['trainer', slug], queryFn: () => contentApi.trainer(slug), retry: (n, e) => e.status !== 404 && n < 2 });
  if (q.isLoading) return <PageLoader />;
  if (q.error?.status === 404) return <NotFoundPage />;
  if (q.isError) return <div className="container py-24"><ErrorState message="Could not load this trainer." onRetry={q.refetch} /></div>;
  const t = q.data;
  const byDay = DAYS.map((d, i) => ({ day: d, slots: t.availability.filter((a) => a.dayOfWeek === i) })).filter((d) => d.slots.length);
  // Online slot booking is part of the member dashboard (Phase 5). Until then requests go to the front desk.
  const bookHref = `/contact?interest=personal_training&trainer=${encodeURIComponent(t.name)}`;

  return (
    <>
      <Seo title={`${t.name} — ${t.title}`} description={t.bio?.slice(0, 160)} image={t.photo?.url} path={`/trainers/${t.slug}`} />
      <Section className="pt-12 md:pt-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-muted"><Link to="/trainers" className="hover:text-gold">Trainers</Link> / {t.name}</nav>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-brand">
            <Img image={t.photo} alt={t.name} priority sizes="(min-width: 1024px) 40vw, 100vw" className="h-full w-full" />
          </div>
          <div>
            <p className="eyebrow">{t.title}</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-6xl">{t.name}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted">
              <span>{t.experienceYears} years experience</span>
              {t.rating?.count > 0 && <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-gold text-gold" aria-hidden />{t.rating.average.toFixed(1)} ({t.rating.count})</span>}
              {t.ptPricePaise > 0 && <span>From {formatPaise(t.ptPricePaise)} / session</span>}
            </div>
            <p className="mt-8 text-pretty text-lg leading-relaxed text-muted">{t.bio}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {t.specializations.map((s) => <span key={s} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">{s}</span>)}
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {t.qualifications?.length > 0 && (
                <div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><GraduationCap className="h-4 w-4 text-gold" aria-hidden />Qualifications</p>
                  <ul className="space-y-1.5 text-sm">{t.qualifications.map((x) => <li key={x}>{x}</li>)}</ul></div>
              )}
              {t.certifications?.length > 0 && (
                <div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Award className="h-4 w-4 text-gold" aria-hidden />Certifications</p>
                  <ul className="space-y-1.5 text-sm">{t.certifications.map((c) => <li key={c.name}>{c.name}<span className="text-muted"> · {c.issuer}{c.year ? `, ${c.year}` : ''}</span></li>)}</ul></div>
              )}
              {t.languages?.length > 0 && (
                <div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Languages className="h-4 w-4 text-gold" aria-hidden />Languages</p>
                  <p className="text-sm">{t.languages.join(', ')}</p></div>
              )}
            </div>

            <div className="glass mt-10 rounded-brand p-6">
              <p className="mb-4 flex items-center gap-2 font-semibold"><CalendarClock className="h-5 w-5 text-gold" aria-hidden />Available time slots</p>
              {byDay.length ? (
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {byDay.map(({ day, slots }) => (
                    <li key={day} className="flex justify-between gap-4 border-b border-line/10 pb-2"><span className="text-muted">{day}</span><span>{slots.map((s) => `${to12h(s.start)}–${to12h(s.end)}`).join(', ')}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Availability is being updated. Contact the front desk to book.</p>}
              <Button to={bookHref} className="mt-6 w-full sm:w-auto">Request a personal training session</Button>
              <p className="mt-3 text-xs text-muted">Tell us your preferred slot and the front desk will confirm it{user ? '' : ' — no account needed'}.</p>
            </div>

            {t.programs?.length > 0 && (
              <div className="mt-10">
                <p className="eyebrow mb-4">Programs</p>
                <ul className="flex flex-wrap gap-2">{t.programs.map((p) => <li key={p._id}><Link to={`/programs/${p.slug}`} className="rounded-full border border-line/15 px-4 py-2 text-sm hover:border-gold hover:text-gold">{p.title}</Link></li>)}</ul>
              </div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
