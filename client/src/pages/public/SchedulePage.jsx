import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Users, MapPin } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const day = (d) => d.toLocaleDateString('en-CA');

export default function SchedulePage() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [trainer, setTrainer] = useState('');
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + offset * 7); return day(d); }, [offset]);
  const to = useMemo(() => { const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + 6); return day(d); }, [from]);
  const q = useQuery({ queryKey: ['classes', 'public', from], queryFn: async () => (await api.get(`/classes?from=${from}&to=${to}`)).data });
  const trainers = useMemo(() => [...new Map((q.data || []).map((c) => [c.trainer?._id, c.trainer])).values()].filter(Boolean), [q.data]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + i); return day(d); }), [from]);
  const list = (q.data || []).filter((c) => !trainer || c.trainer?._id === trainer);
  return (
    <>
      <Seo title="Class schedule" description="Weekly group class timetable — HIIT, strength, yoga, cycling and more." path="/schedule" />
      <PageHero eyebrow="Schedule" title="This week at the club" lead="Book any class from your member dashboard. Full classes have a waitlist — we’ll notify you if a spot opens." />
      <Section className="pt-12 md:pt-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="subtle" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)}>← Previous</Button>
            <span className="min-w-[10rem] text-center text-sm">{formatDate(`${from}T12:00:00`, { day: 'numeric', month: 'short' })} – {formatDate(`${to}T12:00:00`, { day: 'numeric', month: 'short' })}</span>
            <Button size="sm" variant="subtle" disabled={offset >= 3} onClick={() => setOffset((o) => o + 1)}>Next →</Button>
          </div>
          {trainers.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-muted">Trainer
              <select className="input h-10 w-auto py-2" value={trainer} onChange={(e) => setTrainer(e.target.value)}><option value="">All</option>{trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
            </label>
          )}
        </div>
        {q.isError ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : q.isLoading ? <Skeleton className="h-80" /> : !list.length ? (
          <EmptyState title="No classes scheduled this week" message="Check the following week or contact us about personal training." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            {days.map((d) => {
              const items = list.filter((c) => day(new Date(c.startAt)) === d);
              return (
                <section key={d} aria-label={formatDate(`${d}T12:00:00`, { weekday: 'long' })} className="rounded-brand border border-line/10 bg-surface p-3">
                  <h2 className="mb-3 border-b border-line/10 pb-2 text-center font-sans text-xs font-semibold uppercase tracking-wider text-muted">{formatDate(`${d}T12:00:00`, { weekday: 'short', day: 'numeric' })}</h2>
                  {items.length ? (
                    <ul className="space-y-2">
                      {items.map((c) => (
                        <li key={c._id} className={cn('rounded-brand border p-3 text-sm', c.spotsLeft ? 'border-gold/30 bg-gold/5' : 'border-line/10')}>
                          <p className="font-semibold leading-tight">{c.title}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Clock className="h-3 w-3" aria-hidden />{formatDate(c.startAt, { hour: 'numeric', minute: '2-digit' })}</p>
                          <p className="text-xs text-muted">{c.trainer?.name}</p>
                          {c.location && <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" aria-hidden />{c.location}</p>}
                          <p className="mt-1 flex items-center gap-1 text-xs"><Users className="h-3 w-3" aria-hidden />{c.spotsLeft ? `${c.spotsLeft} spots` : 'Waitlist'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="py-4 text-center text-xs text-muted">—</p>}
                </section>
              );
            })}
          </div>
        )}
        <div className="mt-10 text-center">
          <Button to={user ? '/dashboard/book?tab=classes' : '/login?next=%2Fdashboard%2Fbook%3Ftab%3Dclasses'}>{user ? 'Book a class' : 'Log in to book'}</Button>
        </div>
      </Section>
    </>
  );
}
