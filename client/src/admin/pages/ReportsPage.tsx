import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { money, titleCase as titleCaseSafe } from '@/lib/format';
import { ChartCard, Legend, axisProps, chart, moneyAxis, moneyTooltip, periodLabel, tooltipProps } from '../components/ChartCard';
import { DateRangePicker, presetRange, type DateRange } from '../components/DateRangePicker';
import { ExportButton } from '../components/FilterBar';
import type { BookingSummary, CountRow, PlanPerfRow, RevenueRow } from '../components/types';
import { endOfDayIso, startOfDayIso } from '../components/utils';

type Interval = 'day' | 'week' | 'month';

const STATUS_COLORS: Record<string, string> = {
  active: chart.primary,
  upcoming: chart.accent,
  expired: chart.muted,
  cancelled: chart.danger,
  upgraded: chart.secondary,
  refunded: chart.warning,
};

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(presetRange(90));
  const [interval, setIntervalKey] = useState<Interval>('week');
  const q = useMemo(() => ({ from: startOfDayIso(range.from), to: endOfDayIso(range.to), interval }), [range, interval]);
  const key = [q.from, q.to, interval];
  const regs = useQuery({ queryKey: ['admin', 'reports', 'registrations', ...key], queryFn: () => api.get<CountRow[]>('/reports/registrations', q) });
  const rev = useQuery({ queryKey: ['admin', 'reports', 'revenue', ...key], queryFn: () => api.get<RevenueRow[]>('/reports/revenue', q) });
  const plans = useQuery({ queryKey: ['admin', 'reports', 'plans', ...key], queryFn: () => api.get<PlanPerfRow[]>('/reports/plans', q) });
  const ms = useQuery({ queryKey: ['admin', 'reports', 'memberships'], queryFn: () => api.get<{ status: string; count: number }[]>('/reports/memberships') });
  const bk = useQuery({ queryKey: ['admin', 'reports', 'bookings', ...key], queryFn: () => api.get<BookingSummary>('/reports/bookings', q) });

  const revTotals = useMemo(() => (rev.data ?? []).reduce((a, r) => ({ gross: a.gross + r.grossMinor, refunds: a.refunds + r.refundsMinor, net: a.net + r.netMinor, online: a.online + r.onlineMinor, offline: a.offline + r.offlineMinor, n: a.n + r.payments }), { gross: 0, refunds: 0, net: 0, online: 0, offline: 0, n: 0 }), [rev.data]);
  const regTotal = (regs.data ?? []).reduce((s, r) => s + r.count, 0);
  const checkIns = (bk.data?.attendance ?? []).reduce((s, r) => s + r.count, 0);
  const msTotal = (ms.data ?? []).reduce((s, r) => s + r.count, 0);
  const bookingTable = useMemo(() => {
    const types = ['class', 'personal_training', 'trial'];
    const statuses = ['pending', 'confirmed', 'waitlisted', 'attended', 'no_show', 'cancelled'];
    const get = (t: string, s: string) => bk.data?.byStatus.find((x) => x.type === t && x.status === s)?.count ?? 0;
    return { types, statuses, get };
  }, [bk.data]);
  const csv = { from: q.from, to: q.to, interval };

  return (
    <div>
      <PageHeader eyebrow="Revenue" title="Reports" description="Growth, revenue, plan performance and attendance. All figures come straight from payments, memberships and check-ins." />
      <Card className="mb-6 flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
        <DateRangePicker value={range} onChange={setRange} />
        <fieldset>
          <legend className="label">Group by</legend>
          <div className="flex gap-1 rounded-full border border-line bg-fg/[0.03] p-1" role="group">
            {(['day', 'week', 'month'] as const).map((i) => (
              <button key={i} type="button" aria-pressed={interval === i} onClick={() => setIntervalKey(i)} className={`rounded-full px-3 py-1 text-sm font-medium transition ${interval === i ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg'}`}>
                {titleCaseSafe(i)}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net revenue" value={rev.data ? money(revTotals.net) : '—'} hint={rev.data ? `${money(revTotals.gross)} gross · ${money(revTotals.refunds)} refunded` : undefined} tone="primary" />
        <StatCard label="Payments" value={rev.data ? revTotals.n : '—'} hint={rev.data && revTotals.n ? `avg ${money(Math.round(revTotals.gross / revTotals.n))}` : undefined} />
        <StatCard label="New members" value={regs.data ? regTotal : '—'} />
        <StatCard label="Check-ins" value={bk.data ? checkIns : '—'} hint={bk.data ? `${bk.data.classes.sessions} classes · ${bk.data.classes.fillRate}% filled` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue"
          description={rev.data ? `Online ${money(revTotals.online)} · Offline ${money(revTotals.offline)} · Refunds ${money(revTotals.refunds)}` : 'Captured payments by period'}
          isLoading={rev.isLoading}
          error={rev.error}
          onRetry={() => rev.refetch()}
          isEmpty={!rev.data?.length}
          height={300}
          action={<ExportButton path="/reports/revenue" query={csv} filename="revenue.csv" size="sm" />}
          footer={
            <div className="border-t border-line/70 px-5 py-3">
              <Legend
                items={[
                  { label: 'Online', color: chart.primary },
                  { label: 'Offline', color: chart.accent },
                  { label: 'Refunds', color: chart.danger },
                  { label: 'Net', color: chart.text },
                ]}
              />
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rev.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={periodLabel} {...axisProps} minTickGap={20} />
              <YAxis tickFormatter={moneyAxis} width={56} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(l) => periodLabel(String(l))} formatter={(v: number, n: string) => [moneyTooltip(v), n]} />
              <Bar dataKey="onlineMinor" name="Online" stackId="r" fill={chart.primary} maxBarSize={36} />
              <Bar dataKey="offlineMinor" name="Offline" stackId="r" fill={chart.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="refundsMinor" name="Refunds" fill={chart.danger} radius={[4, 4, 0, 0]} maxBarSize={12} />
              <Line type="monotone" dataKey="netMinor" name="Net" stroke={chart.text} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Registrations" description={regs.data ? `${regTotal} new member accounts` : undefined} isLoading={regs.isLoading} error={regs.error} onRetry={() => regs.refetch()} isEmpty={!regs.data?.length} action={<ExportButton path="/reports/registrations" query={csv} filename="registrations.csv" size="sm" />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regs.data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={periodLabel} {...axisProps} minTickGap={20} />
              <YAxis allowDecimals={false} width={40} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(l) => periodLabel(String(l))} formatter={(v: number) => [v, 'Registrations']} />
              <Bar dataKey="count" fill={chart.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Membership status" description={ms.data ? `${msTotal} memberships on record (all time)` : undefined} isLoading={ms.isLoading} error={ms.error} onRetry={() => ms.refetch()} isEmpty={!msTotal}>
          <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
            <div className="h-full min-h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...tooltipProps} formatter={(v: number, n: string) => [v, titleCaseSafe(n)]} />
                  <Pie data={ms.data} dataKey="count" nameKey="status" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
                    {(ms.data ?? []).map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? chart.secondary} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2 sm:w-1/2">
              {(ms.data ?? [])
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <li key={s.status} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? chart.secondary }} aria-hidden />
                    <span className="flex-1">{titleCaseSafe(s.status)}</span>
                    <span className="tabular-nums font-medium">{s.count}</span>
                    <span className="w-12 text-right text-xs tabular-nums text-muted">{msTotal ? Math.round((s.count / msTotal) * 100) : 0}%</span>
                  </li>
                ))}
            </ul>
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Plan performance"
          description="Sales and net revenue per plan in the period; active memberships today."
          isLoading={plans.isLoading}
          error={plans.error}
          onRetry={() => plans.refetch()}
          isEmpty={!plans.data?.length}
          height={Math.max(160, (plans.data?.length ?? 0) * 44)}
          action={<ExportButton path="/reports/plans" query={csv} filename="plan-performance.csv" size="sm" />}
          footer={
            plans.data?.length ? (
              <div className="scrollbar-thin overflow-x-auto border-t border-line/70">
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">Plan performance</caption>
                  <thead className="text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">Plan</th>
                      <th className="px-5 py-2.5 text-right font-medium">Sales</th>
                      <th className="px-5 py-2.5 text-right font-medium">Net revenue</th>
                      <th className="px-5 py-2.5 text-right font-medium">Share</th>
                      <th className="px-5 py-2.5 text-right font-medium">Active now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {plans.data.map((p) => {
                      const total = plans.data.reduce((s, x) => s + x.revenueMinor, 0);
                      return (
                        <tr key={p.planId}>
                          <td className="px-5 py-2.5">{p.planName}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">{p.sales}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">{money(p.revenueMinor)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted">{total ? Math.round((p.revenueMinor / total) * 100) : 0}%</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">{p.activeMemberships}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plans.data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid horizontal={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={moneyAxis} {...axisProps} />
              <YAxis type="category" dataKey="planName" width={150} {...axisProps} tick={{ fill: chart.text, fontSize: 12 }} />
              <Tooltip {...tooltipProps} formatter={(v: number) => [moneyTooltip(v), 'Net revenue']} />
              <Bar dataKey="revenueMinor" fill={chart.primary} radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Check-ins" description={bk.data ? `${checkIns} gym visits` : undefined} isLoading={bk.isLoading} error={bk.error} onRetry={() => bk.refetch()} isEmpty={!bk.data?.attendance.length} action={<ExportButton path="/reports/bookings" query={csv} filename="attendance.csv" size="sm" />}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bk.data?.attendance} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="rp-att" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chart.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={periodLabel} {...axisProps} minTickGap={20} />
              <YAxis allowDecimals={false} width={40} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(l) => periodLabel(String(l))} formatter={(v: number) => [v, 'Check-ins']} />
              <Area type="monotone" dataKey="count" stroke={chart.accent} strokeWidth={2} fill="url(#rp-att)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold">Bookings</h3>
              <p className="mt-0.5 text-sm text-muted">By type and outcome, for sessions in the period.</p>
            </div>
            {bk.data && (
              <div className="text-right">
                <p className="font-display text-2xl font-semibold tabular-nums text-primary">{bk.data.classes.fillRate}%</p>
                <p className="text-xs text-muted">class fill rate · {bk.data.classes.sessions} sessions</p>
              </div>
            )}
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Bookings by type and status</caption>
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Type</th>
                  {bookingTable.statuses.map((s) => (
                    <th key={s} className="px-3 py-2.5 text-right font-medium">
                      {titleCaseSafe(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {bookingTable.types.map((t) => (
                  <tr key={t}>
                    <td className="px-5 py-2.5">{titleCaseSafe(t)}</td>
                    {bookingTable.statuses.map((s) => {
                      const n = bookingTable.get(t, s);
                      return (
                        <td key={s} className={`px-3 py-2.5 text-right tabular-nums ${n ? '' : 'text-muted/60'}`}>
                          {bk.isLoading ? '…' : n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bk.data && bk.data.byStatus.length === 0 && <p className="px-5 pb-4 text-sm text-muted">No bookings in this period.</p>}
        </Card>
      </div>
    </div>
  );
}
