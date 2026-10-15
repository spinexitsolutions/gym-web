import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Dumbbell, FileDown, Gift, Mail, Pencil, Phone, RotateCcw, ScanLine, UserCog } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  KeyValue,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
  type Column,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtTime, money, titleCase } from '@/lib/format';
import type { Booking, MembershipView, PaymentView, User } from '@/types/api';
import { Metric, RowActions } from '../components/Bits';
import { GrantMembershipModal } from '../components/GrantMembershipModal';
import { MembershipActions } from '../components/MembershipActionsModal';
import { OfflinePaymentModal } from '../components/OfflinePaymentModal';
import { PaymentDetailModal, RefundModal, canRefund, downloadReceipt } from '../components/PaymentModals';
import { ReasonDialog } from '../components/ReasonDialog';
import { trainerOptions, useTrainersAdmin } from '../components/queries';
import type { AdminPayment, AttendanceRecord, MemberDetail } from '../components/types';
import { applyApiErrors } from '../components/utils';

const editSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, 'Digits, spaces, + ( ) - only'),
});
type EditForm = z.infer<typeof editSchema>;

function EditMemberModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { register, handleSubmit, reset, setError, formState } = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  useEffect(() => {
    if (open) reset({ name: user.name, email: user.email, phone: user.phone ?? '' });
  }, [open, user, reset]);
  const m = useMutation({
    mutationFn: (f: EditForm) => api.patch<User>(`/members/${user.id}`, f),
    onSuccess: () => {
      toast.success('Member updated');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setError('email', { message: err.message });
      else if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-member-form" loading={m.isPending} disabled={!formState.isDirty}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-member-form" className="grid gap-4" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Input label="Full name" required error={e.name?.message} {...register('name')} />
        <Input label="Email" type="email" required error={e.email?.message} hint="Changing the email changes the member’s login." {...register('email')} />
        <Input label="Phone" type="tel" error={e.phone?.message} {...register('phone')} />
      </form>
    </Modal>
  );
}

function AssignTrainerModal({ open, onClose, memberId, current }: { open: boolean; onClose: () => void; memberId: string; current: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const trainers = useTrainersAdmin(open);
  const [value, setValue] = useState(current ?? '');
  useEffect(() => {
    if (open) setValue(current ?? '');
  }, [open, current]);
  const m = useMutation({
    mutationFn: () => api.post(`/members/${memberId}/assign-trainer`, { trainerId: value || null }),
    onSuccess: () => {
      toast.success(value ? 'Trainer assigned' : 'Trainer removed');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (err) => toast.error(err),
  });
  const opts = trainerOptions(trainers.data);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Assign trainer"
      description="The trainer can see this member’s profile, progress and workout plans."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate()} disabled={(current ?? '') === value}>
            Save
          </Button>
        </>
      }
    >
      <Select
        label="Trainer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={trainers.isLoading ? 'Loading…' : 'No trainer'}
        options={opts.map((o) => {
          const t = trainers.data?.find((x) => x.user._id === o.value);
          return { ...o, label: `${o.label}${t ? ` · ${t.assignedMembers}${t.maxClients ? `/${t.maxClients}` : ''} clients` : ''}` };
        })}
        error={trainers.isError ? 'Could not load trainers' : undefined}
      />
    </Modal>
  );
}

type TabKey = 'memberships' | 'payments' | 'attendance' | 'bookings' | 'workouts' | 'profile';

export default function MemberDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('memberships');
  const [modal, setModal] = useState<null | 'edit' | 'status' | 'trainer' | 'payment' | 'grant' | 'checkin'>(null);
  const [refund, setRefund] = useState<PaymentView | null>(null);
  const [detail, setDetail] = useState<AdminPayment | null>(null);
  const q = useQuery({ queryKey: ['admin', 'member', id], queryFn: () => api.get<MemberDetail>(`/members/${id}`), enabled: Boolean(id) });

  const statusM = useMutation({
    mutationFn: (reason: string) => api.post<User>(`/members/${id}/status`, { status: q.data?.user.status === 'suspended' ? 'active' : 'suspended', reason }),
    onSuccess: (u) => {
      toast.success(u.status === 'suspended' ? 'Member suspended' : 'Member reactivated', u.status === 'suspended' ? 'All sessions were signed out.' : undefined);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
    onError: (err) => toast.error(err),
  });
  const checkInM = useMutation({
    mutationFn: () => api.post<{ member: { name: string }; membership: { planName: string; endDate: string } }>('/attendance/check-in', { memberId: id }),
    onSuccess: (r) => {
      toast.success(`${r.member.name} checked in`, `${r.membership.planName} · valid to ${fmtDate(r.membership.endDate)}`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
    onError: (err) => {
      toast.error(err);
      setModal(null);
    },
  });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-36" />
        <Skeleton className="h-72" />
      </div>
    );
  if (q.error || !q.data)
    return (
      <div>
        <Link to="/admin/members" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Members
        </Link>
        <ErrorState error={q.error} title={q.error instanceof ApiError && q.error.status === 404 ? 'Member not found' : undefined} onRetry={() => q.refetch()} />
      </div>
    );

  const { user, profile, memberships, payments, attendance, bookings, workoutPlans } = q.data;
  const current = memberships.find((m) => m.status === 'active') ?? memberships.find((m) => m.status === 'upcoming') ?? null;
  const cancelReq = memberships.find((m) => m.cancellationRequestedAt && ['active', 'upcoming'].includes(m.status));
  const captured = (payments ?? []).filter((p) => ['captured', 'partially_refunded', 'refunded'].includes(p.status));
  const lifetime = captured.reduce((s, p) => s + p.amountMinor - (p.refund?.amountMinor ?? 0), 0);

  const membershipCols: Column<MembershipView>[] = [
    { key: 'plan', header: 'Plan', cell: (m) => <span className="font-medium">{m.planName}{m.isTrial && <Badge className="ml-2">trial</Badge>}</span> },
    { key: 'status', header: 'Status', cell: (m) => <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={m.status} />{m.cancellationRequestedAt && ['active', 'upcoming'].includes(m.status) && <Badge tone="warning">cancel requested</Badge>}</div> },
    { key: 'dates', header: 'Dates', cell: (m) => <span className="tabular-nums">{fmtDate(m.startDate)} → {fmtDate(m.endDate)}{m.daysLeft !== null && <span className="block text-xs text-muted">{m.daysLeft} days left</span>}</span> },
    { key: 'source', header: 'Source', hideOnMobile: true, cell: (m) => <span className="text-muted">{titleCase(m.source)}</span> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', cell: (m) => <RowActions><MembershipActions membership={m} compact /></RowActions> },
  ];
  const paymentCols: Column<PaymentView>[] = [
    { key: 'date', header: 'Date', cell: (p) => <span className="tabular-nums">{fmtDate(p.capturedAt ?? p.createdAt)}</span> },
    { key: 'plan', header: 'Plan', cell: (p) => <span>{p.planName}<span className="block text-xs text-muted">{titleCase(p.provider)}{p.method ? ` · ${titleCase(p.method)}` : ''}</span></span> },
    { key: 'amount', header: 'Amount', cell: (p) => <span className="tabular-nums font-medium">{money(p.amountMinor)}{p.refund && <span className="block text-xs text-danger">−{money(p.refund.amountMinor)} refunded</span>}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (p) => (
        <RowActions>
          {p.receiptNumber && p.capturedAt && <Button size="sm" variant="ghost" aria-label="Download receipt" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadReceipt(p, toast.error)} />}
          {can('payments:write') && canRefund(p) && (
            <Button size="sm" variant="ghost" className="text-danger" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setRefund(p)}>
              Refund
            </Button>
          )}
        </RowActions>
      ),
    },
  ];
  const attendanceCols: Column<AttendanceRecord>[] = [
    { key: 'day', header: 'Day', cell: (a) => fmtDate(a.checkInAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) },
    { key: 'in', header: 'In', cell: (a) => <span className="tabular-nums">{fmtTime(a.checkInAt)}</span> },
    { key: 'out', header: 'Out', cell: (a) => <span className="tabular-nums text-muted">{a.checkOutAt ? fmtTime(a.checkOutAt) : '—'}</span> },
    { key: 'method', header: 'Method', cell: (a) => <Badge>{a.method}</Badge> },
    { key: 'class', header: 'Class', hideOnMobile: true, cell: (a) => (a.gymClass && typeof a.gymClass === 'object' ? a.gymClass.title : '—') },
  ];
  const bookingCols: Column<Booking>[] = [
    { key: 'when', header: 'When', cell: (b) => <span className="tabular-nums">{fmtDateTime(b.startsAt)}</span> },
    { key: 'what', header: 'Booking', cell: (b) => (b.type === 'class' ? b.gymClass?.title ?? 'Class' : titleCase(b.type)) },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
  ];

  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: 'memberships', label: 'Memberships', count: memberships.length },
    ...(payments ? [{ value: 'payments' as const, label: 'Payments', count: payments.length }] : []),
    { value: 'attendance', label: 'Attendance', count: attendance.length },
    { value: 'bookings', label: 'Bookings', count: bookings.length },
    { value: 'workouts', label: 'Workout plans', count: workoutPlans.length },
    { value: 'profile', label: 'Profile' },
  ];

  return (
    <div>
      <Link to="/admin/members" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Members
      </Link>

      <Card className="mb-5">
        <CardBody className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl || undefined} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{user.name}</h1>
                <StatusBadge status={user.status} />
                {!user.emailVerified && <Badge tone="warning">email unverified</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </a>
                {user.phone && (
                  <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                    <Phone className="h-3.5 w-3.5" />
                    {user.phone}
                  </a>
                )}
                <span>Joined {fmtDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('attendance:write') && (
              <Button variant="secondary" size="sm" icon={<ScanLine className="h-4 w-4" />} onClick={() => setModal('checkin')} disabled={user.status !== 'active'}>
                Check in
              </Button>
            )}
            {can('payments:write') && (
              <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => setModal('payment')}>
                Record payment
              </Button>
            )}
            {can('members:write') && (
              <>
                <Button variant="secondary" size="sm" icon={<Gift className="h-4 w-4" />} onClick={() => setModal('grant')}>
                  Grant
                </Button>
                <Button variant="secondary" size="sm" icon={<UserCog className="h-4 w-4" />} onClick={() => setModal('trainer')}>
                  Trainer
                </Button>
                <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setModal('edit')}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className={user.status === 'suspended' ? 'text-success' : 'text-danger'} icon={user.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />} onClick={() => setModal('status')}>
                  {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                </Button>
              </>
            )}
          </div>
        </CardBody>
        <div className="grid grid-cols-2 gap-4 border-t border-line/70 px-5 py-4 sm:grid-cols-4">
          <Metric label="Current plan" value={current ? <span className="text-base">{current.planName}</span> : <span className="text-base text-muted">None</span>} />
          <Metric label="Valid until" value={current ? <span className="text-base">{fmtDate(current.endDate)}</span> : '—'} />
          <Metric label="Trainer" value={<span className="text-base">{profile?.assignedTrainer?.name ?? '—'}</span>} />
          {payments ? <Metric label="Lifetime value" value={money(lifetime)} /> : <Metric label="Check-ins (recent)" value={attendance.length} />}
        </div>
      </Card>

      {user.status === 'suspended' && (
        <Alert tone="danger" title="Account suspended" className="mb-4">
          The member cannot sign in or check in until reactivated.
        </Alert>
      )}
      {cancelReq && (
        <Alert tone="warning" title="Cancellation requested" className="mb-4">
          Requested {fmtDate(cancelReq.cancellationRequestedAt)} for {cancelReq.planName}. Review it in the Memberships tab — cancel it or dismiss the request.
        </Alert>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4 w-fit max-w-full" />

      {tab === 'memberships' && (
        <DataTable
          caption="Memberships"
          columns={membershipCols}
          rows={memberships}
          rowKey={(m) => m.id}
          empty={{
            title: 'No memberships yet',
            description: 'Record a payment or grant a complimentary membership to give this member access.',
            action: can('payments:write') ? (
              <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => setModal('payment')}>
                Record payment
              </Button>
            ) : undefined,
          }}
        />
      )}
      {tab === 'payments' && payments && (
        <DataTable
          caption="Payments"
          columns={paymentCols}
          rows={payments}
          rowKey={(p) => p.id}
          onRowClick={(p) => setDetail({ ...p, user: { _id: user.id, name: user.name, email: user.email } })}
          empty={{ title: 'No payments', description: 'Online and front-desk payments for this member appear here.' }}
        />
      )}
      {tab === 'attendance' && <DataTable caption="Attendance" columns={attendanceCols} rows={attendance} rowKey={(a) => a._id} empty={{ title: 'No check-ins yet', description: 'Shows the last 30 visits.' }} />}
      {tab === 'bookings' && <DataTable caption="Bookings" columns={bookingCols} rows={bookings} rowKey={(b) => b._id} empty={{ title: 'No bookings yet', description: 'Class, personal training and trial bookings appear here.' }} />}
      {tab === 'workouts' &&
        (workoutPlans.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No workout plans" description="The assigned trainer creates workout plans from the trainer dashboard." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workoutPlans.map((w) => (
              <Card key={w._id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{w.title}</p>
                  <StatusBadge status={w.status} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {w.trainer?.name ? `By ${w.trainer.name} · ` : ''}updated {fmtDate(w.updatedAt)}
                </p>
              </Card>
            ))}
          </div>
        ))}
      {tab === 'profile' && (
        <Card>
          <CardHeader title="Member profile" description="Details the member shared in their profile." />
          <CardBody>
            {profile ? (
              <KeyValue
                items={[
                  { label: 'Date of birth', value: fmtDate(profile.dateOfBirth ?? null) },
                  { label: 'Gender', value: profile.gender ? titleCase(profile.gender) : '—' },
                  { label: 'Height', value: profile.heightCm ? `${profile.heightCm} cm` : '—' },
                  { label: 'Fitness level', value: profile.fitnessLevel ? titleCase(profile.fitnessLevel) : '—' },
                  { label: 'Emergency contact', value: profile.emergencyContact?.name ? `${profile.emergencyContact.name} · ${profile.emergencyContact.phone ?? ''}` : '—' },
                  { label: 'Address', value: profile.address || '—' },
                  { label: 'Loyalty points', value: profile.loyaltyPoints ?? 0 },
                  { label: 'Referral code', value: profile.referralCode ? <code>{profile.referralCode}</code> : '—' },
                  { label: 'Health notes', value: <span className="whitespace-pre-wrap">{profile.healthNotes || '—'}</span> },
                  { label: 'Goals', value: profile.goals?.length ? profile.goals.map((g) => g.title).join(', ') : '—' },
                  { label: 'Notifications', value: `Email ${user.notificationPrefs?.email ? 'on' : 'off'} · WhatsApp ${user.notificationPrefs?.whatsapp ? 'on' : 'off'} · Marketing ${user.notificationPrefs?.marketing ? 'on' : 'off'}` },
                  { label: 'Last login', value: fmtDateTime(user.lastLoginAt) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">The member hasn’t completed a profile yet.</p>
            )}
          </CardBody>
        </Card>
      )}

      <EditMemberModal open={modal === 'edit'} onClose={() => setModal(null)} user={user} />
      <AssignTrainerModal open={modal === 'trainer'} onClose={() => setModal(null)} memberId={user.id} current={profile?.assignedTrainer?._id ?? null} />
      <OfflinePaymentModal open={modal === 'payment'} onClose={() => setModal(null)} member={{ id: user.id, name: user.name, email: user.email, membership: current }} />
      <GrantMembershipModal open={modal === 'grant'} onClose={() => setModal(null)} member={{ id: user.id, name: user.name }} />
      <ReasonDialog
        open={modal === 'status'}
        onClose={() => setModal(null)}
        onConfirm={(r) => statusM.mutate(r)}
        loading={statusM.isPending}
        tone={user.status === 'suspended' ? 'primary' : 'danger'}
        title={user.status === 'suspended' ? `Reactivate ${user.name}?` : `Suspend ${user.name}?`}
        description={user.status === 'suspended' ? 'The member can sign in and check in again.' : 'Signs the member out everywhere and blocks sign-in and check-in. Memberships are not changed.'}
        confirmLabel={user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
      />
      <ConfirmDialog open={modal === 'checkin'} onClose={() => setModal(null)} onConfirm={() => checkInM.mutate()} loading={checkInM.isPending} title={`Check in ${user.name}?`} description="Records today’s visit (one per day). Requires an active membership." confirmLabel="Check in" />
      <RefundModal payment={refund} onClose={() => setRefund(null)} />
      <PaymentDetailModal
        payment={detail}
        onClose={() => setDetail(null)}
        onRefund={(p) => {
          setDetail(null);
          setRefund(p);
        }}
      />
    </div>
  );
}
