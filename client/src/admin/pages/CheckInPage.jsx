import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogOut, XCircle, Download, Pencil } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, Card, ChartCard, StatCard, SearchInput } from '../../components/dashboard/Widgets.jsx';
import { QrScanner } from '../../components/dashboard/QrScanner.jsx';
import { DataTable } from '../../components/dashboard/DataTable.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Field, Textarea } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';
import { formatDate } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';
import { chartColors, tooltipStyle } from '../../utils/chart.js';
import { cn } from '../../utils/cn.js';

const time = (d) => (d ? formatDate(d, { hour: 'numeric', minute: '2-digit' }) : '—');
const pad = (n) => String(n).padStart(2, '0');
const local = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };

function Result({ result }) {
  if (!result) return <div className="grid h-full min-h-48 place-items-center rounded-brand border border-dashed border-line/15 p-6 text-center text-sm text-muted">Scan a member’s QR code or search below.</div>;
  if (result.error) {
    return (
      <div role="alert" className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-brand border border-danger/40 bg-danger/10 p-6 text-center">
        <XCircle className="h-12 w-12 text-danger" aria-hidden />
        <p className="text-lg font-semibold">Entry not allowed</p>
        <p className="text-sm">{result.error}</p>
      </div>
    );
  }
  const d = result.data;
  const isIn = d.action === 'check_in';
  return (
    <div role="status" className={cn('flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-brand border p-6 text-center', isIn ? 'border-success/40 bg-success/10' : 'border-gold/40 bg-gold/10')}>
      <span className="h-20 w-20 overflow-hidden rounded-full border-2 border-white/30 bg-elevated">{d.member.avatar?.url ? <Img image={d.member.avatar} alt="" sizes="80px" className="h-full w-full" /> : <span className="grid h-full place-items-center font-display text-3xl text-gold">{d.member.name[0]}</span>}</span>
      <p className="flex items-center gap-2 text-xl font-semibold">{isIn ? <CheckCircle2 className="h-6 w-6 text-success" aria-hidden /> : <LogOut className="h-6 w-6 text-gold" aria-hidden />}{d.member.name} {isIn ? 'checked in' : 'checked out'}</p>
      <p className="text-sm text-muted">{d.membership.plan} · {d.membership.daysLeft} days left</p>
      {d.membership.daysLeft <= 7 && <p className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">Membership ends soon — remind them to renew</p>}
    </div>
  );
}

function ManualSearch({ onPick }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const res = useQuery({ queryKey: ['members-search', dq], queryFn: async () => (await api.get(`/members?q=${encodeURIComponent(dq)}&limit=6&membership=active`)).data, enabled: dq.length >= 2 });
  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder="Find active member by name, email or phone" className="sm:max-w-none" label="Find member" />
      {res.data?.length > 0 && (
        <ul className="mt-2 divide-y divide-line/5 rounded-brand border border-line/10">
          {res.data.map((m) => (
            <li key={m._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>{m.name}<span className="block text-xs text-muted">{m.phone || m.email} · {m.membership?.plan?.name}</span></span>
              <Button size="sm" variant="outline" onClick={() => { onPick(m._id); setQ(''); }}>Check in / out</Button>
            </li>
          ))}
        </ul>
      )}
      {dq.length >= 2 && res.data?.length === 0 && <p className="mt-2 text-sm text-muted">No active members match.</p>}
    </div>
  );
}

function CorrectModal({ record, onClose, onDone }) {
  const toast = useToast();
  const [inAt, setIn] = useState(local(record.checkInAt));
  const [outAt, setOut] = useState(record.checkOutAt ? local(record.checkOutAt) : '');
  const [reason, setReason] = useState('');
  const save = async () => {
    try {
      onDone((await api.patch(`/attendance/${record._id}`, { checkInAt: new Date(inAt).toISOString(), checkOutAt: outAt ? new Date(outAt).toISOString() : null, reason })).message);
    } catch (err) { toast.error(err); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={`Correct attendance — ${record.member?.name}`} description="Corrections are kept with the record and in the audit log."
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save}>Save correction</Button></>}>
      <div className="space-y-4">
        <Field label="Check-in">{(a) => <input {...a} type="datetime-local" className="input" value={inAt} onChange={(e) => setIn(e.target.value)} />}</Field>
        <Field label="Check-out">{(a) => <input {...a} type="datetime-local" className="input" value={outAt} onChange={(e) => setOut(e.target.value)} />}</Field>
        <Field label="Reason" required>{(a) => <Textarea {...a} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

export default function CheckInPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const canReport = ['owner', 'admin', 'staff'].includes(user.role);
  const today = useQuery({ queryKey: ['/attendance', 'today'], queryFn: async () => (await api.get('/attendance?limit=200')).data, refetchInterval: 30_000 });
  const report = useQuery({ queryKey: ['/attendance', 'report', month], queryFn: async () => (await api.get(`/attendance/report?month=${month}`)).data, enabled: canReport });
  const c = chartColors();

  const handle = useCallback(async (promise) => {
    setBusy(true);
    try {
      const res = await promise;
      setResult({ data: res.data });
      qc.invalidateQueries({ queryKey: ['/attendance'] });
    } catch (err) {
      setResult({ error: err.message });
    } finally { setBusy(false); }
  }, [qc]);
  const onScan = useCallback((token) => handle(api.post('/attendance/scan', { token })), [handle]);

  const columns = [
    { key: 'member', header: 'Member', render: (r) => r.member?.name },
    { key: 'checkInAt', header: 'In', render: (r) => time(r.checkInAt) },
    { key: 'checkOutAt', header: 'Out', render: (r) => time(r.checkOutAt) },
    { key: 'method', header: 'Method', hideOnMobile: true, render: (r) => <span className="capitalize">{r.method}{r.corrections?.length ? ' · corrected' : ''}</span> },
    ...(canReport ? [{ key: '_a', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => <button type="button" onClick={() => setCorrecting(r)} className="rounded-full p-2 text-muted hover:text-gold" aria-label={`Correct ${r.member?.name}`}><Pencil className="h-4 w-4" /></button> }] : []),
  ];

  return (
    <>
      <Seo title="Check-in" noindex />
      <PageHeader title="Front desk check-in" description="Scan member QR codes (they refresh every minute and contain no personal data). A second scan checks the member out." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Scanner"><QrScanner onScan={onScan} paused={busy} /></Card>
        <Card title="Result"><Result result={result} /></Card>
      </div>
      <Card title="Manual check-in" className="mt-6"><ManualSearch onPick={(memberId) => handle(api.post('/attendance/manual', { memberId }))} /></Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Visits today" value={today.data?.length ?? '—'} loading={today.isLoading} />
        <StatCard label="In the club now" value={today.data ? today.data.filter((a) => !a.checkOutAt).length : '—'} loading={today.isLoading} />
        {canReport && <StatCard label={`Unique members in ${month}`} value={report.data?.uniqueMembers ?? '—'} loading={report.isLoading} />}
      </div>
      <h2 className="mb-3 mt-8 font-sans text-lg font-semibold">Today</h2>
      <DataTable caption="Today's attendance" columns={columns} rows={today.data} loading={today.isLoading} error={today.error} onRetry={today.refetch} empty={{ title: 'No check-ins yet today' }} />

      {canReport && (
        <>
          <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-sans text-lg font-semibold">Monthly report</h2>
            <div className="flex items-center gap-2">
              <input type="month" aria-label="Month" className="input h-10 w-auto py-2" value={month} onChange={(e) => setMonth(e.target.value)} />
              <Button size="sm" variant="outline" href={apiUrl(`/attendance/export.csv?from=${month}-01&to=${month}-31`)} download><Download className="h-4 w-4" aria-hidden />CSV</Button>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title={`Daily visits · ${report.data?.total ?? 0} total · avg ${report.data?.averagePerDay ?? 0}/day`}>
              {report.data && (
                <ResponsiveContainer>
                  <BarChart data={report.data.daily}><CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={32} />
                    <Tooltip {...tooltipStyle()} /><Bar dataKey="visits" fill={c.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Peak hours">
              {report.data && (
                <ResponsiveContainer>
                  <BarChart data={report.data.byHour}><CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={32} />
                    <Tooltip {...tooltipStyle()} labelFormatter={(h) => `${h}:00 – ${h}:59`} /><Bar dataKey="visits" fill={c.soft} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
      {correcting && <CorrectModal record={correcting} onClose={() => setCorrecting(null)} onDone={(m) => { toast.success(m); setCorrecting(null); qc.invalidateQueries({ queryKey: ['/attendance'] }); }} />}
    </>
  );
}
