import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, MapPin } from 'lucide-react';
import { api } from '../../services/api.js';
import { contentApi } from '../../services/content.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, Card, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal, ConfirmDialog } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const nextDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toLocaleDateString('en-CA'); });

function SlotPicker({ trainerId, onPick, selected, excludeLabel }) {
  const days = useMemo(() => nextDays(14), []);
  const [day, setDay] = useState(days[0]);
  const q = useQuery({ queryKey: ['slots', trainerId, day], queryFn: async () => (await api.get(`/bookings/trainers/${trainerId}/slots?date=${day}`)).data, enabled: Boolean(trainerId) });
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose a day">
        {days.map((d) => (
          <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)} className={cn('flex min-w-[64px] flex-col items-center rounded-brand border px-3 py-2 text-xs', d === day ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>
            <span>{formatDate(`${d}T12:00:00`, { weekday: 'short' })}</span><span className="text-base font-semibold">{d.slice(8)}</span>
          </button>
        ))}
      </div>
      {q.isLoading ? <Skeleton className="h-24" /> : q.isError ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : !q.data.slots.length ? (
        <p className="text-sm text-muted">No availability on this day. Try another date.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Available times">
          {q.data.slots.map((s) => {
            const value = new Date(s.startAt).toISOString();
            return (
              <button key={value} type="button" disabled={!s.available} aria-pressed={selected === value} onClick={() => onPick(value)}
                className={cn('rounded-brand border px-2 py-2.5 text-sm transition', selected === value ? 'border-gold bg-gold text-[#0B0B0C]' : s.available ? 'border-line/15 hover:border-gold' : 'cursor-not-allowed border-line/5 text-muted/40 line-through')}>
                {formatDate(s.startAt, { hour: 'numeric', minute: '2-digit' })}
              </button>
            );
          })}
        </div>
      )}
      {excludeLabel}
    </div>
  );
}

function PersonalTraining() {
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const trainers = useQuery({ queryKey: ['trainers', 'all'], queryFn: async () => (await contentApi.trainers({ limit: 50 })).data });
  const [trainerId, setTrainerId] = useState(null);
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const preferred = params.get('trainer');
  const active = trainerId || trainers.data?.find((t) => t.slug === preferred)?._id;
  const trainer = trainers.data?.find((t) => t._id === active);
  const book = async () => {
    setBusy(true);
    try {
      toast.success((await api.post('/bookings/pt', { trainerId: active, startAt: slot, notes: notes || undefined })).message);
      setSlot(null); setNotes('');
      qc.invalidateQueries({ queryKey: ['bookings', 'me'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  if (trainers.isLoading) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label="Choose a trainer">
        {trainers.data?.map((t) => (
          <button key={t._id} type="button" role="radio" aria-checked={active === t._id} onClick={() => { setTrainerId(t._id); setSlot(null); }}
            className={cn('overflow-hidden rounded-brand border text-left transition', active === t._id ? 'border-gold ring-1 ring-gold' : 'border-line/10 hover:border-gold/40')}>
            <Img image={t.photo} alt="" sizes="160px" className="aspect-square w-full" />
            <div className="p-2"><p className="truncate text-sm font-medium">{t.name}</p><p className="truncate text-xs text-muted">{t.specializations?.[0]}</p></div>
          </button>
        ))}
      </div>
      {trainer ? (
        <Card title={`Book with ${trainer.name} · ${trainer.sessionDurationMin} min`}>
          <SlotPicker trainerId={trainer._id} selected={slot} onPick={setSlot} />
          {slot && (
            <div className="mt-6 space-y-3 border-t border-line/10 pt-5">
              <label htmlFor="pt-notes" className="text-xs font-semibold uppercase tracking-wider text-muted">Anything your coach should know? (optional)</label>
              <textarea id="pt-notes" className="input min-h-[80px]" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals for this session, recent injuries…" />
              <Button onClick={book} loading={busy}>Confirm {formatDate(slot, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Button>
              <p className="text-xs text-muted">Uses one of your plan’s monthly PT sessions. Cancel or reschedule up to 1 hour before.</p>
            </div>
          )}
        </Card>
      ) : <EmptyState title="Choose a trainer" message="Select a coach above to see their free slots for the next two weeks." />}
    </div>
  );
}

function Classes() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['classes', 'upcoming'], queryFn: async () => (await api.get('/classes')).data });
  const book = async (c) => {
    try { toast.success((await api.post(`/classes/${c._id}/book`)).message); qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['bookings', 'me'] }); } catch (err) { toast.error(err); }
  };
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  if (!q.data.length) return <EmptyState title="No classes scheduled" message="New classes are added every week — check back soon." />;
  const byDay = q.data.reduce((acc, c) => { const k = new Date(c.startAt).toLocaleDateString('en-CA'); (acc[k] ||= []).push(c); return acc; }, {});
  return (
    <div className="space-y-6">
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-muted">{formatDate(`${day}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-4 rounded-brand border border-line/10 bg-surface p-4">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{formatDate(c.startAt, { hour: 'numeric', minute: '2-digit' })}–{formatDate(c.endAt, { hour: 'numeric', minute: '2-digit' })}</span>
                    <span>{c.trainer?.name}</span>
                    {c.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{c.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{c.spotsLeft ? `${c.spotsLeft} spots left` : 'Full'}</span>
                  </p>
                </div>
                {c.myBooking ? <StatusBadge status={c.myBooking.status} /> : <Button size="sm" variant={c.spotsLeft ? 'primary' : 'outline'} onClick={() => book(c)}>{c.spotsLeft ? 'Book' : 'Join waitlist'}</Button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MyBookings() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bookings', 'me'], queryFn: async () => (await api.get('/bookings/me')).data });
  const [cancelling, setCancelling] = useState(null);
  const [moving, setMoving] = useState(null);
  const [slot, setSlot] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['slots'] }); };
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const row = (b, upcoming) => (
    <li key={b._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
      <div>
        <p className="font-medium">{b.type === 'class' ? b.classSchedule?.title : `Personal training · ${b.trainer?.name}`}</p>
        <p className="text-xs text-muted">{formatDate(b.startAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{b.status === 'waitlisted' ? ` · waitlist #${b.waitlistPosition}` : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={b.status} />
        {upcoming && b.type === 'personal_training' && b.status === 'booked' && <Button size="sm" variant="ghost" onClick={() => { setMoving(b); setSlot(null); }}>Reschedule</Button>}
        {upcoming && <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>Cancel</Button>}
      </div>
    </li>
  );
  return (
    <div className="space-y-6">
      <Card title="Upcoming" padded={false}>{q.data.upcoming.length ? <ul className="divide-y divide-line/5">{q.data.upcoming.map((b) => row(b, true))}</ul> : <p className="p-5 text-sm text-muted">Nothing booked.</p>}</Card>
      <Card title="Past & cancelled" padded={false}>{q.data.past.length ? <ul className="divide-y divide-line/5">{q.data.past.slice(0, 30).map((b) => row(b, false))}</ul> : <p className="p-5 text-sm text-muted">No history yet.</p>}</Card>
      <ConfirmDialog open={Boolean(cancelling)} onClose={() => setCancelling(null)} title="Cancel this booking?" confirmLabel="Cancel booking"
        message={cancelling?.type === 'class' ? 'Your spot is released to the next member on the waitlist.' : 'The session is released and returned to your monthly allowance.'}
        onConfirm={async () => { try { toast.success((await api.post(`/bookings/${cancelling._id}/cancel`, {})).message); setCancelling(null); refresh(); } catch (err) { toast.error(err); } }} />
      <Modal open={Boolean(moving)} onClose={() => setMoving(null)} title="Reschedule session" description={moving && `Currently ${formatDate(moving.startAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
        footer={<><Button size="sm" variant="ghost" onClick={() => setMoving(null)}>Close</Button><Button size="sm" disabled={!slot} onClick={async () => { try { toast.success((await api.post(`/bookings/${moving._id}/reschedule`, { startAt: slot })).message); setMoving(null); refresh(); } catch (err) { toast.error(err); } }}>Move session</Button></>}>
        {moving && <SlotPicker trainerId={moving.trainer?._id} selected={slot} onPick={setSlot} />}
      </Modal>
    </div>
  );
}

const TABS = [{ key: 'pt', label: 'Personal training', C: PersonalTraining }, { key: 'classes', label: 'Group classes', C: Classes }, { key: 'mine', label: 'My bookings', C: MyBookings }];

export default function BookPage() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const tab = TABS.find((t) => t.key === params.get('tab')) || (pathname.endsWith('/bookings') ? TABS[2] : TABS[0]);
  return (
    <>
      <Seo title="Book" noindex />
      <PageHeader title="Book a session" description="Personal training slots in real time, group classes with waitlists, and your bookings." />
      <div role="tablist" aria-label="Booking" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} role="tab" type="button" aria-selected={tab.key === t.key} onClick={() => setParams({ tab: t.key }, { replace: true })}
            className={cn('rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider', tab.key === t.key ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel"><tab.C /></div>
    </>
  );
}
