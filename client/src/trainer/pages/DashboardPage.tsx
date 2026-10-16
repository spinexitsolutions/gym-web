import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlarmClock, CalendarDays, ClipboardList, NotebookPen, ScanLine, UserRound, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Badge, ButtonLink, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtTime, relativeTime, titleCase } from '@/lib/format';
import type { Booking } from '@/types/api';
import { DateTile } from '@/member/components/BookingRow';
import { Metric, MiniEmpty, Panel } from '@/member/components/Panel';
import { ProgressBar } from '@/member/components/ProgressRing';
import type { GymClassDoc, TrainerNote } from '@/member/components/types';
import { refName } from '@/member/components/types';
import { firstName, greeting } from '@/member/components/utils';

interface Overview {
  assignedCount: number;
  upcomingClasses: GymClassDoc[];
  upcomingSessions: (Booking & { user?: { _id: string; name: string } })[];
  followUps: TrainerNote[];
}

export default function TrainerDashboardPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['trainer', 'overview'], queryFn: () => api.get<Overview>('/trainers/me/overview') });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const overdue = d?.followUps.filter((n) => n.followUpAt && new Date(n.followUpAt) < new Date()).length ?? 0;
  const booked = d?.upcomingClasses.reduce((a, c) => a + c.bookedCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {greeting()}, <span className="text-gradient">Coach {firstName(user?.name)}</span>
          </h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <ButtonLink to="/trainer/check-in" className="flex-1 sm:flex-none" icon={<ScanLine className="h-4 w-4" />}>
            Check in member
          </ButtonLink>
          <ButtonLink to="/trainer/workouts?new=1" variant="secondary" className="flex-1 sm:flex-none" icon={<ClipboardList className="h-4 w-4" />}>
            New plan
          </ButtonLink>
        </div>
      </motion.header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!d ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Metric label="My members" value={d.assignedCount} hint="Assigned to you" icon={<Users className="h-4 w-4" />} to="/trainer/members" />
            <Metric label="Classes · 7 days" value={d.upcomingClasses.length} hint={`${booked} spots booked`} icon={<CalendarDays className="h-4 w-4" />} to="/trainer/schedule" delay={0.04} />
            <Metric label="1:1 sessions" value={d.upcomingSessions.length} hint="Upcoming PT & trials" icon={<UserRound className="h-4 w-4" />} to="/trainer/schedule" delay={0.08} />
            <Metric label="Follow-ups" value={d.followUps.length} hint={overdue ? `${overdue} overdue` : 'Due within 7 days'} icon={<AlarmClock className="h-4 w-4" />} to="/trainer/notes" delay={0.12} />
          </>
        )}
      </div>

      {!d ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Upcoming classes" icon={<CalendarDays className="h-4 w-4" />} href="/trainer/schedule" linkLabel="Schedule">
            {d.upcomingClasses.length ? (
              <ul className="divide-y divide-line/60">
                {d.upcomingClasses.slice(0, 6).map((c) => (
                  <li key={c._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <DateTile date={c.startsAt} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="text-xs text-muted">
                        {fmtTime(c.startsAt)} · {c.location || 'Studio'} · {titleCase(c.level)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar value={c.bookedCount / c.capacity} className="max-w-[140px]" label="Booked" />
                        <span className="text-xs tabular-nums text-muted">
                          {c.bookedCount}/{c.capacity}
                          {c.waitlistCount ? ` · ${c.waitlistCount} waitlist` : ''}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <MiniEmpty icon={<CalendarDays className="h-6 w-6" />}>No classes on your schedule this week.</MiniEmpty>
            )}
          </Panel>

          <Panel title="1:1 sessions" icon={<UserRound className="h-4 w-4" />} href="/trainer/schedule" linkLabel="Schedule" delay={0.05}>
            {d.upcomingSessions.length ? (
              <ul className="divide-y divide-line/60">
                {d.upcomingSessions.slice(0, 6).map((s) => (
                  <li key={s._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <DateTile date={s.startsAt} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.user && typeof s.user === 'object' ? s.user.name : (s.guest?.name ?? 'Guest')}</p>
                      <p className="text-xs text-muted">
                        {fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}
                      </p>
                      {s.notes && <p className="mt-0.5 truncate text-xs text-muted">“{s.notes}”</p>}
                    </div>
                    <Badge tone={s.type === 'trial' ? 'info' : 'primary'}>{s.type === 'trial' ? 'Trial' : 'PT'}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <MiniEmpty icon={<UserRound className="h-6 w-6" />} action={<ButtonLink to="/trainer/profile" size="sm" variant="secondary">Update availability</ButtonLink>}>
                No 1:1 sessions booked. Members book from your open availability.
              </MiniEmpty>
            )}
          </Panel>

          <Panel title="Follow-ups due" icon={<AlarmClock className="h-4 w-4" />} href="/trainer/notes" delay={0.1}>
            {d.followUps.length ? (
              <ul className="space-y-2">
                {d.followUps.map((n) => {
                  const late = n.followUpAt && new Date(n.followUpAt) < new Date();
                  return (
                    <li key={n._id}>
                      <Link to={`/trainer/members/${typeof n.member === 'object' ? n.member._id : n.member}`} className={`block rounded-xl border p-3 transition hover:border-primary/40 ${late ? 'border-danger/40 bg-danger/5' : 'border-line'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{refName(n.member as { name: string })}</p>
                          <span className={`text-xs ${late ? 'text-danger' : 'text-muted'}`}>{n.followUpAt ? relativeTime(n.followUpAt) : ''}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <MiniEmpty icon={<NotebookPen className="h-6 w-6" />}>No follow-ups due this week. Nice and tidy.</MiniEmpty>
            )}
          </Panel>

          <Panel title="Quick actions" icon={<ClipboardList className="h-4 w-4" />} delay={0.15}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/trainer/members', label: 'My members', icon: Users },
                { to: '/trainer/workouts', label: 'Workout plans', icon: ClipboardList },
                { to: '/trainer/notes', label: 'Notes', icon: NotebookPen },
                { to: '/trainer/check-in', label: 'Check-in', icon: ScanLine },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-fg/[0.02] p-4 transition hover:border-primary/40 hover:bg-primary/5">
                  <a.icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
