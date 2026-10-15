import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Bell, CalendarCheck, CalendarPlus, Copy, CreditCard, Dumbbell, Flame, Gift, LineChart, QrCode, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Badge, ButtonLink, ErrorState, Skeleton, StatusBadge, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, money, relativeTime } from '@/lib/format';
import { BookingRow } from '../components/BookingRow';
import { GoalItem } from '../components/Goals';
import { MembershipCard } from '../components/MembershipCard';
import { Metric, MiniEmpty, Panel } from '../components/Panel';
import { WeightSparkline } from '../components/ProgressCharts';
import type { MemberDashboard } from '../components/types';
import { firstName, greeting, plural } from '../components/utils';

const DASHBOARD_KEY = ['member', 'dashboard'] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useQuery({ queryKey: DASHBOARD_KEY, queryFn: () => api.get<MemberDashboard>('/members/me/dashboard') });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  const weights = (d?.progress ?? []).filter((p) => p.weightKg != null);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const delta = latest && first && weights.length > 1 ? Math.round((latest.weightKg! - first.weightKg!) * 10) / 10 : null;
  const latestBf = [...(d?.progress ?? [])].reverse().find((p) => p.bodyFatPct != null)?.bodyFatPct;
  const activeGoals = (d?.goals ?? []).filter((g) => g.status === 'active');

  const copyCode = async () => {
    if (!d?.referralCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${d.referralCode}`);
      toast.success('Invite link copied', 'Share it with a friend — you earn points when they join.');
    } catch {
      toast.error('Couldn’t copy', `Your code is ${d.referralCode}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {greeting()}, <span className="text-gradient">{firstName(user?.name)}</span>
          </h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <ButtonLink to="/member/book" className="flex-1 sm:flex-none" icon={<CalendarPlus className="h-4 w-4" />}>
            Book a class
          </ButtonLink>
          <ButtonLink to="/member/attendance" variant="secondary" className="flex-1 sm:flex-none" icon={<QrCode className="h-4 w-4" />}>
            Check-in QR
          </ButtonLink>
        </div>
      </motion.header>

      {!d ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <MembershipCard
          membership={d.membership}
          upcoming={d.upcomingMembership}
          actions={
            d.membership && (
              <>
                {!d.upcomingMembership && (
                  <ButtonLink to={`/member/checkout/${d.membership.plan}`} size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Renew
                  </ButtonLink>
                )}
                <ButtonLink to="/member/membership#plans" variant="secondary" size="sm">
                  Upgrade
                </ButtonLink>
                <ButtonLink to="/member/membership" variant="ghost" size="sm">
                  Details
                </ButtonLink>
              </>
            )
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!d ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Metric label="Check-ins · 30d" value={d.attendanceLast30Days} hint={d.attendanceLast30Days ? `~${(d.attendanceLast30Days / 4.3).toFixed(1)} per week` : 'Scan your QR at the desk'} icon={<Flame className="h-4 w-4" />} to="/member/attendance" delay={0.02} />
            <Metric label="Reward points" value={d.loyaltyPoints.toLocaleString('en-IN')} hint="Earned from check-ins & referrals" icon={<Gift className="h-4 w-4" />} to="/member/rewards" delay={0.05} />
            <Metric label="Unread" value={d.unreadNotifications} hint={d.unreadNotifications ? 'New updates waiting' : 'You’re all caught up'} icon={<Bell className="h-4 w-4" />} to="/member/notifications" delay={0.08} />
            <Metric
              label="Last payment"
              value={d.lastPayment ? money(d.lastPayment.amountMinor) : '—'}
              hint={d.lastPayment ? `${d.lastPayment.planName} · ${fmtDate(d.lastPayment.capturedAt)}` : 'No online payments yet'}
              icon={<CreditCard className="h-4 w-4" />}
              to="/member/payments"
              delay={0.11}
            />
          </>
        )}
      </div>

      {!d ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Up next" icon={<CalendarCheck className="h-4 w-4" />} href="/member/bookings" className="lg:col-span-2" delay={0.05}>
            {d.nextBookings.length ? (
              <ul className="divide-y divide-line/60">
                {d.nextBookings.map((b) => (
                  <li key={b._id} className="py-3 first:pt-0 last:pb-0">
                    <BookingRow booking={b} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <MiniEmpty
                icon={<CalendarPlus className="h-6 w-6" />}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <ButtonLink to="/member/book" size="sm">
                      Browse classes
                    </ButtonLink>
                    <ButtonLink to="/member/personal-training" size="sm" variant="secondary">
                      Book a coach
                    </ButtonLink>
                  </div>
                }
              >
                Nothing booked yet. Lock in your next session — members who plan ahead train twice as often.
              </MiniEmpty>
            )}
          </Panel>

          <Panel title="Progress" icon={<LineChart className="h-4 w-4" />} href="/member/progress" delay={0.08}>
            {latest ? (
              <div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="font-display text-3xl font-semibold tabular-nums">
                      {latest.weightKg}
                      <span className="ml-1 text-base font-normal text-muted">kg</span>
                    </p>
                    <p className="text-xs text-muted">Logged {relativeTime(latest.date)}</p>
                  </div>
                  {delta != null && delta !== 0 && (
                    <Badge tone="neutral">
                      {delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      {delta > 0 ? '+' : ''}
                      {delta} kg
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <WeightSparkline entries={d.progress} />
                </div>
                {weights.length < 2 && <p className="mt-2 text-xs text-muted">Log one more weigh-in to start your trend line.</p>}
              </div>
            ) : (
              <MiniEmpty icon={<LineChart className="h-6 w-6" />} action={<ButtonLink to="/member/progress" size="sm" variant="secondary">Log your first check-in</ButtonLink>}>
                Track weight, body fat and measurements to see your trend.
              </MiniEmpty>
            )}
          </Panel>

          <Panel title="Your training plan" icon={<Dumbbell className="h-4 w-4" />} href="/member/workouts" linkLabel="Open" className="lg:col-span-2" delay={0.1}>
            {d.workoutPlan ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold">{d.workoutPlan.title}</p>
                    <p className="text-xs text-muted">
                      {plural(d.workoutPlan.days.length, 'training day')}
                      {typeof d.workoutPlan.trainer === 'object' && ` · by ${d.workoutPlan.trainer.name}`}
                    </p>
                  </div>
                  <ButtonLink to="/member/workouts?log=1" size="sm" variant="secondary">
                    Log workout
                  </ButtonLink>
                </div>
                <div className="scrollbar-thin -mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                  {d.workoutPlan.days.map((day, i) => (
                    <Link key={i} to="/member/workouts" className="w-44 shrink-0 rounded-2xl border border-line bg-fg/[0.02] p-3 transition hover:border-primary/40">
                      <p className="text-sm font-semibold">{day.name}</p>
                      {day.focus && <p className="text-xs text-primary">{day.focus}</p>}
                      <ul className="mt-2 space-y-0.5 text-xs text-muted">
                        {day.exercises.slice(0, 3).map((ex, j) => (
                          <li key={j} className="truncate">
                            {ex.name} · {ex.sets}×{ex.reps}
                          </li>
                        ))}
                        {day.exercises.length > 3 && <li>+{day.exercises.length - 3} more</li>}
                      </ul>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <MiniEmpty icon={<Dumbbell className="h-6 w-6" />} action={<ButtonLink to="/member/personal-training" size="sm" variant="secondary">Book a session with a coach</ButtonLink>}>
                No plan assigned yet. Your coach will build one after your first assessment.
              </MiniEmpty>
            )}
          </Panel>

          <Panel title="Goals" icon={<Target className="h-4 w-4" />} href="/member/progress#goals" linkLabel="Manage" delay={0.12}>
            {activeGoals.length ? (
              <div className="space-y-2.5">
                {activeGoals.slice(0, 3).map((g) => (
                  <GoalItem key={g._id} goal={g} ctx={{ weightKg: latest?.weightKg, bodyFatPct: latestBf, attendance30: d.attendanceLast30Days }} />
                ))}
              </div>
            ) : (
              <MiniEmpty icon={<Target className="h-6 w-6" />} action={<ButtonLink to="/member/progress#goals" size="sm" variant="secondary">Set a goal</ButtonLink>}>
                A clear target keeps you showing up.
              </MiniEmpty>
            )}
          </Panel>

          <Panel title="Recent check-ins" icon={<QrCode className="h-4 w-4" />} href="/member/attendance" delay={0.14}>
            {d.recentAttendance.length ? (
              <ul className="space-y-2">
                {d.recentAttendance.map((a) => (
                  <li key={a._id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{fmtDate(a.checkInAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="text-xs text-muted">{a.gymClass && typeof a.gymClass === 'object' ? a.gymClass.title : a.method === 'qr' ? 'QR check-in' : 'Front desk'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <MiniEmpty icon={<QrCode className="h-6 w-6" />}>No visits yet. Show your QR code at the front desk to check in.</MiniEmpty>
            )}
          </Panel>

          <Panel title="Invite a friend" icon={<Gift className="h-4 w-4" />} href="/member/rewards" linkLabel="Rewards" delay={0.16}>
            {d.referralCode ? (
              <div>
                <p className="text-sm text-muted">Share your code — you earn bonus points when a friend joins and pays.</p>
                <button type="button" onClick={copyCode} className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10">
                  <span className="font-mono text-lg font-semibold tracking-[0.2em] text-primary">{d.referralCode}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </span>
                </button>
              </div>
            ) : (
              <MiniEmpty>Your referral code will appear here.</MiniEmpty>
            )}
          </Panel>

          <Panel title="Billing" icon={<CreditCard className="h-4 w-4" />} href="/member/payments" delay={0.18}>
            {d.lastPayment ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.lastPayment.planName}</span>
                  <StatusBadge status={d.lastPayment.status} />
                </div>
                <p className="font-display text-2xl font-semibold tabular-nums">{money(d.lastPayment.amountMinor)}</p>
                <p className="text-xs text-muted">
                  {fmtDate(d.lastPayment.capturedAt)} · {d.lastPayment.receiptNumber}
                </p>
              </div>
            ) : (
              <MiniEmpty icon={<CreditCard className="h-6 w-6" />}>No payments recorded yet.</MiniEmpty>
            )}
            {d.upcomingMembership && (
              <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-xs text-success">
                {d.upcomingMembership.planName} queued from {fmtDate(d.upcomingMembership.startDate)} <ArrowUpRight className="inline h-3 w-3" />
              </p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
