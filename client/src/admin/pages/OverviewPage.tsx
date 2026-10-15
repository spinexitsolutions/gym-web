import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, CalendarDays, CalendarPlus, CreditCard, Hourglass, IndianRupee, ScanLine, Sparkles, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Avatar, ButtonLink, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, fmtWeekday, money, relativeTime } from '@/lib/format';
import { CapacityBar, PaymentsStatusBanner } from '../components/Bits';
import { ChartCard, axisProps, chart, fillDaily, moneyAxis, moneyTooltip, periodLabel, tooltipProps } from '../components/ChartCard';
import { OfflinePaymentModal } from '../components/OfflinePaymentModal';
import type { CountRow, Overview, RevenueRow } from '../components/types';
import { addDaysLocal } from '../components/utils';

function StatGrid({ o }: { o: Overview }) {
  const ic = 'h-4 w-4';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <StatCard label="Active members" value={o.activeMembers} hint={`of ${o.totalMembers} total members`} icon={<Users className={ic} />} tone="primary" />
      <StatCard label="Revenue this month" value={money(o.revenueThisMonthMinor)} hint={`${money(o.revenue30dMinor)} in the last 30 days`} icon={<IndianRupee className={ic} />} />
      <StatCard label="Expiring soon" value={o.expiringIn7Days} hint={`${o.expiringIn14Days} within 14 days`} icon={<Hourglass className={ic} />} tone={o.expiringIn7Days ? 'warning' : 'neutral'} />
      <StatCard label="New registrations" value={o.newRegistrations30d} hint="Last 30 days" icon={<UserPlus className={ic} />} />
      <StatCard label="Check-ins today" value={o.attendanceToday} icon={<ScanLine className={ic} />} />
      <StatCard label="Trial requests" value={o.pendingTrials} hint="Awaiting confirmation" icon={<Sparkles className={ic} />} tone={o.pendingTrials ? 'warning' : 'neutral'} />
      <StatCard label="Payments" value={`${o.pendingPayments} / ${o.failedPayments7d}`} hint="Pending / failed (7d)" icon={<CreditCard className={ic} />} tone={o.failedPayments7d ? 'danger' : 'neutral'} />
      <StatCard label="Refunds (30d)" value={money(o.refunds30dMinor)} hint={`${o.expiredMemberships} expired memberships on record`} icon={<AlertTriangle className={ic} />} />
    </div>
  );
}

function QuickActions({ onPayment }: { onPayment: () => void }) {
  const { can } = useAuth();
  const items = [
    can('payments:write') && { key: 'pay', label: 'Record payment', icon: CreditCard, onClick: onPayment },
    can('members:write') && { key: 'member', label: 'Add member', icon: UserPlus, to: '/admin/members?new=1' },
    can('classes:write') && { key: 'class', label: 'Create class', icon: CalendarPlus, to: '/admin/classes?new=1' },
    can('attendance:write') && { key: 'checkin', label: 'Check-in', icon: ScanLine, to: '/admin/check-in' },
  ].filter(Boolean) as { key: string; label: string; icon: typeof CreditCard; to?: string; onClick?: () => void }[];
  if (!items.length) return null;
  return (
    <>
      {items.map((i) =>
        i.to ? (
          <ButtonLink key={i.key} to={i.to} variant="secondary" icon={<i.icon className="h-4 w-4" />} className="flex-row-reverse">
            {i.label}
          </ButtonLink>
        ) : (
          <Button key={i.key} icon={<i.icon className="h-4 w-4" />} onClick={i.onClick}>
            {i.label}
          </Button>
        ),
      )}
    </>
  );
}

export default function OverviewPage() {
  const [payOpen, setPayOpen] = useState(false);
  const { can } = useAuth();
  const range = useMemo(() => {
    const to = new Date();
    const from = addDaysLocal(new Date(), -29);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }, []);
  const q = { from: range.from.toISOString(), to: range.to.toISOString(), interval: 'day' };
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<Overview>('/reports/overview'), refetchInterval: 60_000 });
  const revenue = useQuery({ queryKey: ['admin', 'reports', 'revenue', 'overview', q.from.slice(0, 10)], queryFn: () => api.get<RevenueRow[]>('/reports/revenue', q) });
  const regs = useQuery({ queryKey: ['admin', 'reports', 'registrations', 'overview', q.from.slice(0, 10)], queryFn: () => api.get<CountRow[]>('/reports/registrations', q) });

  const revenueSeries = useMemo(() => fillDaily(revenue.data ?? [], range.from, range.to, (period) => ({ period, grossMinor: 0, refundsMinor: 0, netMinor: 0, onlineMinor: 0, offlineMinor: 0, payments: 0 })), [revenue.data, range]);
  const regSeries = useMemo(() => fillDaily(regs.data ?? [], range.from, range.to, (period) => ({ period, count: 0 })), [regs.data, range]);
  const revTotal = revenueSeries.reduce((s, r) => s + r.netMinor, 0);
  const regTotal = regSeries.reduce((s, r) => s + r.count, 0);
  const o = overview.data;

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Overview" description={`Live snapshot of the club${o ? ` · ${o.timezone}` : ''}. Updates every minute.`} actions={<QuickActions onPayment={() => setPayOpen(true)} />} />
      <PaymentsStatusBanner className="mb-5" />

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : !o ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px]" />
          ))}
        </div>
      ) : (
        <StatGrid o={o} />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Net revenue · 30 days"
          description={revenue.data ? `${money(revTotal)} collected after refunds` : 'Daily captured payments minus refunds'}
          isLoading={revenue.isLoading}
          error={revenue.error}
          onRetry={() => revenue.refetch()}
          height={220}
          action={can('reports:read') ? <ButtonLink to="/admin/reports" variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Reports</ButtonLink> : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chart.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={periodLabel} {...axisProps} minTickGap={24} />
              <YAxis tickFormatter={moneyAxis} width={52} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(l) => periodLabel(String(l))} formatter={(v: number) => [moneyTooltip(v), 'Net']} />
              <Area type="monotone" dataKey="netMinor" stroke={chart.primary} strokeWidth={2} fill="url(#ov-rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard className="lg:col-span-2" title="Registrations · 30 days" description={regs.data ? `${regTotal} new members` : 'New member accounts per day'} isLoading={regs.isLoading} error={regs.error} onRetry={() => regs.refetch()} height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={periodLabel} {...axisProps} minTickGap={24} />
              <YAxis allowDecimals={false} width={40} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(l) => periodLabel(String(l))} formatter={(v: number) => [v, 'Registrations']} />
              <Bar dataKey="count" fill={chart.accent} radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Upcoming classes" description="Next 7 days" action={can('classes:write') ? <ButtonLink to="/admin/classes" variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Schedule</ButtonLink> : undefined} />
          {!o ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : o.upcomingClasses.length === 0 ? (
            <EmptyState className="m-5" icon={<CalendarDays className="h-5 w-5" />} title="No classes this week" description="Publish a schedule so members can book." action={can('classes:write') ? <ButtonLink to="/admin/classes?new=1" size="sm">Create class</ButtonLink> : undefined} />
          ) : (
            <ul className="divide-y divide-line/70">
              {o.upcomingClasses.map((c) => (
                <li key={c._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <div className="w-24 shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted">{fmtWeekday(c.startsAt)}</p>
                    <p className="font-display text-sm font-semibold tabular-nums">{fmtTime(c.startsAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted">
                      {c.trainer?.name ?? 'No trainer'}
                      {c.location ? ` · ${c.location}` : ''}
                    </p>
                  </div>
                  <CapacityBar booked={c.bookedCount} capacity={c.capacity} waitlist={c.waitlistCount} className="w-32" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent signups" action={can('members:read') ? <ButtonLink to="/admin/members" variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Members</ButtonLink> : undefined} />
          {!o ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : o.recentSignups.length === 0 ? (
            <EmptyState className="m-5" icon={<UserPlus className="h-5 w-5" />} title="No members yet" description="New registrations appear here." />
          ) : (
            <ul className="divide-y divide-line/70">
              {o.recentSignups.map((u) => (
                <li key={u._id}>
                  <Link to={`/admin/members/${u._id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-fg/[0.03] focus-visible:bg-fg/[0.04]">
                    <Avatar name={u.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" description="Latest staff actions from the audit log" action={can('audit:read') ? <ButtonLink to="/admin/audit" variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>Audit log</ButtonLink> : undefined} />
        {!o ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : o.recentActivity.length === 0 ? (
          <EmptyState className="m-5" icon={<Activity className="h-5 w-5" />} title="No activity yet" description="Changes made by staff (payments, memberships, settings) are recorded here." />
        ) : (
          <ol className="divide-y divide-line/70">
            {o.recentActivity.map((a) => (
              <li key={a._id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', /refund|cancel|suspend|delete|archive/.test(a.action) ? 'bg-danger' : /create|grant|payment/.test(a.action) ? 'bg-primary' : 'bg-muted')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-fg">
                    <span className="font-medium">{a.actorName ?? 'System'}</span> <span className="text-muted">·</span> <code className="text-xs text-muted">{a.action}</code>
                  </p>
                  {a.summary && <p className="truncate text-xs text-muted">{a.summary}</p>}
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={a.createdAt} title={fmtDate(a.createdAt)}>
                  {relativeTime(a.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <OfflinePaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
