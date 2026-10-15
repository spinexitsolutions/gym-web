import type { ReactNode } from 'react';
import { CalendarClock, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { ProgressBar } from './ProgressRing';
import type { Goal } from './types';

export interface GoalContext {
  weightKg?: number | null;
  bodyFatPct?: number | null;
  attendance30?: number;
}

/** Current value for metric-backed goals. */
export function goalCurrent(g: Goal, ctx: GoalContext): number | null {
  if (g.metric === 'weight') return ctx.weightKg ?? null;
  if (g.metric === 'bodyFat') return ctx.bodyFatPct ?? null;
  if (g.metric === 'attendance') return ctx.attendance30 ?? null;
  return null;
}

/** 0..1 progress from start → target (works for increasing and decreasing targets). */
export function goalProgress(g: Goal, current: number | null): number | null {
  if (g.status === 'achieved') return 1;
  if (current == null || g.targetValue == null) return null;
  const start = g.startValue ?? (g.metric === 'attendance' ? 0 : null);
  if (start == null || start === g.targetValue) return current === g.targetValue ? 1 : null;
  return Math.max(0, Math.min(1, (current - start) / (g.targetValue - start)));
}

const unitFor = (g: Goal) => g.unit || (g.metric === 'weight' ? 'kg' : g.metric === 'bodyFat' ? '%' : g.metric === 'attendance' ? 'visits' : '');

export function GoalItem({ goal, ctx, actions }: { goal: Goal; ctx: GoalContext; actions?: ReactNode }) {
  const current = goalCurrent(goal, ctx);
  const p = goalProgress(goal, current);
  const unit = unitFor(goal);
  const overdue = goal.deadline && goal.status === 'active' && new Date(goal.deadline) < new Date();
  return (
    <div className="rounded-2xl border border-line/80 bg-fg/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {goal.status === 'achieved' && <Trophy className="h-4 w-4 text-primary" />}
            <span className="truncate">{goal.title}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {goal.startValue != null && `${goal.startValue} ${unit} → `}
            {goal.targetValue != null ? `${goal.targetValue} ${unit}` : 'No numeric target'}
            {current != null && goal.status === 'active' && ` · now ${Math.round(current * 10) / 10} ${unit}`}
            {goal.metric === 'attendance' && ' (last 30 days)'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {goal.status !== 'active' && <Badge tone={goal.status === 'achieved' ? 'success' : 'neutral'}>{goal.status}</Badge>}
          {actions}
        </div>
      </div>
      {p != null && (
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={p} tone={goal.status === 'achieved' || p >= 1 ? 'success' : 'primary'} label={`${goal.title} progress`} />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{Math.round(p * 100)}%</span>
        </div>
      )}
      {goal.deadline && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${overdue ? 'text-warning' : 'text-muted'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {overdue ? 'Was due' : 'Due'} {fmtDate(goal.deadline)}
        </p>
      )}
    </div>
  );
}
