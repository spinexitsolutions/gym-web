import { lazy, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Users, ScanLine, UserRound, Check, UserX, ClipboardPlus } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader, Card, StatusBadge, KeyValue } from '../components/dashboard/Widgets.jsx';
import { Modal } from '../components/dashboard/Modal.jsx';
import { FormFields } from '../components/dashboard/FormBuilder.jsx';
import { docToForm, formToPayload } from '../components/dashboard/formValues.js';
import { Button } from '../components/ui/Button.jsx';
import { Img } from '../components/ui/Img.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States.jsx';
import { FormAlert, applyServerErrors } from '../forms/Field.jsx';
import { Seo } from '../components/layout/Seo.jsx';
import { formatDate } from '../utils/format.js';
import NotFoundPage from '../pages/public/NotFoundPage.jsx';

const CheckIn = lazy(() => import('../admin/pages/CheckInPage.jsx'));

function Schedule() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['trainer', 'schedule'], queryFn: async () => (await api.get('/bookings/trainer/me')).data });
  const [roster, setRoster] = useState(null);
  const rosterQ = useQuery({ queryKey: ['roster', roster], queryFn: async () => (await api.get(`/classes/${roster}/roster`)).data, enabled: Boolean(roster) });
  const mark = async (b, status) => { try { toast.success((await api.patch(`/bookings/${b._id}/status`, { status })).message); qc.invalidateQueries({ queryKey: ['trainer', 'schedule'] }); } catch (err) { toast.error(err); } };
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState title="Schedule unavailable" message={q.error.message} onRetry={q.refetch} />;
  const items = [...q.data.bookings.map((b) => ({ ...b, kind: 'pt' })), ...q.data.classes.map((c) => ({ ...c, kind: 'class' }))].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const byDay = items.reduce((acc, x) => { const k = new Date(x.startAt).toLocaleDateString('en-CA'); (acc[k] ||= []).push(x); return acc; }, {});
  return (
    <>
      <Seo title="My schedule" noindex />
      <PageHeader title="My schedule" description="Personal training sessions and classes for the next 30 days." />
      {!items.length ? <EmptyState title="Nothing scheduled" message="Members can book you once your availability is set." /> : Object.entries(byDay).map(([day, list]) => (
        <section key={day} className="mb-6">
          <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-muted">{formatDate(`${day}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x._id} className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-line/10 bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="w-20 text-sm font-semibold text-gold">{formatDate(x.startAt, { hour: 'numeric', minute: '2-digit' })}</span>
                  <div>
                    <p className="font-medium">{x.kind === 'class' ? x.title : `PT · ${x.member?.name}`}</p>
                    <p className="text-xs text-muted">{x.kind === 'class' ? `${x.bookedCount}/${x.capacity} booked${x.location ? ` · ${x.location}` : ''}` : (x.notes || x.member?.phone || x.member?.email)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {x.kind === 'pt' && <StatusBadge status={x.status} />}
                  {x.kind === 'class' && <Button size="sm" variant="ghost" onClick={() => setRoster(x._id)}>Roster</Button>}
                  {x.kind === 'pt' && x.status === 'booked' && new Date(x.startAt) < new Date() && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => mark(x, 'completed')}><Check className="h-4 w-4" aria-hidden />Done</Button>
                      <Button size="sm" variant="ghost" onClick={() => mark(x, 'no_show')}><UserX className="h-4 w-4" aria-hidden />No-show</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Modal open={Boolean(roster)} onClose={() => setRoster(null)} title="Class roster">
        {rosterQ.isLoading ? <Skeleton className="h-32" /> : rosterQ.data?.bookings.length ? (
          <ul className="divide-y divide-line/5">{rosterQ.data.bookings.map((b) => <li key={b._id} className="flex justify-between py-2 text-sm"><span>{b.member?.name}</span><StatusBadge status={b.status} /></li>)}</ul>
        ) : <p className="text-sm text-muted">No bookings yet.</p>}
      </Modal>
    </>
  );
}

const exerciseFields = [
  { name: 'name', label: 'Exercise' }, { name: 'sets', label: 'Sets', type: 'number', min: 1 }, { name: 'reps', label: 'Reps', placeholder: '8-12' },
  { name: 'restSec', label: 'Rest (sec)', type: 'number', min: 0 }, { name: 'notes', label: 'Notes', wide: true },
];
const planFields = [
  { name: 'title', label: 'Plan title', required: true },
  { name: 'goal', label: 'Goal' },
  { name: 'startDate', label: 'Start', type: 'date' },
  { name: 'endDate', label: 'End', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'archived', label: 'Archived' }] },
  { name: 'days', label: 'Training days', type: 'repeater', itemLabel: 'Day', max: 14, newItem: () => ({ label: `Day`, exercises: [{ name: '', sets: 3, reps: '10' }] }),
    fields: [{ name: 'label', label: 'Day label', placeholder: 'Day 1 — Push', wide: true }, { name: 'exercises', label: 'Exercises', type: 'repeater', itemLabel: 'Exercise', max: 30, newItem: () => ({ name: '', sets: 3, reps: '10' }), fields: exerciseFields }] },
];

function PlanEditor({ member, plan, onClose, onSaved }) {
  const [error, setFormError] = useState('');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: docToForm(planFields, plan || {}, { status: 'active', days: [{ label: 'Day 1', exercises: [{ name: '', sets: 3, reps: '10' }] }] }),
  });
  const submit = async (v) => {
    try {
      const body = { ...formToPayload(planFields, v), member: member.user._id };
      onSaved((plan ? await api.patch(`/workouts/plans/${plan._id}`, body) : await api.post('/workouts/plans', body)).message);
    } catch (err) { setFormError(applyServerErrors(err, setError) || 'Please complete the highlighted fields.'); }
  };
  return (
    <Modal open onClose={onClose} side size="lg" title={`${plan ? 'Edit' : 'New'} plan for ${member.user.name}`}
      footer={<><Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(submit)}>Save plan</Button></>}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        <FormAlert>{error}</FormAlert>
        <FormFields fields={planFields} control={control} register={register} errors={errors} />
      </form>
    </Modal>
  );
}

function Members() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['trainer', 'members'], queryFn: async () => (await api.get('/trainers/me/members')).data });
  const plans = useQuery({ queryKey: ['trainer', 'plans'], queryFn: async () => (await api.get('/workouts/plans')).data });
  const [editing, setEditing] = useState(null);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState title="Members unavailable" message={q.error.message} onRetry={q.refetch} />;
  return (
    <>
      <Seo title="My members" noindex />
      <PageHeader title="My members" description="Members assigned to you by the front desk. Health notes are confidential." />
      {!q.data.length ? <EmptyState title="No assigned members yet" message="An admin assigns members to you from their profile." /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          {q.data.map((m) => {
            const memberPlans = (plans.data || []).filter((p) => p.member?._id === m.user._id);
            return (
              <Card key={m.user._id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-12 w-12 overflow-hidden rounded-full bg-elevated">{m.user.avatar?.url ? <Img image={m.user.avatar} alt="" sizes="48px" className="h-full w-full" /> : <span className="grid h-full place-items-center text-gold">{m.user.name[0]}</span>}</span>
                    <div><p className="font-semibold">{m.user.name}</p><p className="text-xs text-muted">{m.user.phone || m.user.email}</p></div>
                  </div>
                  {m.membership ? <Badge tone="success">{m.membership.plan?.name}</Badge> : <Badge tone="danger">No active plan</Badge>}
                </div>
                <div className="mt-4"><KeyValue items={[['Level', m.fitnessLevel], ['Height', m.heightCm ? `${m.heightCm} cm` : null], ['Latest weight', m.lastProgress?.weightKg ? `${m.lastProgress.weightKg} kg (${formatDate(m.lastProgress.date)})` : null]]} /></div>
                {m.fitnessGoals?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{m.fitnessGoals.map((g) => <Badge key={g} tone="gold" className="normal-case">{g}</Badge>)}</div>}
                {m.medicalNotes && <p className="mt-3 rounded-brand border border-danger/30 bg-danger/5 p-3 text-sm"><strong>Health notes:</strong> {m.medicalNotes}</p>}
                <div className="mt-4 border-t border-line/10 pt-4">
                  <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Workout plans</p><Button size="sm" variant="ghost" onClick={() => setEditing({ member: m })}><ClipboardPlus className="h-4 w-4" aria-hidden />New plan</Button></div>
                  {memberPlans.length ? <ul className="space-y-1 text-sm">{memberPlans.map((p) => <li key={p._id} className="flex items-center justify-between"><button type="button" className="hover:text-gold" onClick={() => setEditing({ member: m, plan: p })}>{p.title}</button><StatusBadge status={p.status} /></li>)}</ul> : <p className="text-sm text-muted">No plans yet.</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <PlanEditor member={editing.member} plan={editing.plan} onClose={() => setEditing(null)} onSaved={(msg) => { toast.success(msg); setEditing(null); qc.invalidateQueries({ queryKey: ['trainer', 'plans'] }); }} />}
    </>
  );
}

const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ value: i, label: d }));
const profileFields = [
  { name: 'bio', label: 'Bio', type: 'textarea', rows: 4 },
  { name: 'specializations', label: 'Specialisations', type: 'tags' },
  { name: 'languages', label: 'Languages', type: 'tags' },
  { name: 'sessionDurationMin', label: 'Session length (minutes)', type: 'number', min: 15, max: 180 },
  { name: 'availability', label: 'Weekly availability', type: 'repeater', itemLabel: 'Slot', newItem: () => ({ dayOfWeek: 1, start: '06:00', end: '10:00' }),
    hint: 'Members can book personal training inside these windows.',
    fields: [{ name: 'dayOfWeek', label: 'Day', type: 'select', options: DAY_OPTIONS }, { name: 'start', label: 'From', type: 'time' }, { name: 'end', label: 'To', type: 'time' }] },
];

function Profile() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['trainer', 'me'], queryFn: async () => (await api.get('/trainers/me')).data });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState title="Profile unavailable" message={q.error.message} onRetry={q.refetch} />;
  return <ProfileForm trainer={q.data} onSaved={(msg) => { toast.success(msg); qc.invalidateQueries({ queryKey: ['trainer', 'me'] }); }} />;
}

function ProfileForm({ trainer, onSaved }) {
  const [error, setFormError] = useState('');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: docToForm(profileFields, trainer) });
  const submit = async (v) => {
    try { onSaved((await api.patch('/trainers/me', formToPayload(profileFields, v))).message); } catch (err) { setFormError(applyServerErrors(err, setError)); }
  };
  return (
    <>
      <Seo title="My profile" noindex />
      <PageHeader title="Profile & availability" description={`Public profile: /trainers/${trainer.slug}. Photo, title and pricing are managed by an admin.`} />
      <Card>
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
          <FormAlert>{error}</FormAlert>
          <FormFields fields={profileFields} control={control} register={register} errors={errors} />
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save</Button>
        </form>
      </Card>
    </>
  );
}

const NAV = [{ items: [
  { to: '/trainer', label: 'Schedule', icon: CalendarDays, end: true },
  { to: '/trainer/members', label: 'My members', icon: Users },
  { to: '/trainer/check-in', label: 'Check-in', icon: ScanLine },
  { to: '/trainer/profile', label: 'Profile & availability', icon: UserRound },
] }];

export default function TrainerApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout nav={NAV} title="Trainer" />}>
        <Route index element={<Schedule />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="members" element={<Members />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
