import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, CheckCircle2, ClipboardList, HeartPulse, Lock, NotebookPen, Plus, Scale } from 'lucide-react';
import { Alert, Avatar, Badge, Button, ButtonLink, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, KeyValue, Skeleton, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, relativeTime, titleCase } from '@/lib/format';
import { BookingRow } from '@/member/components/BookingRow';
import { GoalItem } from '@/member/components/Goals';
import { PhotoGrid } from '@/member/components/PhotoGrid';
import { ProgressCharts } from '@/member/components/ProgressCharts';
import { ProgressEntryForm } from '@/member/components/ProgressEntryForm';
import { PlanDays, WorkoutLogForm, WorkoutLogList } from '@/member/components/Workout';
import type { MemberDetail, ProgressEntry, ProgressPhoto, TrainerNote, WorkoutLog, WorkoutPlan } from '@/member/components/types';
import { toDateInput } from '@/member/components/utils';

type Tab = 'overview' | 'progress' | 'training' | 'notes';

export default function TrainerMemberDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<Tab>('overview');
  const detail = useQuery({ queryKey: ['trainer', 'member', id], queryFn: () => api.get<MemberDetail>(`/members/${id}`) });
  const progress = useQuery({ queryKey: ['trainer', 'member', id, 'progress'], queryFn: () => api.get<ProgressEntry[]>(`/members/${id}/progress`) });

  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} title="Member not available" />;
  const d = detail.data;
  const active = d?.memberships.find((m) => m.status === 'active');
  const latest = [...(progress.data ?? [])].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const latestW = latest.find((e) => e.weightKg != null);
  const latestBf = latest.find((e) => e.bodyFatPct != null);
  const age = d?.profile?.dateOfBirth ? Math.floor((Date.now() - +new Date(d.profile.dateOfBirth)) / (365.25 * 86400000)) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to="/trainer/members" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> My members
      </Link>
      {!d ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar name={d.user.name} src={d.user.avatarUrl || undefined} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold">{d.user.name}</h1>
            <p className="text-sm text-muted">
              {d.user.email}
              {d.user.phone && ` · ${d.user.phone}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {active ? (
                <Badge tone="success">
                  {active.planName} · {active.daysLeft}d left
                </Badge>
              ) : (
                <Badge tone="warning">No active membership</Badge>
              )}
              {d.profile?.fitnessLevel && <Badge>{titleCase(d.profile.fitnessLevel)}</Badge>}
              {age != null && <Badge>{age} yrs</Badge>}
              {d.profile?.heightCm && <Badge>{d.profile.heightCm} cm</Badge>}
            </div>
          </div>
        </div>
      )}

      <Tabs<Tab>
        className="w-fit max-w-full"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'progress', label: 'Progress' },
          { value: 'training', label: 'Training' },
          { value: 'notes', label: 'Notes' },
        ]}
      />

      {!d ? (
        <Skeleton className="h-64" />
      ) : tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <KeyValue
                items={[
                  { label: 'Gender', value: d.profile?.gender ? titleCase(d.profile.gender === 'prefer_not' ? 'not specified' : d.profile.gender) : '—' },
                  { label: 'Date of birth', value: fmtDate(d.profile?.dateOfBirth) },
                  { label: 'Latest weight', value: latestW ? `${latestW.weightKg} kg (${fmtDate(latestW.date)})` : '—' },
                  { label: 'Body fat', value: latestBf ? `${latestBf.bodyFatPct}%` : '—' },
                  { label: 'Emergency contact', value: d.profile?.emergencyContact?.name ? `${d.profile.emergencyContact.name} · ${d.profile.emergencyContact.phone ?? ''}` : '—' },
                  { label: 'Member since', value: fmtDate(d.user.createdAt) },
                ]}
              />
              {d.profile?.healthNotes ? (
                <Alert tone="warning" className="mt-4" title={<span className="inline-flex items-center gap-1.5"><HeartPulse className="h-4 w-4" /> Health notes (confidential)</span>}>
                  <p className="whitespace-pre-wrap">{d.profile.healthNotes}</p>
                </Alert>
              ) : (
                <p className="mt-4 text-xs text-muted">No health notes shared.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Goals" />
            <CardBody className="space-y-2.5">
              {d.profile?.goals.length ? (
                d.profile.goals.map((g) => <GoalItem key={g._id} goal={g} ctx={{ weightKg: latestW?.weightKg, bodyFatPct: latestBf?.bodyFatPct }} />)
              ) : (
                <p className="text-sm text-muted">This member hasn’t set any goals yet — a good topic for your next session.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent attendance" description={`${d.attendance.length} recent visits`} />
            <CardBody>
              {d.attendance.length ? (
                <ul className="space-y-1.5 text-sm">
                  {d.attendance.slice(0, 8).map((a) => (
                    <li key={a._id} className="flex justify-between gap-3">
                      <span>{fmtDate(a.checkInAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      <span className="text-xs text-muted">{a.method === 'class' ? 'Class' : a.method === 'qr' ? 'QR' : 'Desk'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No visits recorded yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Bookings" />
            <CardBody className="space-y-2">
              {d.bookings.length ? d.bookings.slice(0, 5).map((b) => <BookingRow key={b._id} booking={b} compact />) : <p className="text-sm text-muted">No bookings.</p>}
            </CardBody>
          </Card>
        </div>
      ) : tab === 'progress' ? (
        <ProgressTab memberId={id} entries={progress.data} loading={progress.isLoading} latestWeight={latestW?.weightKg} shared={Boolean(d.profile?.progressPhotosSharedWithTrainer)} />
      ) : tab === 'training' ? (
        <TrainingTab memberId={id} />
      ) : (
        <NotesTab memberId={id} />
      )}
    </div>
  );
}

function ProgressTab({ memberId, entries, loading, latestWeight, shared }: { memberId: string; entries?: ProgressEntry[]; loading: boolean; latestWeight?: number | null; shared: boolean }) {
  const [open, setOpen] = useState(false);
  const photos = useQuery({ queryKey: ['trainer', 'member', memberId, 'photos'], queryFn: () => api.get<ProgressPhoto[]>(`/members/${memberId}/photos`), enabled: shared });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Body metrics</span>}
          action={
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
              Record measurement
            </Button>
          }
        />
        <CardBody>{loading ? <Skeleton className="h-64" /> : <ProgressCharts entries={entries ?? []} />}</CardBody>
      </Card>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Progress photos</span>} />
        <CardBody>
          {!shared ? (
            <EmptyState icon={<Lock className="h-5 w-5" />} title="Photos are private" description="This member hasn’t chosen to share progress photos with you. They can enable sharing from their Progress page." />
          ) : photos.isError ? (
            <ErrorState error={photos.error} onRetry={() => photos.refetch()} />
          ) : photos.isLoading ? (
            <Skeleton className="h-40" />
          ) : photos.data?.length ? (
            <PhotoGrid photos={photos.data} />
          ) : (
            <EmptyState icon={<Camera className="h-5 w-5" />} title="No photos uploaded yet" />
          )}
        </CardBody>
      </Card>
      <ProgressEntryForm open={open} onClose={() => setOpen(false)} memberPath={`/members/${memberId}`} invalidate={[['trainer', 'member', memberId, 'progress']]} defaultWeight={latestWeight} />
    </div>
  );
}

function TrainingTab({ memberId }: { memberId: string }) {
  const plans = useQuery({ queryKey: ['trainer', 'plans', { member: memberId }], queryFn: () => api.get<WorkoutPlan[]>('/workouts/plans', { member: memberId }) });
  const logs = useQuery({ queryKey: ['trainer', 'member', memberId, 'logs'], queryFn: () => api.get<WorkoutLog[]>(`/members/${memberId}/workout-logs`) });
  const [logOpen, setLogOpen] = useState(false);
  const active = (plans.data ?? []).filter((p) => p.status === 'active');
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Workout plans</span>}
          action={
            <ButtonLink to={`/trainer/workouts?new=1&member=${memberId}`} size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
              New plan
            </ButtonLink>
          }
        />
        <CardBody className="space-y-6">
          {plans.isError ? (
            <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
          ) : plans.isLoading ? (
            <Skeleton className="h-40" />
          ) : !plans.data?.length ? (
            <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No plans for this member" description="Build a plan from scratch or from one of your templates." />
          ) : (
            plans.data.map((p) => (
              <div key={p._id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.title}</p>
                    <StatusBadge status={p.status === 'active' ? 'active' : 'expired'} />
                  </div>
                  <ButtonLink to={`/trainer/workouts?edit=${p._id}`} size="sm" variant="ghost">
                    Edit
                  </ButtonLink>
                </div>
                <PlanDays days={p.days} />
              </div>
            ))
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Training log"
          description="Sessions logged by the member or by you."
          action={
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLogOpen(true)}>
              Log session
            </Button>
          }
        />
        <CardBody>
          {logs.isError ? <ErrorState error={logs.error} onRetry={() => logs.refetch()} /> : logs.isLoading ? <Skeleton className="h-32" /> : <WorkoutLogList logs={logs.data ?? []} empty={<EmptyState title="No sessions logged yet" />} />}
        </CardBody>
      </Card>
      <WorkoutLogForm open={logOpen} onClose={() => setLogOpen(false)} memberPath={`/members/${memberId}`} plans={active} initial={active[0] ? { planId: active[0]._id, dayIndex: 0 } : null} invalidate={[['trainer', 'member', memberId, 'logs']]} />
    </div>
  );
}

function NotesTab({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['trainer', 'notes', { member: memberId }];
  const notes = useQuery({ queryKey: key, queryFn: () => api.get<TrainerNote[]>('/trainers/me/notes', { member: memberId }) });
  const [body, setBody] = useState('');
  const [follow, setFollow] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['trainer'] });
  const add = useMutation({
    mutationFn: () => api.post('/trainers/me/notes', { member: memberId, body: body.trim(), followUpAt: follow ? new Date(`${follow}T09:00:00`).toISOString() : null }),
    onSuccess: () => {
      setBody('');
      setFollow('');
      toast.success('Note saved');
      void inv();
    },
    onError: (e) => toast.error(e),
  });
  const toggle = useMutation({ mutationFn: (n: TrainerNote) => api.patch(`/trainers/me/notes/${n._id}`, { done: !n.done }), onSuccess: () => void inv(), onError: (e) => toast.error(e) });
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card className="h-fit">
        <CardHeader title={<span className="inline-flex items-center gap-2"><NotebookPen className="h-4 w-4 text-primary" /> Add a note</span>} description="Private to you — members never see these." />
        <CardBody>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return setErr('Write a note first');
              setErr(null);
              add.mutate();
            }}
          >
            <Textarea label="Note" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} error={err ?? undefined} placeholder="Session observations, technique cues, next steps…" />
            <Input label="Follow-up reminder (optional)" type="date" min={toDateInput(new Date())} value={follow} onChange={(e) => setFollow(e.target.value)} />
            <Button type="submit" loading={add.isPending}>
              Save note
            </Button>
          </form>
        </CardBody>
      </Card>
      <div className="space-y-2.5">
        {notes.isError ? (
          <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
        ) : notes.isLoading ? (
          <Skeleton className="h-40" />
        ) : !notes.data?.length ? (
          <EmptyState icon={<NotebookPen className="h-5 w-5" />} title="No notes yet" description="Notes help you remember what you worked on and what to check next time." />
        ) : (
          notes.data.map((n) => {
            const late = !n.done && n.followUpAt && new Date(n.followUpAt) < new Date();
            return (
              <div key={n._id} className={`card p-4 ${n.done ? 'opacity-60' : ''} ${late ? 'border-danger/40' : ''}`}>
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {fmtDateTime(n.createdAt)}
                    {n.followUpAt && <span className={late ? 'ml-2 text-danger' : 'ml-2'}>· Follow up {relativeTime(n.followUpAt)}</span>}
                  </span>
                  <Button size="sm" variant="ghost" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => toggle.mutate(n)}>
                    {n.done ? 'Reopen' : 'Mark done'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
