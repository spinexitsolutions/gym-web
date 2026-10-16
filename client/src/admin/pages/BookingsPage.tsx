import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Mail, Phone, XCircle } from 'lucide-react';
import { Alert, Button, DataTable, Input, Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, Textarea, useToast, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtTime, relativeTime, titleCase } from '@/lib/format';
import type { Booking } from '@/types/api';
import { PersonCell, RowActions } from '../components/Bits';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { FilterBar, FilterSelect } from '../components/FilterBar';
import { ReasonDialog } from '../components/ReasonDialog';
import { trainerOptions, useTrainersAdmin } from '../components/queries';
import { apiFieldErrors, cleanQuery, combineDateTime, endOfDayIso, startOfDayIso, toDateInput, toTimeInput } from '../components/utils';

type BType = 'trial' | 'class' | 'personal_training';
const STATUSES = ['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show'] as const;

const who = (b: Booking) => (b.user && typeof b.user === 'object' ? { name: b.user.name, email: b.user.email, phone: b.user.phone, id: b.user._id } : { name: b.guest?.name ?? 'Guest', email: b.guest?.email, phone: b.guest?.phone, id: null });

function TrialModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const trainers = useTrainersAdmin(Boolean(booking));
  const [status, setStatus] = useState<'confirmed' | 'cancelled' | 'attended' | 'no_show'>('confirmed');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!booking) return;
    setStatus(booking.status === 'pending' ? 'confirmed' : booking.status === 'confirmed' ? 'attended' : (booking.status as 'confirmed'));
    setDate(toDateInput(booking.startsAt));
    setTime(toTimeInput(booking.startsAt));
    setTrainerId(booking.trainer && typeof booking.trainer === 'object' ? booking.trainer._id : '');
    setNotes('');
    setErrors({});
  }, [booking]);
  const m = useMutation({
    mutationFn: () =>
      api.patch(`/bookings/${booking!._id}/trial`, {
        status,
        startsAt: status === 'confirmed' ? combineDateTime(date, time) : undefined,
        trainerId: trainerId || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Trial ${titleCase(status).toLowerCase()}`, status === 'confirmed' && booking?.guest?.email ? 'A confirmation email was sent to the guest.' : undefined);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (err) => {
      const fe = apiFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(err);
    },
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (status === 'confirmed' && (!date || !time)) e.startsAt = 'Choose a date and time';
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  const p = booking ? who(booking) : null;
  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title="Handle trial request"
      description={p ? `${p.name} · requested ${booking ? relativeTime(booking.createdAt) : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant={status === 'cancelled' || status === 'no_show' ? 'danger' : 'primary'} loading={m.isPending} onClick={submit}>
            {status === 'confirmed' ? 'Confirm trial' : `Mark ${titleCase(status).toLowerCase()}`}
          </Button>
        </>
      }
    >
      {booking && p && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="rounded-theme-sm border border-line bg-fg/[0.03] p-4 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {p.email && (
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" />
                  {p.email}
                </a>
              )}
              {p.phone && (
                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" />
                  {p.phone}
                </a>
              )}
            </div>
            <p className="mt-2 text-muted">Preferred: {fmtDate(booking.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            {booking.goal && <p className="mt-1">Goal: {booking.goal}</p>}
            {booking.notes && <p className="mt-1 whitespace-pre-wrap text-muted">{booking.notes}</p>}
          </div>
          <Select
            label="Outcome"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            options={[
              { value: 'confirmed', label: 'Confirm a time' },
              { value: 'attended', label: 'Attended' },
              { value: 'no_show', label: 'No-show' },
              { value: 'cancelled', label: 'Cancel request' },
            ]}
          />
          {status === 'confirmed' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" label="Date" required value={date} onChange={(e) => setDate(e.target.value)} error={errors.startsAt} />
                <Input type="time" label="Time" required step={900} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <Alert tone="info">The guest receives a confirmation email with this time (1-hour session).</Alert>
            </>
          )}
          <Select label="Trainer" value={trainerId} onChange={(e) => setTrainerId(e.target.value)} placeholder={trainers.isLoading ? 'Loading…' : 'Unassigned'} options={trainerOptions(trainers.data)} hint="The trainer is notified of the assignment." error={errors.trainerId} />
          <Textarea label="Internal notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — replaces the existing note" error={errors.notes} />
        </form>
      )}
    </Modal>
  );
}

export default function BookingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const initial = params.get('type') as BType | null;
  const [type, setType] = useState<BType>(initial && ['trial', 'class', 'personal_training'].includes(initial) ? initial : 'trial');
  const [status, setStatus] = useState<'' | (typeof STATUSES)[number]>(type === 'trial' ? 'pending' : '');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [trial, setTrial] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  useEffect(() => {
    setPage(1);
  }, [type, status, range.from, range.to]);
  useEffect(() => {
    setParams({ type }, { replace: true });
  }, [type, setParams]);

  const filters = cleanQuery({ type, status, from: startOfDayIso(range.from), to: endOfDayIso(range.to) });
  const list = useQuery({ queryKey: ['admin', 'bookings', filters, page], queryFn: () => api.getPaged<Booking[]>('/bookings', { ...filters, page, limit: 25 }), placeholderData: keepPreviousData });
  const pendingTrials = useQuery({ queryKey: ['admin', 'bookings', 'pending-trials'], queryFn: () => api.getPaged<Booking[]>('/bookings', { type: 'trial', status: 'pending', limit: 1 }) });

  const cancelM = useMutation({
    mutationFn: ({ b, reason }: { b: Booking; reason: string }) => api.post(`/bookings/${b._id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Booking cancelled', 'The member was notified and any waitlist was promoted.');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setCancelling(null);
    },
    onError: (err) => toast.error(err),
  });

  const personCol: Column<Booking> = {
    key: 'who',
    header: type === 'trial' ? 'Guest' : 'Member',
    cell: (b) => {
      const p = who(b);
      return p.id ? (
        <Link to={`/admin/members/${p.id}`} className="block hover:text-primary" onClick={(e) => e.stopPropagation()}>
          <PersonCell name={p.name} sub={p.email} />
        </Link>
      ) : (
        <PersonCell name={p.name} sub={[p.email, p.phone].filter(Boolean).join(' · ')} />
      );
    },
  };
  const when: Column<Booking> = {
    key: 'when',
    header: type === 'trial' ? 'Date' : 'When',
    cell: (b) => (
      <span className="whitespace-nowrap tabular-nums">
        {type === 'trial' && b.status === 'pending' ? (
          <>
            {fmtDate(b.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}
            <span className="block text-xs text-muted">preferred</span>
          </>
        ) : (
          <>
            {fmtDate(b.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}
            <span className="block text-xs text-muted">{fmtTime(b.startsAt)}</span>
          </>
        )}
      </span>
    ),
  };
  const statusCol: Column<Booking> = { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> };
  const actions: Column<Booking> = {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    className: 'text-right',
    cell: (b) => (
      <RowActions>
        {type === 'trial' && !['cancelled', 'attended', 'no_show'].includes(b.status) && (
          <Button size="sm" variant={b.status === 'pending' ? 'primary' : 'secondary'} icon={<CalendarCheck className="h-3.5 w-3.5" />} onClick={() => setTrial(b)}>
            {b.status === 'pending' ? 'Handle' : 'Update'}
          </Button>
        )}
        {type !== 'trial' && b.active && (
          <Button size="sm" variant="ghost" className="text-danger" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setCancelling(b)}>
            Cancel
          </Button>
        )}
      </RowActions>
    ),
  };
  const columns: Column<Booking>[] =
    type === 'trial'
      ? [personCol, when, { key: 'goal', header: 'Goal / notes', hideOnMobile: true, cell: (b) => <p className="line-clamp-2 max-w-xs text-sm text-muted">{[b.goal, b.notes].filter(Boolean).join(' — ') || '—'}</p> }, { key: 'trainer', header: 'Trainer', hideOnMobile: true, cell: (b) => (b.trainer && typeof b.trainer === 'object' ? b.trainer.name : <span className="text-muted">—</span>) }, statusCol, { key: 'created', header: 'Received', hideOnMobile: true, cell: (b) => <span className="text-xs text-muted">{relativeTime(b.createdAt)}</span> }, actions]
      : type === 'class'
        ? [personCol, { key: 'class', header: 'Class', cell: (b) => b.gymClass?.title ?? '—' }, when, statusCol, { key: 'booked', header: 'Booked', hideOnMobile: true, cell: (b) => <span className="text-xs text-muted">{fmtDateTime(b.createdAt)}</span> }, actions]
        : [personCol, { key: 'trainer', header: 'Trainer', cell: (b) => (b.trainer && typeof b.trainer === 'object' ? b.trainer.name : '—') }, when, { key: 'notes', header: 'Notes', hideOnMobile: true, cell: (b) => <p className="line-clamp-2 max-w-xs text-sm text-muted">{b.notes || '—'}</p> }, statusCol, actions];

  const pendingCount = pendingTrials.data?.meta?.total ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Bookings & trials" description="Free-trial requests from the website, class bookings and personal training sessions." />
      <Tabs
        className="mb-4 w-fit max-w-full"
        value={type}
        onChange={(t) => {
          setType(t);
          setStatus(t === 'trial' ? 'pending' : '');
        }}
        tabs={[
          { value: 'trial', label: 'Trial requests', count: pendingCount || undefined },
          { value: 'class', label: 'Class bookings' },
          { value: 'personal_training', label: 'Personal training' },
        ]}
      />
      <FilterBar>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES.filter((s) => type !== 'trial' || s !== 'waitlisted').map((s) => ({ value: s, label: titleCase(s) }))} />
        <DateRangePicker value={range} onChange={setRange} label="Session date" presets={false} />
        {(status || range.from || range.to) && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setStatus('');
              setRange({ from: '', to: '' });
            }}
          >
            Clear
          </Button>
        )}
      </FilterBar>
      <DataTable
        caption="Bookings"
        columns={columns}
        rows={list.data?.data}
        rowKey={(b) => b._id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        onRowClick={type === 'trial' ? (b) => !['cancelled', 'attended', 'no_show'].includes(b.status) && setTrial(b) : undefined}
        empty={
          type === 'trial'
            ? { title: status === 'pending' ? 'No pending trial requests' : 'No trial requests', description: 'Requests from the website’s free-trial form land here. You’ll also get a notification.' }
            : { title: 'No bookings match', description: 'Try clearing the filters.' }
        }
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      <TrialModal booking={trial} onClose={() => setTrial(null)} />
      <ReasonDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => cancelling && cancelM.mutate({ b: cancelling, reason })}
        loading={cancelM.isPending}
        tone="danger"
        required={false}
        title="Cancel this booking?"
        description={cancelling ? `${who(cancelling).name} · ${cancelling.gymClass?.title ?? titleCase(cancelling.type)} · ${fmtDateTime(cancelling.startsAt)}` : undefined}
        confirmLabel="Cancel booking"
        placeholder="Optional — shared with the member"
      />
    </div>
  );
}
