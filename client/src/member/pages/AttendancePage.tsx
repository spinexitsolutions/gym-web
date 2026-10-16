import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, Flame, QrCode, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, DataTable, ErrorState, PageHeader, Pagination, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import { AttendanceCalendar, currentStreak } from '../components/AttendanceCalendar';
import type { AttendanceRecord } from '../components/types';
import { dayKey } from '../components/utils';

const methodLabel = { qr: 'QR scan', manual: 'Front desk', class: 'Class' } as const;

export default function AttendancePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { brandName } = useSite();
  const [page, setPage] = useState(1);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const qr = useQuery({ queryKey: ['member', 'qr'], queryFn: () => api.get<{ payload: string }>('/attendance/me/qr'), staleTime: 0 });
  const history = useQuery({ queryKey: ['member', 'attendance', page], queryFn: () => api.getPaged<AttendanceRecord[]>('/attendance/me', { page, limit: 15 }) });
  const recent = useQuery({ queryKey: ['member', 'attendance', 'recent'], queryFn: () => api.getPaged<AttendanceRecord[]>('/attendance/me', { page: 1, limit: 100 }) });

  const rotate = useMutation({
    mutationFn: () => api.post<{ payload: string }>('/attendance/me/qr/rotate'),
    onSuccess: (d) => {
      qc.setQueryData(['member', 'qr'], d);
      setConfirmRotate(false);
      toast.success('New check-in code created', 'Your old code no longer works.');
    },
    onError: (err) => toast.error(err),
  });

  const dayMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of recent.data?.data ?? []) m.set(a.day, (m.get(a.day) ?? 0) + 1);
    return m;
  }, [recent.data]);
  const streak = currentStreak(new Set(dayMap.keys()));
  const total = (recent.data?.meta?.total as number | undefined) ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Training" title="Check-in & attendance" description="Show this code at the front desk (or to your coach) to check in. One check-in per day earns reward points." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-6 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.06]" />
          <p className="relative eyebrow justify-center">{brandName}</p>
          <p className="relative mt-1 font-display text-lg font-semibold">{user?.name}</p>
          <div className="relative mx-auto mt-5 w-fit rounded-3xl bg-white p-5 shadow-2xl">
            {qr.isError ? (
              <div className="grid h-[240px] w-[240px] place-items-center">
                <ErrorState error={qr.error} onRetry={() => qr.refetch()} className="border-0 bg-transparent text-black" />
              </div>
            ) : !qr.data ? (
              <Skeleton className="h-[240px] w-[240px] !bg-black/10" />
            ) : (
              <QRCodeSVG value={qr.data.payload} size={240} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={0} aria-label="Your personal check-in QR code" role="img" />
            )}
          </div>
          <p className="relative mt-4 inline-flex items-center gap-1.5 text-sm text-muted">
            <Sun className="h-4 w-4 text-warning" /> Turn your screen brightness up for a faster scan.
          </p>
          <div className="relative mt-5 flex flex-col items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setConfirmRotate(true)} disabled={!qr.data}>
              Generate a new code
            </Button>
            <p className="max-w-xs text-xs text-muted">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              Your code is personal. If you think someone else has a screenshot of it, generate a new one — the old code stops working immediately.
            </p>
          </div>
        </motion.div>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Day streak', value: recent.data ? streak : '–', icon: Flame },
              { label: 'This month', value: recent.data ? [...dayMap.keys()].filter((k) => k.startsWith(dayKey(new Date()).slice(0, 7))).length : '–', icon: CalendarDays },
              { label: 'All-time visits', value: recent.data ? total : '–', icon: QrCode },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <s.icon className="h-4 w-4 text-primary" />
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
          <Card>
            <CardBody>{recent.isLoading ? <Skeleton className="h-64" /> : recent.isError ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} /> : <AttendanceCalendar days={dayMap} />}</CardBody>
          </Card>
          {recent.data && total === 0 && (
            <Alert tone="info" title="No visits yet">
              Your check-ins will light up the calendar. Aim for 3 a week to build the habit.
            </Alert>
          )}
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader title="Attendance history" />
        <div className="p-4">
          <DataTable
            caption="Attendance history"
            isLoading={history.isLoading}
            error={history.error ?? undefined}
            onRetry={() => history.refetch()}
            rows={history.data?.data}
            rowKey={(a) => a._id}
            empty={{ title: 'No check-ins yet', description: 'Each visit appears here with the time and how you checked in.' }}
            columns={[
              { key: 'date', header: 'Date', cell: (a) => <span className="font-medium">{fmtDate(a.checkInAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span> },
              { key: 'time', header: 'In', cell: (a) => fmtTime(a.checkInAt) },
              { key: 'out', header: 'Out', hideOnMobile: true, cell: (a) => (a.checkOutAt ? fmtTime(a.checkOutAt) : '—') },
              { key: 'how', header: 'How', cell: (a) => (a.gymClass && typeof a.gymClass === 'object' ? a.gymClass.title : methodLabel[a.method]) },
            ]}
          />
          {history.data?.meta && <Pagination page={history.data.meta.page} pages={history.data.meta.pages} total={history.data.meta.total} onPage={setPage} />}
        </div>
      </Card>

      <ConfirmDialog open={confirmRotate} onClose={() => setConfirmRotate(false)} onConfirm={() => rotate.mutate()} loading={rotate.isPending} title="Generate a new check-in code?" confirmLabel="Generate new code">
        <p className="text-sm text-muted">Your current QR code will stop working straight away. Any screenshot of the old code becomes useless.</p>
      </ConfirmDialog>
    </div>
  );
}
