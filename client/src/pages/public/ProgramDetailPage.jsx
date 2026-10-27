import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock, CalendarDays, Gauge, Repeat } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { CATEGORY_LABELS } from '../../utils/format.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function ProgramDetailPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['program', slug], queryFn: () => contentApi.program(slug), retry: (n, e) => e.status !== 404 && n < 2 });
  if (q.isLoading) return <PageLoader />;
  if (q.error?.status === 404) return <NotFoundPage />;
  if (q.isError) return <div className="container py-24"><ErrorState message="Could not load this program." onRetry={q.refetch} /></div>;
  const p = q.data;
  const facts = [
    { icon: Gauge, label: 'Difficulty', value: p.difficulty },
    { icon: CalendarDays, label: 'Duration', value: `${p.durationWeeks} weeks` },
    { icon: Repeat, label: 'Frequency', value: `${p.sessionsPerWeek} sessions / week` },
    { icon: Clock, label: 'Session length', value: `${p.sessionLengthMin} min` },
  ];
  return (
    <>
      <Seo title={p.title} description={p.summary} image={p.image?.url} path={`/programs/${p.slug}`} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10"><Img image={p.image} priority decorative className="h-full w-full" /><div className="absolute inset-0 bg-[#0B0B0C]/75" /><div className="absolute inset-0 bg-gradient-to-t from-bg" /></div>
        <div className="container py-24 text-[#F4F1EA] md:py-32">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[#F4F1EA]/60"><Link to="/programs" className="hover:text-gold">Programs</Link> / {CATEGORY_LABELS[p.category]}</nav>
          <Badge tone="gold">{CATEGORY_LABELS[p.category]}</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold md:text-6xl">{p.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-[#F4F1EA]/75">{p.summary}</p>
        </div>
      </section>
      <Section className="pt-12 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-brand border border-line/10 bg-surface p-5">
                  <Icon className="h-5 w-5 text-gold" aria-hidden />
                  <dt className="mt-3 text-xs uppercase tracking-wider text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold capitalize">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 space-y-5 text-pretty text-lg leading-relaxed text-muted">
              {(p.description || '').split(/\n{2,}/).map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
            </div>
            {p.highlights?.length > 0 && (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {p.highlights.map((h) => <li key={h} className="flex gap-3"><Check className="mt-1 h-4 w-4 text-gold" aria-hidden />{h}</li>)}
              </ul>
            )}
          </div>
          <aside className="space-y-6">
            <div className="glass rounded-brand p-6">
              <p className="eyebrow">Included in</p>
              {p.eligiblePlans?.length ? (
                <ul className="mt-4 flex flex-wrap gap-2">{p.eligiblePlans.map((pl) => <li key={pl._id}><Badge tone="gold">{pl.name}</Badge></li>)}</ul>
              ) : <p className="mt-3 text-sm text-muted">Available as an add-on. Ask the front desk.</p>}
              <Button to="/memberships" className="mt-6 w-full">View memberships</Button>
            </div>
            {p.trainers?.length > 0 && (
              <div className="rounded-brand border border-line/10 bg-surface p-6">
                <p className="eyebrow mb-4">Your coaches</p>
                <ul className="space-y-4">
                  {p.trainers.map((t) => (
                    <li key={t._id}>
                      <Link to={`/trainers/${t.slug}`} className="group flex items-center gap-4">
                        <Img image={t.photo} alt={t.name} sizes="56px" className="h-14 w-14 rounded-full" />
                        <div><p className="font-semibold group-hover:text-gold">{t.name}</p><p className="text-xs text-muted">{t.title}</p></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </Section>
    </>
  );
}
