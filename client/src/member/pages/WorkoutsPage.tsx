import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, CalendarRange, ClipboardList, Dumbbell, Plus } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { PlanDays, WorkoutLogForm, WorkoutLogList } from '../components/Workout';
import { refName, type WorkoutLog, type WorkoutPlan } from '../components/types';
import { plural } from '../components/utils';

const PLANS_KEY = ['member', 'workout-plans'];
const LOGS_KEY = ['member', 'workout-logs'];

export default function WorkoutsPage() {
  const [params, setParams] = useSearchParams();
  const plans = useQuery({ queryKey: PLANS_KEY, queryFn: () => api.get<WorkoutPlan[]>('/workouts/plans') });
  const logs = useQuery({ queryKey: LOGS_KEY, queryFn: () => api.get<WorkoutLog[]>('/members/me/workout-logs') });
  const sorted = [...(plans.data ?? [])].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const [selected, setSelected] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [initial, setInitial] = useState<{ planId: string; dayIndex: number } | null>(null);
  const plan = sorted.find((p) => p._id === selected) ?? sorted[0];

  useEffect(() => {
    if (params.get('log') && plans.data) {
      setInitial(plan ? { planId: plan._id, dayIndex: 0 } : null);
      setLogOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, plans.data, plan, setParams]);

  const thisWeek = (logs.data ?? []).filter((l) => Date.now() - new Date(l.performedAt).getTime() < 7 * 86400000).length;
  const activePlans = sorted.filter((p) => p.status === 'active');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Training"
        title="Workouts"
        description="Your coach-designed programme and everything you’ve logged."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => (setInitial(plan ? { planId: plan._id, dayIndex: 0 } : null), setLogOpen(true))}>
            Log workout
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'This week', value: logs.data ? thisWeek : '–', icon: Activity },
          { label: 'Logged total', value: logs.data ? logs.data.length : '–', icon: ClipboardList },
          { label: 'Active plans', value: plans.data ? activePlans.length : '–', icon: Dumbbell },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      ) : plans.isLoading ? (
        <Skeleton className="h-80" />
      ) : !plan ? (
        <EmptyState
          icon={<Dumbbell className="h-5 w-5" />}
          title="No workout plan yet"
          description="Plans are written by your coach after an assessment. Meanwhile, you can still log your own sessions."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/member/personal-training">Book a coach</ButtonLink>
              <Button variant="secondary" onClick={() => (setInitial(null), setLogOpen(true))}>
                Log a free session
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                {plan.title}
                <Badge tone={plan.status === 'active' ? 'success' : 'neutral'}>{plan.status}</Badge>
              </span>
            }
            description={
              <>
                {plural(plan.days.length, 'training day')} · by {refName(plan.trainer as { name: string }, 'your coach')}
                {plan.startDate && (
                  <span className="ml-1 inline-flex items-center gap-1">
                    · <CalendarRange className="h-3.5 w-3.5" /> {fmtDate(plan.startDate)}
                    {plan.endDate && ` → ${fmtDate(plan.endDate)}`}
                  </span>
                )}
              </>
            }
          />
          {sorted.length > 1 && (
            <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-line/70 px-5 py-3">
              {sorted.map((p) => (
                <button key={p._id} onClick={() => setSelected(p._id)} className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium transition', p._id === plan._id ? 'bg-primary text-on-primary' : 'bg-fg/[0.05] text-muted hover:text-fg')}>
                  {p.title}
                  {p.status === 'archived' && ' (archived)'}
                </button>
              ))}
            </div>
          )}
          <CardBody>
            {plan.description && <p className="mb-4 text-sm text-muted">{plan.description}</p>}
            <PlanDays key={plan._id} days={plan.days} onLogDay={(dayIndex) => (setInitial({ planId: plan._id, dayIndex }), setLogOpen(true))} />
          </CardBody>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Training history</h2>
        {logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
        ) : logs.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <WorkoutLogList
            logs={logs.data ?? []}
            empty={<EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No workouts logged yet" description="Log each session to track volume and progressive overload over time." />}
          />
        )}
      </section>

      <WorkoutLogForm open={logOpen} onClose={() => setLogOpen(false)} memberPath="/members/me" plans={activePlans} initial={initial} invalidate={[LOGS_KEY, ['member', 'dashboard']]} />
    </div>
  );
}
