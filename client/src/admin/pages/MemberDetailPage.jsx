import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, CreditCard, Crown, Ban, CheckCircle2, LogIn, Trash2, Download } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, KeyValue, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal, ConfirmDialog } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { Field, Select, Textarea, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, formatPaise, PERIODS } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';
import { usePlans } from '../../components/sections/Pricing.jsx';

function PlanPaymentModal({ member, mode, onClose, onDone }) {
  const { data: plans } = usePlans();
  const [error, setFormError] = useState('');
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { period: 'monthly', method: 'cash' } });
  const plan = plans?.find((p) => p._id === watch('planId'));
  const option = plan?.pricing.find((o) => o.period === watch('period'));
  const submit = async (v) => {
    setFormError('');
    try {
      const res = mode === 'payment'
        ? await api.post('/payments/offline', { userId: member.id, planId: v.planId, period: v.period, method: v.method, note: v.note || undefined, amountPaise: v.amount ? Math.round(Number(v.amount) * 100) : undefined })
        : await api.post('/memberships/assign', { userId: member.id, planId: v.planId, period: v.period, startDate: v.startDate || undefined, note: v.note || undefined });
      onDone(res.message);
    } catch (err) { setFormError(applyServerErrors(err, setError)); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={mode === 'payment' ? 'Record offline payment' : 'Assign complimentary membership'}
      description={mode === 'payment' ? 'For cash, UPI or card payments taken at the front desk. A receipt is emailed.' : 'No payment is recorded. Use for staff, corporate or promotional memberships.'}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(submit)}>{mode === 'payment' ? 'Record payment' : 'Assign'}</Button></>}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <FormAlert>{error}</FormAlert>
        <Field label="Plan" required error={errors.planId?.message}>{(a) => (
          <Select {...a} {...register('planId', { required: 'Choose a plan' })}><option value="">— Select —</option>{plans?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
        )}</Field>
        <Field label="Period">{(a) => <Select {...a} {...register('period')}>{(plan?.pricing || Object.keys(PERIODS).map((period) => ({ period }))).map((o) => <option key={o.period} value={o.period}>{PERIODS[o.period].label}{o.pricePaise !== undefined ? ` — ${formatPaise(o.pricePaise)}` : ''}</option>)}</Select>}</Field>
        {mode === 'payment' ? (
          <>
            <Field label="Method">{(a) => <Select {...a} {...register('method')}><option value="cash">Cash</option><option value="upi_offline">UPI (at desk)</option><option value="card_offline">Card (at desk)</option></Select>}</Field>
            <Field label="Amount received (₹)" hint={option ? `Plan price ${formatPaise(option.pricePaise)}. Leave blank to use it.` : undefined}>{(a) => <input {...a} type="number" min="0" className="input" {...register('amount')} />}</Field>
          </>
        ) : (
          <Field label="Start date" hint="Leave blank to start now, or after their current membership">{(a) => <input {...a} type="date" className="input" {...register('startDate')} />}</Field>
        )}
        <Field label="Note">{(a) => <Textarea {...a} rows={2} {...register('note')} />}</Field>
      </form>
    </Modal>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['member', id], queryFn: async () => (await api.get(`/members/${id}`)).data });
  const trainers = useQuery({ queryKey: ['options', 'trainers'], queryFn: async () => (await api.get('/admin/trainers?limit=100&isActive=true')).data });
  const isAdmin = ['owner', 'admin'].includes(me.role);

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const { user, profile, memberships, payments, attendance, bookings, progress } = q.data;
  const now = new Date();
  const current = memberships.find((m) => m.status === 'active' && new Date(m.startDate) <= now && new Date(m.endDate) >= now);
  const refresh = (msg) => { toast.success(msg); setModal(null); setReason(''); qc.invalidateQueries({ queryKey: ['member', id] }); qc.invalidateQueries({ queryKey: ['/members'] }); };
  const run = async (fn) => { try { refresh((await fn()).message); } catch (err) { toast.error(err); } };

  return (
    <>
      <Seo title={user.name} noindex />
      <Link to="/admin/members" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" aria-hidden />Members</Link>
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="h-16 w-16 overflow-hidden rounded-full border border-gold/40 bg-elevated">{user.avatar?.url ? <Img image={user.avatar} alt="" sizes="64px" className="h-full w-full" /> : <span className="grid h-full place-items-center font-display text-2xl text-gold">{user.name[0]}</span>}</span>
          <div>
            <h1 className="text-3xl font-semibold">{user.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{user.email}{user.phone && ` · ${user.phone}`}<StatusBadge status={user.status} />{!user.emailVerified && <Badge>unverified</Badge>}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setModal('payment')}><CreditCard className="h-4 w-4" aria-hidden />Record payment</Button>
          {isAdmin && <Button size="sm" variant="outline" onClick={() => setModal('assign')}><Crown className="h-4 w-4" aria-hidden />Assign plan</Button>}
          <Button size="sm" variant="outline" disabled={!current} onClick={() => run(() => api.post('/attendance/manual', { memberId: user.id }))}><LogIn className="h-4 w-4" aria-hidden />Check in / out</Button>
          {isAdmin && (user.status === 'active'
            ? <Button size="sm" variant="ghost" onClick={() => setModal('suspend')}><Ban className="h-4 w-4" aria-hidden />Suspend</Button>
            : <Button size="sm" variant="ghost" onClick={() => setModal('reactivate')}><CheckCircle2 className="h-4 w-4" aria-hidden />Reactivate</Button>)}
        </div>
      </div>

      {user.deletionRequestedAt && isAdmin && (
        <div className="mb-6 flex flex-col gap-3 rounded-brand border border-danger/30 bg-danger/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm"><strong>Deletion requested</strong> on {formatDate(user.deletionRequestedAt)}{q.data.deletionReason ? ` — “${q.data.deletionReason}”` : ''}. Approving anonymises personal data and keeps payment records.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => run(() => api.post(`/members/${id}/deletion`, { decision: 'reject' }))}>Reject</Button>
            <Button size="sm" variant="danger" onClick={() => setModal('delete')}><Trash2 className="h-4 w-4" aria-hidden />Approve deletion</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Membership">
            {current ? (
              <KeyValue items={[['Plan', current.plan?.name], ['Period', PERIODS[current.period]?.label], ['Started', formatDate(current.startDate)], ['Ends', formatDate(current.endDate)], ['Days left', Math.ceil((new Date(current.endDate) - now) / 864e5)], current.cancellation?.status !== 'none' && ['Cancellation', current.cancellation?.status]]} />
            ) : <p className="text-sm text-muted">No active membership.</p>}
            {memberships.length > 0 && (
              <details className="mt-5 text-sm">
                <summary className="cursor-pointer text-gold">History ({memberships.length})</summary>
                <ul className="mt-3 divide-y divide-line/5">
                  {memberships.map((m) => <li key={m._id} className="flex flex-wrap justify-between gap-2 py-2"><span>{m.plan?.name} · {PERIODS[m.period]?.label}</span><span className="text-muted">{formatDate(m.startDate)} – {formatDate(m.endDate)}</span><StatusBadge status={m.status} /></li>)}
                </ul>
              </details>
            )}
          </Card>
          <Card title="Payments" padded={false}>
            {payments.length ? (
              <ul className="divide-y divide-line/5 text-sm">
                {payments.map((p) => (
                  <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div><p className="font-medium">{formatPaise(p.amountPaise)} · {p.plan?.name || p.purpose}</p><p className="text-xs text-muted">{formatDate(p.paidAt || p.createdAt)} · {p.method.replace('_', ' ')}{p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={p.status} />{p.invoiceNumber && <a href={apiUrl(`/payments/${p._id}/invoice`)} className="rounded-full p-2 text-muted hover:text-gold" aria-label={`Download invoice ${p.invoiceNumber}`}><Download className="h-4 w-4" /></a>}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-muted">No payments yet.</p>}
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Recent attendance" padded={false}>
              {attendance.length ? <ul className="divide-y divide-line/5 text-sm">{attendance.slice(0, 10).map((a) => <li key={a._id} className="flex justify-between px-5 py-2.5"><span>{a.day}</span><span className="text-muted">{formatDate(a.checkInAt, { hour: 'numeric', minute: '2-digit' })}{a.checkOutAt ? ` – ${formatDate(a.checkOutAt, { hour: 'numeric', minute: '2-digit' })}` : ''}</span></li>)}</ul> : <p className="p-5 text-sm text-muted">No visits recorded.</p>}
            </Card>
            <Card title="Bookings" padded={false}>
              {bookings.length ? <ul className="divide-y divide-line/5 text-sm">{bookings.slice(0, 10).map((b) => <li key={b._id} className="flex items-center justify-between gap-2 px-5 py-2.5"><span>{b.classSchedule?.title || `PT · ${b.trainer?.name}`}<span className="block text-xs text-muted">{formatDate(b.startAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></span><StatusBadge status={b.status} /></li>)}</ul> : <p className="p-5 text-sm text-muted">No bookings.</p>}
            </Card>
          </div>
        </div>
        <div className="space-y-6">
          <Card title="Profile">
            <KeyValue items={[
              ['Fitness level', profile?.fitnessLevel], ['Height', profile?.heightCm ? `${profile.heightCm} cm` : null],
              ['Date of birth', profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : null], ['Referral code', profile?.referralCode],
              ['Referred by', profile?.referredBy?.name], ['Joined', formatDate(user.createdAt)], ['Last login', q.data.lastLoginAt ? formatDate(q.data.lastLoginAt) : 'Never'],
            ]} />
            {profile?.fitnessGoals?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{profile.fitnessGoals.map((g) => <Badge key={g} tone="gold" className="normal-case">{g}</Badge>)}</div>}
            <Field label="Assigned trainer" className="mt-5">{(a) => (
              <Select {...a} value={profile?.assignedTrainer?._id || ''} onChange={(e) => run(() => api.patch(`/members/${id}/profile`, { assignedTrainer: e.target.value || null }))}>
                <option value="">— None —</option>{trainers.data?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </Select>
            )}</Field>
          </Card>
          <Card title="Emergency & health">
            <KeyValue items={[['Emergency contact', profile?.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.relation || '—'})` : null], ['Emergency phone', profile?.emergencyContact?.phone]]} />
            <p className="mt-4 text-xs uppercase tracking-wider text-muted">Medical notes</p>
            <p className="mt-1 whitespace-pre-line text-sm">{profile?.medicalNotes || '—'}</p>
          </Card>
          <Card title="Latest progress">
            {progress.length ? <ul className="space-y-2 text-sm">{progress.slice(0, 5).map((p) => <li key={p._id} className="flex justify-between"><span className="text-muted">{formatDate(p.date)}</span><span>{p.weightKg ? `${p.weightKg} kg` : ''}{p.bodyFatPct ? ` · ${p.bodyFatPct}% fat` : ''}</span></li>)}</ul> : <p className="text-sm text-muted">No entries yet.</p>}
          </Card>
        </div>
      </div>

      {(modal === 'payment' || modal === 'assign') && <PlanPaymentModal member={user} mode={modal} onClose={() => setModal(null)} onDone={refresh} />}
      <ConfirmDialog open={modal === 'suspend' || modal === 'reactivate'} onClose={() => setModal(null)} tone={modal === 'suspend' ? 'danger' : 'primary'}
        title={modal === 'suspend' ? 'Suspend account?' : 'Reactivate account?'} confirmLabel={modal === 'suspend' ? 'Suspend' : 'Reactivate'}
        message={modal === 'suspend' ? 'The member is signed out everywhere and cannot log in or check in until reactivated.' : undefined}
        onConfirm={() => (reason.trim().length < 3 ? toast.error('Please enter a reason (min 3 characters)') : run(() => api.patch(`/members/${id}/status`, { status: modal === 'suspend' ? 'suspended' : 'active', reason })))}>
        <Field label="Reason (recorded in the audit log)" className="mt-4">{(a) => <Textarea {...a} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </ConfirmDialog>
      <ConfirmDialog open={modal === 'delete'} onClose={() => setModal(null)} title="Approve deletion?" confirmLabel="Anonymise member"
        message="Name, contact details, profile, progress and sessions are removed. Payments and invoices are kept for accounting. This cannot be undone."
        onConfirm={() => run(() => api.post(`/members/${id}/deletion`, { decision: 'approve' }))} />
    </>
  );
}
