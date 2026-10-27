import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, Flame } from 'lucide-react';
import { api } from '../../services/api.js';
import { PageHeader, Card, StatCard } from '../../components/dashboard/Widgets.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { DataTable } from '../../components/dashboard/DataTable.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';

export default function MemberCheckInPage() {
  const qr = useQuery({ queryKey: ['qr'], queryFn: async () => (await api.get('/attendance/qr')).data, refetchOnWindowFocus: true, retry: false });
  const att = useQuery({ queryKey: ['attendance', 'me'], queryFn: async () => (await api.get('/attendance/me')).data, refetchInterval: 30_000 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Count down from when *this device* received the code (ttlSeconds), not the server's expiresAt timestamp,
  // so a phone whose clock is wrong cannot trigger a tight refetch loop. Refresh a few seconds early.
  const expiresLocal = qr.dataUpdatedAt + ((qr.data?.ttlSeconds || 60) - 5) * 1000;
  const secondsLeft = qr.data ? Math.max(0, Math.round((expiresLocal - now) / 1000)) : 0;
  useEffect(() => {
    if (qr.data && secondsLeft === 0 && !qr.isFetching && now - qr.dataUpdatedAt > 10_000) qr.refetch();
  }, [secondsLeft, qr, now]);

  return (
    <>
      <Seo title="Check-in" noindex />
      <PageHeader title="Check in" description="Show this code at the front desk. It refreshes every minute and can’t be screenshotted for someone else." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          {qr.isError ? (
            <ErrorState title="Check-in unavailable" message={qr.error.message} onRetry={qr.refetch} />
          ) : qr.isLoading ? <Skeleton className="aspect-square" /> : (
            <div className="flex flex-col items-center">
              <div className="rounded-brand bg-white p-5" aria-label="Your check-in QR code" role="img">
                <QRCodeSVG value={qr.data.token} size={260} level="M" marginSize={0} />
              </div>
              <p className="mt-4 text-sm text-muted" aria-live="polite">Refreshes in {secondsLeft}s</p>
              <Button size="sm" variant="ghost" onClick={() => qr.refetch()} loading={qr.isFetching}><RefreshCw className="h-4 w-4" aria-hidden />Refresh now</Button>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 text-gold" aria-hidden />The code holds no personal details.</p>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={Flame} label="Streak" value={att.data?.stats.streak ?? '—'} loading={att.isLoading} />
            <StatCard label="This month" value={att.data?.stats.thisMonth ?? '—'} loading={att.isLoading} />
            <StatCard label="Last 12 months" value={att.data?.stats.total ?? '—'} loading={att.isLoading} />
          </div>
          <DataTable caption="Attendance history" rows={att.data?.records} loading={att.isLoading} error={att.error} onRetry={att.refetch} empty={{ title: 'No visits yet', message: 'Your check-ins will appear here.' }}
            columns={[
              { key: 'day', header: 'Date', render: (r) => formatDate(`${r.day}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) },
              { key: 'in', header: 'In', render: (r) => formatDate(r.checkInAt, { hour: 'numeric', minute: '2-digit' }) },
              { key: 'out', header: 'Out', render: (r) => (r.checkOutAt ? formatDate(r.checkOutAt, { hour: 'numeric', minute: '2-digit' }) : '—') },
              { key: 'dur', header: 'Duration', render: (r) => (r.checkOutAt ? `${Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000)} min` : '—') },
            ]} />
        </div>
      </div>
    </>
  );
}
