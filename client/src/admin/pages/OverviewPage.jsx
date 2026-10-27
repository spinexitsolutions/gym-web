import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, IndianRupee, CalendarCheck, Clock, AlertCircle, Inbox, LifeBuoy, RotateCcw } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { api } from '../../services/api.js';
import { PageHeader, StatCard, Card, ChartCard } from '../../components/dashboard/Widgets.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatPaise, formatDate } from '../../utils/format.js';
import { chartColors, rupeesShort, tooltipStyle } from '../../utils/chart.js';

const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

export default function OverviewPage() {
  const o = useQuery({ queryKey: ['reports', 'overview'], queryFn: async () => (await api.get('/reports/overview')).data, refetchInterval: 120_000 });
  const rev = useQuery({ queryKey: ['reports', 'revenue', 12], queryFn: async () => (await api.get('/reports/revenue?months=12')).data });
  const growth = useQuery({ queryKey: ['reports', 'growth'], queryFn: async () => (await api.get('/reports/growth?months=12')).data });
  const c = chartColors();
  const tt = tooltipStyle();
  const d = o.data;

  if (o.isError) return <ErrorState message={o.error.message} onRetry={o.refetch} />;
  return (
    <>
      <Seo title="Admin overview" noindex />
      <PageHeader eyebrow="Dashboard" title="Club overview" description={d ? `Live figures · updated ${formatDate(d.generatedAt, { hour: 'numeric', minute: '2-digit' })}` : 'Live figures from your database'} />

      {d && (d.inbox.newInquiries > 0 || d.inbox.openTickets > 0 || d.payments.refundRequests > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {d.inbox.newInquiries > 0 && <Link to="/admin/inquiries?status=new" className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold"><Inbox className="h-4 w-4" aria-hidden />{d.inbox.newInquiries} new {d.inbox.newInquiries === 1 ? 'inquiry' : 'inquiries'}</Link>}
          {d.inbox.openTickets > 0 && <Link to="/admin/support?status=open" className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold"><LifeBuoy className="h-4 w-4" aria-hidden />{d.inbox.openTickets} open {d.inbox.openTickets === 1 ? 'ticket' : 'tickets'}</Link>}
          {d.payments.refundRequests > 0 && <Link to="/admin/payments?status=refund_requested" className="flex items-center gap-2 rounded-full border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger"><RotateCcw className="h-4 w-4" aria-hidden />{d.payments.refundRequests} refund {d.payments.refundRequests === 1 ? 'request' : 'requests'}</Link>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={o.isLoading} icon={Users} label="Registered members" value={d?.members.total.toLocaleString('en-IN')} hint={d && `${d.members.newLast30Days} new in the last 30 days`} />
        <StatCard loading={o.isLoading} icon={UserCheck} label="Active memberships" value={d?.members.active.toLocaleString('en-IN')} hint={d && `${d.members.expired} expired · ${d.members.neverPurchased} never purchased`} />
        <StatCard loading={o.isLoading} icon={IndianRupee} label="Revenue this month" value={d && formatPaise(d.revenue.monthPaise)} hint={d && `${d.revenue.monthPayments} payments · ${formatPaise(d.revenue.yearPaise)} this year`} />
        <StatCard loading={o.isLoading} icon={CalendarCheck} label="Check-ins today" value={d?.attendance.today} hint={d && `${d.attendance.month} this month`} />
      </div>
      {d?.payments.pendingCount > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted"><AlertCircle className="h-4 w-4 text-gold" aria-hidden />{d.payments.pendingCount} payments ({formatPaise(d.payments.pendingPaise)}) awaiting bank confirmation.</p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue — last 12 months" actions={<Link to="/admin/reports" className="text-xs text-gold hover:underline">Reports</Link>}>
          {rev.data && (
            <ResponsiveContainer>
              <AreaChart data={rev.data.series} margin={{ left: 0, right: 8, top: 8 }}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.accent} stopOpacity={0.45} /><stop offset="100%" stopColor={c.accent} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={rupeesShort} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={56} />
                <Tooltip {...tt} formatter={(v, n) => [formatPaise(v), n === 'netPaise' ? 'Net revenue' : 'Refunded']} labelFormatter={monthLabel} />
                <Area type="monotone" dataKey="netPaise" stroke={c.accent} strokeWidth={2} fill="url(#rev)" />
                <Area type="monotone" dataKey="refundedPaise" stroke={c.danger} strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Membership growth">
          {growth.data && (
            <ResponsiveContainer>
              <BarChart data={growth.data} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...tt} labelFormatter={monthLabel} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="newMemberships" name="New memberships" stackId="a" fill={c.accent} radius={[0, 0, 0, 0]} />
                <Bar dataKey="renewals" name="Renewals" stackId="a" fill={c.soft} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Upcoming renewals (14 days)" className="xl:col-span-2" padded={false} actions={<Link to="/admin/memberships?expiringInDays=14" className="text-xs text-gold hover:underline">View all</Link>}>
          {d?.upcomingRenewals.length ? (
            <ul className="divide-y divide-line/5">
              {d.upcomingRenewals.map((m) => (
                <li key={m._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div><Link to={`/admin/members/${m.user?._id}`} className="font-medium hover:text-gold">{m.user?.name}</Link><p className="text-xs text-muted">{m.plan?.name} · {m.user?.phone || m.user?.email}</p></div>
                  <span className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{formatDate(m.endDate)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-5 text-sm text-muted">{o.isLoading ? 'Loading…' : 'No memberships expire in the next 14 days.'}</p>}
        </Card>
        <Card title="Trainer performance (this month)" padded={false}>
          {d?.trainerPerformance.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="px-5 py-2 font-medium">Trainer</th><th className="py-2 font-medium">Booked</th><th className="py-2 font-medium">Done</th><th className="pr-5 py-2 font-medium">Rating</th></tr></thead>
              <tbody>
                {d.trainerPerformance.map((t) => (
                  <tr key={t._id} className="border-t border-line/5"><td className="px-5 py-2.5">{t.trainer?.name}</td><td>{t.booked}</td><td>{t.completed}{t.noShow ? <span className="text-xs text-danger"> ({t.noShow} no-show)</span> : null}</td><td className="pr-5">{t.trainer?.rating?.count ? `${t.trainer.rating.average}★` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-5 text-sm text-muted">No personal training sessions booked this month yet.</p>}
        </Card>
      </div>

      <Card title="Recent admin activity" className="mt-6" padded={false} actions={<Link to="/admin/audit" className="text-xs text-gold hover:underline">Audit log</Link>}>
        {d?.recentActivity.length ? (
          <ul className="divide-y divide-line/5">
            {d.recentActivity.map((a) => (
              <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-medium">{a.actor?.name || 'System'}</span> <span className="text-muted">{a.action.replace(/[._]/g, ' ')}</span>{a.summary && <span className="text-muted"> — {a.summary}</span>}</span>
                <span className="text-xs text-muted">{formatDate(a.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-5 text-sm text-muted">No activity yet.</p>}
      </Card>
    </>
  );
}
