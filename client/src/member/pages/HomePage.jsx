import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QrCode, CalendarPlus, Flame, TrendingUp, Bell, Crown, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyMembership } from './MembershipPage.jsx';
import { Card, StatCard } from '../../components/dashboard/Widgets.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/States.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { chartColors, tooltipStyle } from '../../utils/chart.js';
import { cn } from '../../utils/cn.js';

export default function MemberHome() {
  const { user } = useAuth();
  const m = useMyMembership();
  const bookings = useQuery({ queryKey: ['bookings', 'me'], queryFn: async () => (await api.get('/bookings/me')).data });
  const att = useQuery({ queryKey: ['attendance', 'me'], queryFn: async () => (await api.get('/attendance/me')).data });
  const progress = useQuery({ queryKey: ['progress'], queryFn: async () => (await api.get('/workouts/progress')).data });
  const notes = useQuery({ queryKey: ['notifications', 'home'], queryFn: async () => (await api.get('/notifications?limit=5')).data });
  const c = chartColors();
  const current = m.data?.current;
  const weights = (progress.data || []).filter((p) => p.weightKg).slice(-12).map((p) => ({ date: p.date.slice(5, 10), weight: p.weightKg }));
  const hour = new Date().getHours();

  return (
    <>
      <Seo title="Dashboard" noindex />
      <div className="mb-8">
        <p className="eyebrow">{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{user.name.split(' ')[0]}, ready to train?</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className={cn('rounded-brand border p-6 xl:col-span-2', current ? 'border-gold/40 bg-gradient-to-br from-gold/15 via-surface to-surface' : 'border-line/10 bg-surface')}>
          {m.isLoading ? <Skeleton className="h-32" /> : current ? (
            <div className="flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Crown className="h-4 w-4 text-gold" aria-hidden />Membership</p>
                <p className="mt-3 font-display text-4xl font-semibold">{current.plan.name}</p>
                <p className="mt-1 text-sm text-muted">Valid until {formatDate(current.endDate)} · <span className={m.data.daysLeft <= 7 ? 'text-danger' : ''}>{m.data.daysLeft} days left</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button to="/dashboard/check-in" size="sm"><QrCode className="h-4 w-4" aria-hidden />Check-in QR</Button>
                {m.data.daysLeft <= 14 && !m.data.upcoming.length && <Button to="/dashboard/membership?renew=1" size="sm" variant="outline">Renew</Button>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-display text-2xl font-semibold">Start your membership</p><p className="mt-1 text-sm text-muted">Unlock the gym floor, classes, bookings and QR check-in.</p></div>
              <Button to="/dashboard/membership" size="sm">Choose a plan</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
          <StatCard icon={Flame} label="Current streak" value={att.data ? `${att.data.stats.streak} day${att.data.stats.streak === 1 ? '' : 's'}` : '—'} loading={att.isLoading} hint={att.data?.stats.checkedInToday ? 'Checked in today ✓' : undefined} />
          <StatCard icon={TrendingUp} label="Visits this month" value={att.data?.stats.thisMonth ?? '—'} loading={att.isLoading} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Upcoming sessions" className="xl:col-span-2" padded={false} actions={<Link to="/dashboard/book" className="flex items-center gap-1 text-xs text-gold hover:underline"><CalendarPlus className="h-3.5 w-3.5" aria-hidden />Book</Link>}>
          {bookings.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : bookings.data?.upcoming.length ? (
            <ul className="divide-y divide-line/5">
              {bookings.data.upcoming.slice(0, 5).map((b) => (
                <li key={b._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div><p className="font-medium">{b.type === 'class' ? b.classSchedule?.title : `Personal training · ${b.trainer?.name}`}</p><p className="text-xs text-muted">{formatDate(b.startAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p></div>
                  {b.status === 'waitlisted' && <span className="text-xs text-gold">Waitlist #{b.waitlistPosition}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="p-5 text-sm text-muted">No sessions booked. <Link to="/dashboard/book" className="text-gold hover:underline">Book a class or PT session</Link>.</p>}
        </Card>
        <Card title="Notifications" padded={false} actions={<Link to="/dashboard/notifications" className="text-xs text-gold hover:underline">All</Link>}>
          {notes.data?.length ? (
            <ul className="divide-y divide-line/5">{notes.data.map((n) => (
              <li key={n._id} className="px-5 py-3 text-sm"><p className={cn('font-medium', !n.readAt && 'text-gold')}>{n.title}</p>{n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}</li>
            ))}</ul>
          ) : <p className="flex items-center gap-2 p-5 text-sm text-muted"><Bell className="h-4 w-4" aria-hidden />Nothing new.</p>}
        </Card>
      </div>

      <Card title="Weight trend" className="mt-6" actions={<Link to="/dashboard/progress" className="flex items-center gap-1 text-xs text-gold hover:underline">Log progress<ArrowRight className="h-3 w-3" aria-hidden /></Link>}>
        {weights.length >= 2 ? (
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={weights}><XAxis dataKey="date" stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} /><YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tooltipStyle()} formatter={(v) => [`${v} kg`, 'Weight']} /><Line type="monotone" dataKey="weight" stroke={c.accent} strokeWidth={2.5} dot={{ r: 3, fill: c.accent }} /></LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-muted">Log your weight at least twice to see your trend.</p>}
      </Card>
    </>
  );
}
