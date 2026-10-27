import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Download, CheckCircle2, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useList } from '../../hooks/useList.js';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, StatusBadge, Card, ChartCard, FilterSelect, Toolbar, KeyValue, StatCard } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { TextField, FormAlert, applyServerErrors, Field, Select } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, formatPaise } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';
import { chartColors, rupeesShort, tooltipStyle } from '../../utils/chart.js';
import { usePlans } from '../../components/sections/Pricing.jsx';

const ROLE_HELP = {
  admin: 'Full access except managing other admins',
  staff: 'Front desk: members, check-in, bookings, payments, inquiries, support',
  trainer: 'Own schedule, assigned members, workout plans, check-in',
};

function InviteModal({ onClose, onDone, isOwner }) {
  const [error, setFormError] = useState('');
  const trainers = useQuery({ queryKey: ['options', 'trainers-unlinked'], queryFn: async () => (await api.get('/admin/trainers?limit=100')).data.filter((t) => !t.user) });
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { role: 'staff' } });
  const submit = async (v) => {
    try { onDone((await api.post('/admin/staff', { ...v, trainerId: v.trainerId || undefined })).message); } catch (err) { setFormError(applyServerErrors(err, setError)); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title="Invite a team member" description="They receive an email to set their password. Existing member accounts are upgraded."
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(submit)}>Send invite</Button></>}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <FormAlert>{error}</FormAlert>
        <TextField label="Full name" name="name" register={register} errors={errors} required />
        <TextField label="Email" name="email" type="email" register={register} errors={errors} required />
        <Field label="Role" hint={ROLE_HELP[watch('role')]}>{(a) => (
          <Select {...a} {...register('role')}>{isOwner && <option value="admin">Admin</option>}<option value="staff">Staff</option><option value="trainer">Trainer</option></Select>
        )}</Field>
        {watch('role') === 'trainer' && (
          <Field label="Link to trainer profile" hint="Connects their login to a public trainer profile">{(a) => (
            <Select {...a} {...register('trainerId')}><option value="">— Later —</option>{trainers.data?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</Select>
          )}</Field>
        )}
      </form>
    </Modal>
  );
}

export function StaffPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const q = useQuery({ queryKey: ['/admin/staff'], queryFn: async () => (await api.get('/admin/staff')).data });
  const update = async (s, patch) => {
    try { toast.success((await api.patch(`/admin/staff/${s.id}`, patch)).message); qc.invalidateQueries({ queryKey: ['/admin/staff'] }); } catch (err) { toast.error(err); }
  };
  const editable = (s) => s.id !== me.id && s.role !== 'owner' && (me.role === 'owner' || ['staff', 'trainer'].includes(s.role));
  const columns = [
    { key: 'name', header: 'Name', render: (r) => <div><p className="font-medium">{r.name}{r.id === me.id && <span className="text-xs text-muted"> (you)</span>}</p><p className="text-xs text-muted">{r.email}</p></div> },
    { key: 'role', header: 'Role', render: (r) => (editable(r) ? (
      <select aria-label={`Role for ${r.name}`} className="input h-9 w-auto py-1 text-xs" value={r.role} onChange={(e) => update(r, { role: e.target.value })}>
        {me.role === 'owner' && <option value="admin">admin</option>}<option value="staff">staff</option><option value="trainer">trainer</option><option value="member">remove access (member)</option>
      </select>
    ) : <span className="capitalize">{r.role}</span>) },
    { key: 'trainer', header: 'Trainer profile', hideOnMobile: true, render: (r) => r.trainer?.name || '—' },
    { key: 'lastLoginAt', header: 'Last login', hideOnMobile: true, render: (r) => (r.lastLoginAt ? formatDate(r.lastLoginAt) : 'Never') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: '_a', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => (editable(r) ? (
      <Button size="sm" variant="ghost" onClick={() => update(r, { status: r.status === 'active' ? 'suspended' : 'active' })}>{r.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>
    ) : null) },
  ];
  return (
    <>
      <Seo title="Team" noindex />
      <PageHeader title="Team & roles" description="Owner and admins manage the website and finances; staff run the front desk; trainers see their own clients."
        actions={<Button size="sm" onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" aria-hidden />Invite</Button>} />
      <DataTable caption="Team" columns={columns} rows={q.data} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={q.refetch} empty={{ title: 'No team members yet' }} />
      {inviting && <InviteModal isOwner={me.role === 'owner'} onClose={() => setInviting(false)} onDone={(m) => { toast.success(m); setInviting(false); qc.invalidateQueries({ queryKey: ['/admin/staff'] }); }} />}
    </>
  );
}

export function AuditPage() {
  const { rows, meta, query, params, set } = useList('/admin/audit', { defaults: { limit: 50 } });
  const columns = [
    { key: 'createdAt', header: 'When', render: (r) => formatDate(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) },
    { key: 'actor', header: 'Who', render: (r) => (r.actor ? <span>{r.actor.name}<span className="block text-xs capitalize text-muted">{r.actorRole}</span></span> : 'System') },
    { key: 'action', header: 'Action', render: (r) => <code className="text-xs">{r.action}</code> },
    { key: 'entity', header: 'Record', hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{r.entity}{r.entityId ? ` · ${r.entityId.slice(-6)}` : ''}</span> },
    { key: 'summary', header: 'Details', render: (r) => <span className="text-muted">{r.summary || (r.changes ? JSON.stringify(r.changes).slice(0, 120) : '—')}</span> },
    { key: 'ip', header: 'IP', hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{r.ip}</span> },
  ];
  return (
    <>
      <Seo title="Audit log" noindex />
      <PageHeader title="Audit log" description="Every administrative action, who did it and when. Passwords, tokens and secrets are never recorded." />
      <Toolbar>
        <FilterSelect label="Area" value={params.entity || ''} onChange={(v) => set({ entity: v })}
          options={[{ value: '', label: 'All areas' }, ...['User', 'Membership', 'Payment', 'Attendance', 'WebsiteSettings', 'MembershipPlan', 'Trainer', 'ClassSchedule', 'Booking', 'Coupon', 'Media', 'SupportTicket', 'ContactInquiry'].map((e) => ({ value: e, label: e }))]} />
      </Toolbar>
      <DataTable caption="Audit log" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} empty={{ title: 'No activity recorded' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
    </>
  );
}

const Check = ({ ok }) => (ok ? <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />Configured</span> : <span className="flex items-center gap-1.5 text-muted"><XCircle className="h-4 w-4" aria-hidden />Not configured</span>);

export function SystemPage() {
  const q = useQuery({ queryKey: ['admin', 'system'], queryFn: async () => (await api.get('/admin/system')).data, refetchInterval: 60_000 });
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const d = q.data;
  return (
    <>
      <Seo title="System status" noindex />
      <PageHeader title="System status" description="Integrations, background jobs and recent server errors." />
      {!d ? <Skeleton className="h-64" /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Integrations">
            <KeyValue items={[
              ['Database', <Check key="db" ok={d.integrations.database} />], ['Cloudinary (media)', <Check key="c" ok={d.integrations.cloudinary} />],
              ['SMTP email', <Check key="s" ok={d.integrations.smtp} />], ['Razorpay keys', <Check key="r" ok={d.integrations.razorpay} />],
              ['Razorpay webhook secret', <Check key="w" ok={d.integrations.webhookSecret} />], ['Web push', <Check key="p" ok={d.integrations.push} />],
              ['AI assistant', <Check key="a" ok={d.integrations.assistant} />],
              ['Active payment gateway', d.integrations.paymentProvider === 'sandbox' ? <span className="text-gold">Sandbox (test mode)</span> : d.integrations.paymentProvider || <span className="text-danger">None — online payments disabled</span>],
            ]} />
            <p className="mt-4 text-xs text-muted">Keys are set as environment variables on the server — see docs/INTEGRATIONS.md.</p>
          </Card>
          <Card title="Server">
            <KeyValue items={[['Environment', d.environment], ['Time zone', d.timezone], ['Uptime', `${Math.floor(d.uptimeSeconds / 3600)}h ${Math.floor((d.uptimeSeconds % 3600) / 60)}m`],
              d.database && ['Database size', `${d.database.dataSizeMB} MB data · ${d.database.collections} collections`]]} />
          </Card>
          <Card title="Background jobs" className="xl:col-span-2" padded={false}>
            {d.jobs.length ? (
              <ul className="divide-y divide-line/5 text-sm">{d.jobs.map((j) => (
                <li key={j.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="font-mono text-xs">{j.name}</span>
                  <span className="text-muted">{j.lastRunAt ? `Last run ${formatDate(j.lastRunAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not run yet'}</span>
                  {j.lastError ? <span className="text-danger">{j.lastError}</span> : <span className="text-xs text-muted">{j.lastResult ? JSON.stringify(j.lastResult) : ''}</span>}
                </li>
              ))}</ul>
            ) : <p className="p-5 text-sm text-muted">Jobs record their first run within an hour of the server starting.</p>}
          </Card>
          <Card title="Recent server errors" className="xl:col-span-2" padded={false}>
            {d.errors.length ? (
              <ul className="divide-y divide-line/5 text-sm">{d.errors.map((e) => (
                <li key={e._id} className="px-5 py-3">
                  <p><span className="font-mono text-xs">{e.method} {e.path}</span> <span className="text-xs text-muted">· {formatDate(e.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></p>
                  <p className="mt-1 text-danger">{e.message}</p>
                </li>
              ))}</ul>
            ) : <p className="p-5 text-sm text-muted">No server errors recorded. 🎉</p>}
          </Card>
        </div>
      )}
    </>
  );
}

export function ReportsPage() {
  const { data: plans } = usePlans();
  const c = chartColors();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: monthAgo, to: today, plan: '' });
  const daily = useQuery({ queryKey: ['reports', 'daily', range], queryFn: async () => (await api.get(`/reports/revenue/daily?from=${range.from}&to=${range.to}${range.plan ? `&plan=${range.plan}` : ''}`)).data });
  const byPlan = useQuery({ queryKey: ['reports', 'revenue', 12, 'plans'], queryFn: async () => (await api.get('/reports/revenue?months=12')).data.byPlan });
  const total = (daily.data || []).reduce((s, d) => s + d.totalPaise, 0);
  const subscribers = useList('/admin/newsletter', { key: 'newsletter' });
  const palette = [c.accent, c.soft, c.success, c.muted, c.danger];
  return (
    <>
      <Seo title="Reports" noindex />
      <PageHeader title="Reports & exports" description="Revenue by date and plan, plus CSV exports for your accountant." />
      <Toolbar>
        <label className="flex items-center gap-2 text-xs text-muted">From<input type="date" className="input h-10 w-auto py-2" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
        <label className="flex items-center gap-2 text-xs text-muted">To<input type="date" className="input h-10 w-auto py-2" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
        <FilterSelect label="Plan" value={range.plan} onChange={(plan) => setRange((r) => ({ ...r, plan }))} options={[{ value: '', label: 'All plans' }, ...(plans || []).map((p) => ({ value: p._id, label: p.name }))]} />
      </Toolbar>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue in range" value={formatPaise(total)} loading={daily.isLoading} />
        <StatCard label="Payments" value={(daily.data || []).reduce((s, d) => s + d.payments, 0)} loading={daily.isLoading} />
        <StatCard label="Average per day" value={formatPaise(daily.data?.length ? total / Math.max(1, (new Date(range.to) - new Date(range.from)) / 864e5 + 1) : 0)} loading={daily.isLoading} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard title="Daily revenue" className="xl:col-span-2">
          {daily.data && (
            <ResponsiveContainer>
              <BarChart data={daily.data}><CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={rupeesShort} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={56} />
                <Tooltip {...tooltipStyle()} formatter={(v) => [formatPaise(v), 'Revenue']} /><Bar dataKey="totalPaise" fill={c.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Revenue by plan (12 months)">
          {byPlan.data?.length ? (
            <ResponsiveContainer>
              <PieChart><Pie data={byPlan.data} dataKey="gross" nameKey="plan" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                {byPlan.data.map((p, i) => <Cell key={p.plan} fill={palette[i % palette.length]} />)}
              </Pie><Tooltip {...tooltipStyle()} formatter={(v, n) => [formatPaise(v), n]} /></PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted">No revenue yet.</p>}
        </ChartCard>
      </div>
      <Card title="CSV exports" className="mt-6">
        <div className="flex flex-wrap gap-3">
          <Button size="sm" variant="outline" href={apiUrl(`/payments/export.csv?from=${range.from}&to=${range.to}${range.plan ? `&plan=${range.plan}` : ''}`)} download><Download className="h-4 w-4" aria-hidden />Payments (range)</Button>
          <Button size="sm" variant="outline" href={apiUrl('/members/export.csv')} download><Download className="h-4 w-4" aria-hidden />All members</Button>
          <Button size="sm" variant="outline" href={apiUrl(`/attendance/export.csv?from=${range.from}&to=${range.to}`)} download><Download className="h-4 w-4" aria-hidden />Attendance (range)</Button>
          <Button size="sm" variant="outline" href={apiUrl(`/bookings/export.csv?from=${range.from}&to=${range.to}`)} download><Download className="h-4 w-4" aria-hidden />Bookings (range)</Button>
          <Button size="sm" variant="outline" href={apiUrl('/admin/newsletter.csv')} download><Download className="h-4 w-4" aria-hidden />Newsletter subscribers ({subscribers.meta?.total ?? 0})</Button>
        </div>
      </Card>
    </>
  );
}
