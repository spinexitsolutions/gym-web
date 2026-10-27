import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Repeat, Users, Pencil, XCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, Toolbar, FilterSelect, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal, ConfirmDialog } from '../../components/dashboard/Modal.jsx';
import { FormFields } from '../../components/dashboard/FormBuilder.jsx';
import { docToForm, formToPayload } from '../../components/dashboard/formValues.js';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { FormAlert, Field, Textarea, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const TRAINERS = { endpoint: '/admin/trainers?limit=100&isActive=true', label: 'name' };
const baseFields = [
  { name: 'title', label: 'Class name', required: true },
  { name: 'trainer', label: 'Trainer', type: 'ref', source: TRAINERS, required: true },
  { name: 'program', label: 'Program (optional)', type: 'ref', source: { endpoint: '/admin/programs?limit=100', label: 'title' } },
  { name: 'location', label: 'Room / location' },
  { name: 'capacity', label: 'Capacity', type: 'number', min: 1 },
  { name: 'waitlistLimit', label: 'Waitlist size', type: 'number', min: 0 },
  { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
  { name: 'eligiblePlans', label: 'Only for these plans (none = all members)', type: 'multiref', source: { endpoint: '/admin/plans?limit=100', label: 'name' }, wide: true },
];
const singleFields = [...baseFields.slice(0, 4), { name: 'startAt', label: 'Starts', type: 'datetime', required: true }, { name: 'endAt', label: 'Ends', type: 'datetime', required: true }, ...baseFields.slice(4)];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toDay = (d) => d.toLocaleDateString('en-CA');

function ClassForm({ cls, series, onClose, onSaved }) {
  const [error, setFormError] = useState('');
  const [days, setDays] = useState([1, 3, 5]);
  const fields = series ? baseFields : singleFields;
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { ...docToForm(fields, cls || {}, { capacity: 20, waitlistLimit: 10, eligiblePlans: [] }), startDate: toDay(new Date(Date.now() + 864e5)), weeks: 4, startTime: '07:00', durationMin: 60 },
  });
  const submit = async (v) => {
    setFormError('');
    const body = formToPayload(fields, v);
    try {
      const res = series
        ? await api.post('/classes/series', { ...body, startDate: v.startDate, weeks: Number(v.weeks), daysOfWeek: days, startTime: v.startTime, durationMin: Number(v.durationMin) })
        : cls ? await api.patch(`/classes/${cls._id}`, body) : await api.post('/classes', body);
      onSaved(res.message);
    } catch (err) { setFormError(applyServerErrors(err, setError) || 'Please fix the highlighted fields.'); }
  };
  return (
    <Modal open onClose={onClose} side size="lg" title={series ? 'Create weekly classes' : cls ? 'Edit class' : 'Schedule a class'}
      description={cls ? 'Members who booked are notified if the time changes.' : undefined}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(submit)}>Save</Button></>}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        <FormAlert>{error}</FormAlert>
        <FormFields fields={fields} control={control} register={register} errors={errors} />
        {series && (
          <fieldset className="grid gap-4 rounded-brand border border-line/10 p-4 sm:grid-cols-2">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Repeat</legend>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs text-muted">Days of the week</p>
              <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => (
                <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}
                  className={cn('h-10 w-12 rounded-brand border text-xs', days.includes(i) ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted')}>{d}</button>
              ))}</div>
            </div>
            <Field label="First week starting">{(a) => <input {...a} type="date" className="input" {...register('startDate')} />}</Field>
            <Field label="Number of weeks">{(a) => <input {...a} type="number" min="1" max="26" className="input" {...register('weeks')} />}</Field>
            <Field label="Start time (gym time)">{(a) => <input {...a} type="time" className="input" {...register('startTime')} />}</Field>
            <Field label="Duration (minutes)">{(a) => <input {...a} type="number" min="15" max="240" className="input" {...register('durationMin')} />}</Field>
            <p className="text-xs text-muted sm:col-span-2">Dates where the trainer already has a class or PT session are skipped automatically.</p>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}

function Roster({ cls, onClose }) {
  const q = useQuery({ queryKey: ['roster', cls._id], queryFn: async () => (await api.get(`/classes/${cls._id}/roster`)).data });
  return (
    <Modal open onClose={onClose} title={`${cls.title} — roster`} description={formatDate(cls.startAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}>
      {q.isLoading ? <Skeleton className="h-32" /> : q.data?.bookings.length ? (
        <ul className="divide-y divide-line/5">
          {q.data.bookings.map((b, i) => (
            <li key={b._id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span><span className="mr-3 text-muted">{i + 1}.</span>{b.member?.name}<span className="block pl-6 text-xs text-muted">{b.member?.phone || b.member?.email}</span></span>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No bookings yet" />}
    </Modal>
  );
}

export default function ClassesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [trainer, setTrainer] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'new'|'series'|'edit'|'roster'|'cancel', cls? }
  const [reason, setReason] = useState('');
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); return toDay(d); }, [weekOffset]);
  const to = useMemo(() => { const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + 6); return toDay(d); }, [from]);
  const q = useQuery({ queryKey: ['/classes', 'admin', from, trainer], queryFn: async () => (await api.get(`/classes?from=${from}&to=${to}&includeCancelled=true${trainer ? `&trainer=${trainer}` : ''}`)).data });
  const trainers = useQuery({ queryKey: ['options', 'trainers-active'], queryFn: async () => (await api.get('/admin/trainers?limit=100&isActive=true')).data });
  const byDay = useMemo(() => {
    const map = {};
    (q.data || []).forEach((c) => { const k = toDay(new Date(c.startAt)); (map[k] ||= []).push(c); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);
  const refresh = (msg) => { toast.success(msg); setModal(null); setReason(''); qc.invalidateQueries({ queryKey: ['/classes'] }); };

  return (
    <>
      <Seo title="Classes" noindex />
      <PageHeader title="Group classes" description="Schedule classes, manage capacity and waitlists, and see who is booked."
        actions={<><Button size="sm" variant="outline" onClick={() => setModal({ kind: 'series' })}><Repeat className="h-4 w-4" aria-hidden />Weekly series</Button><Button size="sm" onClick={() => setModal({ kind: 'new' })}><Plus className="h-4 w-4" aria-hidden />Single class</Button></>} />
      <Toolbar>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="subtle" onClick={() => setWeekOffset((w) => w - 1)}>← Previous</Button>
          <span className="min-w-[11rem] text-center text-sm">{formatDate(`${from}T12:00:00`, { day: 'numeric', month: 'short' })} – {formatDate(`${to}T12:00:00`, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <Button size="sm" variant="subtle" onClick={() => setWeekOffset((w) => w + 1)}>Next →</Button>
          {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>}
        </div>
        <FilterSelect label="Trainer" value={trainer} onChange={setTrainer} options={[{ value: '', label: 'All trainers' }, ...(trainers.data || []).map((t) => ({ value: t._id, label: t.name }))]} />
      </Toolbar>
      {q.isError ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : q.isLoading ? <Skeleton className="h-64" /> : !byDay.length ? (
        <EmptyState title="No classes this week" message="Create a single class or a weekly series." />
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-muted">{formatDate(`${day}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((c) => (
                  <li key={c._id} className={cn('rounded-brand border bg-surface p-4', c.status === 'cancelled' ? 'border-line/10 opacity-60' : 'border-line/10')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.title}</p>
                        <p className="text-sm text-muted">{formatDate(c.startAt, { hour: 'numeric', minute: '2-digit' })} – {formatDate(c.endAt, { hour: 'numeric', minute: '2-digit' })} · {c.trainer?.name}</p>
                        {c.location && <p className="text-xs text-muted">{c.location}</p>}
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full bg-gold" style={{ width: `${Math.min(100, (c.bookedCount / c.capacity) * 100)}%` }} /></div>
                        <p className="mt-1 text-xs text-muted">{c.bookedCount}/{c.capacity} booked</p>
                      </div>
                      <div className="flex">
                        <button type="button" className="rounded-full p-2 text-muted hover:text-gold" aria-label="View roster" onClick={() => setModal({ kind: 'roster', cls: c })}><Users className="h-4 w-4" /></button>
                        {c.status === 'scheduled' && <>
                          <button type="button" className="rounded-full p-2 text-muted hover:text-gold" aria-label="Edit class" onClick={() => setModal({ kind: 'edit', cls: c })}><Pencil className="h-4 w-4" /></button>
                          <button type="button" className="rounded-full p-2 text-muted hover:text-danger" aria-label="Cancel class" onClick={() => setModal({ kind: 'cancel', cls: c })}><XCircle className="h-4 w-4" /></button>
                        </>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {['new', 'series', 'edit'].includes(modal?.kind) && <ClassForm cls={modal.cls} series={modal.kind === 'series'} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === 'roster' && <Roster cls={modal.cls} onClose={() => setModal(null)} />}
      <ConfirmDialog open={modal?.kind === 'cancel'} onClose={() => setModal(null)} title="Cancel this class?" confirmLabel="Cancel class"
        message="All booked and waitlisted members are notified by email and in-app."
        onConfirm={async () => { try { refresh((await api.post(`/classes/${modal.cls._id}/cancel`, { reason: reason || undefined })).message); } catch (err) { toast.error(err); } }}>
        <Field label="Message to members (optional)" className="mt-4">{(a) => <Textarea {...a} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  );
}
