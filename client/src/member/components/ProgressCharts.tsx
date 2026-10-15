import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineIcon } from 'lucide-react';
import { EmptyState, Tabs } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { ProgressEntry } from './types';

const C = {
  primary: 'rgb(var(--c-primary))',
  accent: 'rgb(var(--c-accent))',
  secondary: 'rgb(var(--c-secondary))',
  success: 'rgb(var(--c-success))',
  warning: 'rgb(var(--c-warning))',
  muted: 'rgb(var(--c-muted))',
  grid: 'rgb(var(--c-text) / 0.07)',
};

type MetricKey = 'weight' | 'bodyFat' | 'measurements';
const MEASURES = [
  { key: 'chestCm', label: 'Chest', color: C.primary },
  { key: 'waistCm', label: 'Waist', color: C.warning },
  { key: 'hipsCm', label: 'Hips', color: C.success },
  { key: 'armCm', label: 'Arm', color: C.secondary },
  { key: 'thighCm', label: 'Thigh', color: C.accent },
] as const;

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 text-muted">{label ? fmtDate(label) : ''}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular-nums">{p.value}</span> {unit}
        </p>
      ))}
    </div>
  );
}

const axisProps = { stroke: C.muted, fontSize: 11, tickLine: false, axisLine: false } as const;

/** Weight / body-fat / measurement trends. Entries may be in any order. */
export function ProgressCharts({ entries, height = 260 }: { entries: ProgressEntry[]; height?: number }) {
  const [metric, setMetric] = useState<MetricKey>('weight');
  const gid = useId().replace(/:/g, '');
  const sorted = useMemo(() => [...entries].sort((a, b) => +new Date(a.date) - +new Date(b.date)), [entries]);
  const data = useMemo(
    () =>
      sorted.map((e) => ({
        date: e.date,
        weight: e.weightKg ?? null,
        bodyFat: e.bodyFatPct ?? null,
        ...Object.fromEntries(MEASURES.map((m) => [m.key, e.measurements?.[m.key] || null])),
      })),
    [sorted],
  );
  const has = {
    weight: data.filter((d) => d.weight != null).length,
    bodyFat: data.filter((d) => d.bodyFat != null).length,
    measurements: data.filter((d) => MEASURES.some((m) => (d as Record<string, unknown>)[m.key] != null)).length,
  };
  const activeMeasures = MEASURES.filter((m) => data.some((d) => (d as Record<string, unknown>)[m.key] != null));

  const tabs = (
    <Tabs<MetricKey>
      className="mb-4 w-fit"
      value={metric}
      onChange={setMetric}
      tabs={[
        { value: 'weight', label: 'Weight', count: has.weight },
        { value: 'bodyFat', label: 'Body fat', count: has.bodyFat },
        { value: 'measurements', label: 'Measurements', count: has.measurements },
      ]}
    />
  );

  if (has[metric] === 0) {
    return (
      <div>
        {tabs}
        <EmptyState icon={<LineIcon className="h-5 w-5" />} title="No data to chart yet" description={metric === 'weight' ? 'Log your weight to see your trend line.' : metric === 'bodyFat' ? 'Add a body-fat reading to chart it.' : 'Add tape measurements (chest, waist, hips…) to chart them.'} />
      </div>
    );
  }

  return (
    <div>
      {tabs}
      <div style={{ height }} className="-ml-3">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'measurements' ? (
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: 'numeric', month: 'short' })} {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={40} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<ChartTooltip unit="cm" />} />
              {activeMeasures.map((m) => (
                <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={{ r: 3, fill: m.color }} connectNulls />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: 'numeric', month: 'short' })} {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={40} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => String(Math.round(v * 10) / 10)} />
              <Tooltip content={<ChartTooltip unit={metric === 'weight' ? 'kg' : '%'} />} />
              <Area type="monotone" dataKey={metric} name={metric === 'weight' ? 'Weight' : 'Body fat'} stroke={C.primary} strokeWidth={2.5} fill={`url(#g-${gid})`} dot={{ r: 3, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      {metric === 'measurements' && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {activeMeasures.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} /> {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small weight sparkline for dashboards. */
export function WeightSparkline({ entries, height = 80 }: { entries: ProgressEntry[]; height?: number }) {
  const gid = useId().replace(/:/g, '');
  const data = [...entries].filter((e) => e.weightKg != null).sort((a, b) => +new Date(a.date) - +new Date(b.date)).map((e) => ({ date: e.date, weight: e.weightKg }));
  if (data.length < 2) return null;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`s-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip content={<ChartTooltip unit="kg" />} />
          <XAxis dataKey="date" hide />
          <Area type="monotone" dataKey="weight" name="Weight" stroke={C.primary} strokeWidth={2} fill={`url(#s-${gid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
