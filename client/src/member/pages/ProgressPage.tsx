import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, Info, LineChart, Lock, Pencil, Plus, Scale, Target, Trash2 } from 'lucide-react';
import { bmiCategory, calculateBmi } from '@apex/shared';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { GoalItem } from '../components/Goals';
import { PhotoGrid } from '../components/PhotoGrid';
import { ProgressCharts } from '../components/ProgressCharts';
import { ProgressEntryForm } from '../components/ProgressEntryForm';
import type { Goal, MeResponse, ProgressEntry, ProgressPhoto } from '../components/types';
import { applyFieldErrors, optNum, toDateInput, zr } from '../components/utils';

const K = {
  progress: ['member', 'progress'],
  me: ['member', 'me'],
  photos: ['member', 'photos'],
  dashboard: ['member', 'dashboard'],
};

export default function ProgressPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const progress = useQuery({ queryKey: K.progress, queryFn: () => api.get<ProgressEntry[]>('/members/me/progress') });
  const me = useQuery({ queryKey: K.me, queryFn: () => api.get<MeResponse>('/members/me') });
  const [entryOpen, setEntryOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProgressEntry | null>(null);

  useEffect(() => {
    if (location.hash === '#goals' && me.data) setTimeout(() => document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [location.hash, me.data]);

  const del = useMutation({
    mutationFn: (e: ProgressEntry) => api.delete(`/members/me/progress/${e._id}`),
    onSuccess: () => {
      toast.success('Entry deleted');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: K.progress });
      void qc.invalidateQueries({ queryKey: K.dashboard });
    },
    onError: (err) => toast.error(err),
  });

  const entries = [...(progress.data ?? [])].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const weights = entries.filter((e) => e.weightKg != null);
  const latestW = weights[0];
  const firstW = weights[weights.length - 1];
  const latestBf = entries.find((e) => e.bodyFatPct != null);
  const height = me.data?.profile.heightCm ?? null;
  const bmi = latestW && height ? calculateBmi(latestW.weightKg!, height) : null;
  const cat = bmi ? bmiCategory(bmi) : null;
  const change = latestW && firstW && weights.length > 1 ? Math.round((latestW.weightKg! - firstW.weightKg!) * 10) / 10 : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Training"
        title="Progress"
        description="Measure what matters. Your data is private to you, your assigned coach and gym staff."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEntryOpen(true)}>
            Log check-in
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {progress.isLoading || me.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Stat label="Current weight" value={latestW ? `${latestW.weightKg} kg` : '—'} hint={latestW ? fmtDate(latestW.date) : 'Not logged yet'} />
            <Stat label="Change" value={change != null ? `${change > 0 ? '+' : ''}${change} kg` : '—'} hint={change != null ? `since ${fmtDate(firstW!.date)}` : 'Needs two weigh-ins'} />
            <Stat label="Body fat" value={latestBf ? `${latestBf.bodyFatPct}%` : '—'} hint={latestBf ? fmtDate(latestBf.date) : 'Optional'} />
            <Stat
              label="BMI"
              value={bmi ?? '—'}
              hint={cat ? <Badge tone={cat.tone === 'info' ? 'info' : cat.tone}>{cat.label}</Badge> : height ? 'Log your weight' : <ButtonLink to="/member/profile" variant="ghost" size="sm" className="!px-0 text-primary">Add your height</ButtonLink>}
            />
          </>
        )}
      </div>
      {bmi && (
        <p className="-mt-3 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> BMI is a rough population screening tool based on height ({height} cm) and weight. It doesn’t account for muscle mass, age or build — it isn’t a diagnosis. Talk to your coach or a doctor about what’s right for you.
        </p>
      )}

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><LineChart className="h-4 w-4 text-primary" /> Trends</span>} />
        <CardBody>
          {progress.isError ? <ErrorState error={progress.error} onRetry={() => progress.refetch()} /> : progress.isLoading ? <Skeleton className="h-64" /> : <ProgressCharts entries={progress.data ?? []} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Check-in log</span>} description={entries.length ? `${entries.length} entries` : undefined} />
        <CardBody className="p-0">
          {progress.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-24" />
            </div>
          ) : !entries.length ? (
            <div className="p-5">
              <EmptyState icon={<Scale className="h-5 w-5" />} title="No check-ins yet" description="Log your starting point today — future you will thank you." action={<Button onClick={() => setEntryOpen(true)}>Log first check-in</Button>} />
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {entries.slice(0, 30).map((e) => {
                const m = e.measurements ?? {};
                const ms = [m.chestCm && `Chest ${m.chestCm}`, m.waistCm && `Waist ${m.waistCm}`, m.hipsCm && `Hips ${m.hipsCm}`, m.armCm && `Arm ${m.armCm}`, m.thighCm && `Thigh ${m.thighCm}`].filter(Boolean);
                return (
                  <li key={e._id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-sm text-muted">
                        {[e.weightKg != null && `${e.weightKg} kg`, e.bodyFatPct != null && `${e.bodyFatPct}% fat`].filter(Boolean).join(' · ') || '—'}
                        {ms.length > 0 && <span className="block text-xs">{ms.join(' · ')} cm</span>}
                      </p>
                      {e.notes && <p className="mt-0.5 text-xs text-muted">“{e.notes}”</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 !p-0 text-muted hover:text-danger" aria-label={`Delete entry from ${fmtDate(e.date)}`} onClick={() => setDeleting(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <GoalsSection goals={me.data?.profile.goals} loading={me.isLoading} ctx={{ weightKg: latestW?.weightKg, bodyFatPct: latestBf?.bodyFatPct }} />

      <PhotosSection shared={me.data?.profile.progressPhotosSharedWithTrainer ?? false} trainerName={me.data?.profile.assignedTrainer?.name} />

      <ProgressEntryForm open={entryOpen} onClose={() => setEntryOpen(false)} memberPath="/members/me" invalidate={[K.progress, K.dashboard]} defaultWeight={latestW?.weightKg} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting)} loading={del.isPending} tone="danger" title="Delete this entry?" confirmLabel="Delete" description={deleting ? fmtDate(deleting.date) : undefined}>
        <p className="text-sm text-muted">This removes it from your charts. It can’t be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}

/* ---------------------------------- Goals --------------------------------- */

const goalSchema = z.object({
  title: z.string().trim().min(2, 'Give your goal a name').max(120),
  metric: z.enum(['weight', 'bodyFat', 'attendance', 'custom']),
  startValue: z.preprocess(optNum, z.number().optional()),
  targetValue: z.preprocess(optNum, z.number().optional()),
  unit: z.string().trim().max(12).default(''),
  deadline: z.string().optional(),
  status: z.enum(['active', 'achieved', 'abandoned']),
});
type GoalForm = z.output<typeof goalSchema>;

function GoalsSection({ goals, loading, ctx }: { goals?: Goal[]; loading: boolean; ctx: { weightKg?: number | null; bodyFatPct?: number | null } }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const form = useForm<GoalForm>({ resolver: zr<GoalForm>(goalSchema) });
  const { register, handleSubmit, reset, setError, watch, formState } = form;
  const metric = watch('metric');

  useLayoutEffect(() => {
    if (editing === 'new') reset({ title: '', metric: 'weight', startValue: ctx.weightKg ?? undefined, targetValue: undefined, unit: '', deadline: '', status: 'active' });
    else if (editing) reset({ ...editing, unit: editing.unit ?? '', deadline: toDateInput(editing.deadline), startValue: editing.startValue ?? undefined, targetValue: editing.targetValue ?? undefined });
  }, [editing, reset, ctx.weightKg]);

  const done = (msg: string) => {
    toast.success(msg);
    setEditing(null);
    setDeleting(null);
    void qc.invalidateQueries({ queryKey: K.me });
    void qc.invalidateQueries({ queryKey: K.dashboard });
  };
  const save = useMutation({
    mutationFn: (v: GoalForm) => {
      const body = { ...v, unit: v.unit || (v.metric === 'weight' ? 'kg' : v.metric === 'bodyFat' ? '%' : v.metric === 'attendance' ? 'visits' : ''), deadline: v.deadline ? new Date(`${v.deadline}T12:00:00`).toISOString() : null };
      return editing && editing !== 'new' ? api.put(`/members/me/goals/${editing._id}`, body) : api.post('/members/me/goals', body);
    },
    onSuccess: () => done(editing === 'new' ? 'Goal added — let’s go!' : 'Goal updated'),
    onError: (err) => !applyFieldErrors(err, setError) && toast.error(err),
  });
  const del = useMutation({ mutationFn: (g: Goal) => api.delete(`/members/me/goals/${g._id}`), onSuccess: () => done('Goal removed'), onError: (err) => toast.error(err) });

  const sorted = [...(goals ?? [])].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const e = formState.errors;
  return (
    <section id="goals" className="scroll-mt-24">
      <Card>
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Goals</span>}
          description="Weight, body-fat and attendance goals track themselves from your logs."
          action={
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')} disabled={(goals?.length ?? 0) >= 20}>
              New goal
            </Button>
          }
        />
        <CardBody>
          {loading ? (
            <Skeleton className="h-24" />
          ) : !sorted.length ? (
            <EmptyState icon={<Target className="h-5 w-5" />} title="No goals yet" description="Set one clear, measurable target — e.g. “Reach 72 kg by March”." action={<Button onClick={() => setEditing('new')}>Set a goal</Button>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sorted.map((g) => (
                <GoalItem
                  key={g._id}
                  goal={g}
                  ctx={ctx}
                  actions={
                    <>
                      <Button variant="ghost" size="sm" className="h-8 w-8 !p-0" aria-label={`Edit goal ${g.title}`} onClick={() => setEditing(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 !p-0 text-muted hover:text-danger" aria-label={`Delete goal ${g.title}`} onClick={() => setDeleting(g)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New goal' : 'Edit goal'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="goal-form" loading={save.isPending}>
              Save goal
            </Button>
          </>
        }
      >
        <form id="goal-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <Input label="Goal" required placeholder="e.g. Drop to 72 kg" {...register('title')} error={e.title?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Track by"
              {...register('metric')}
              options={[
                { value: 'weight', label: 'Body weight (auto)' },
                { value: 'bodyFat', label: 'Body fat % (auto)' },
                { value: 'attendance', label: 'Visits in 30 days (auto)' },
                { value: 'custom', label: 'Something else' },
              ]}
            />
            <Select
              label="Status"
              {...register('status')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'achieved', label: 'Achieved 🎉' },
                { value: 'abandoned', label: 'Paused / dropped' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Start value" type="number" step="0.1" {...register('startValue')} error={e.startValue?.message} />
            <Input label="Target" type="number" step="0.1" {...register('targetValue')} error={e.targetValue?.message} />
            {metric === 'custom' && <Input label="Unit" placeholder="e.g. kg, reps" maxLength={12} {...register('unit')} error={e.unit?.message} />}
          </div>
          <Input label="Deadline (optional)" type="date" {...register('deadline')} error={e.deadline?.message} />
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting)} loading={del.isPending} tone="danger" title="Delete this goal?" confirmLabel="Delete" description={deleting?.title} />
    </section>
  );
}

/* --------------------------------- Photos --------------------------------- */

function PhotosSection({ shared, trainerName }: { shared: boolean; trainerName?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const photos = useQuery({ queryKey: K.photos, queryFn: () => api.get<ProgressPhoto[]>('/members/me/photos') });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProgressPhoto | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [takenAt, setTakenAt] = useState(toDateInput(new Date()));
  const [pose, setPose] = useState('front');
  const [note, setNote] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const toggle = useMutation({
    mutationFn: (v: boolean) => api.patch('/members/me', { profile: { progressPhotosSharedWithTrainer: v } }),
    onSuccess: (_, v) => {
      toast.success(v ? 'Photos shared with your coach' : 'Photos are now private to you');
      void qc.invalidateQueries({ queryKey: K.me });
    },
    onError: (err) => toast.error(err),
  });
  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('takenAt', new Date(`${takenAt}T12:00:00`).toISOString());
      fd.append('pose', pose);
      fd.append('note', note.trim());
      return api.upload<ProgressPhoto>('/members/me/photos', fd);
    },
    onSuccess: () => {
      toast.success('Photo saved privately');
      setUploadOpen(false);
      setFile(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: K.photos });
    },
    onError: (err) => setFileError((err as Error).message),
  });
  const del = useMutation({
    mutationFn: (p: ProgressPhoto) => api.delete(`/members/me/photos/${p.id}`),
    onSuccess: () => {
      toast.success('Photo deleted permanently');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: K.photos });
    },
    onError: (err) => toast.error(err),
  });

  const pick = (f?: File) => {
    setFileError(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(f.type)) return setFileError('Choose a JPG, PNG or WebP image');
    if (f.size > 10 * 1024 * 1024) return setFileError('Image must be under 10 MB');
    setFile(f);
  };

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Progress photos</span>}
        description={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Private — stored securely, never public.</span>}
        action={
          <Button size="sm" variant="secondary" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => (setUploadOpen(true), setFileError(null))}>
            Add photo
          </Button>
        }
      />
      <CardBody className="space-y-5">
        <div className="rounded-2xl border border-line bg-fg/[0.02] p-4">
          <Switch
            checked={shared}
            disabled={toggle.isPending}
            onChange={(v) => toggle.mutate(v)}
            label="Share progress photos with my coach"
            description={
              trainerName
                ? `When on, ${trainerName} (your assigned coach) can view these photos to track your progress. Turn it off any time — access stops immediately. Other members never see them.`
                : 'When on, your assigned coach can view these photos. You don’t have an assigned coach yet, so nobody else can see them right now.'
            }
          />
        </div>
        {photos.isError ? (
          <ErrorState error={photos.error} onRetry={() => photos.refetch()} />
        ) : photos.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : !photos.data?.length ? (
          <EmptyState icon={<Camera className="h-5 w-5" />} title="No photos yet" description="Same pose, same light, every 2–4 weeks. Photos often show change before the scale does." />
        ) : (
          <PhotoGrid photos={photos.data} onDelete={setDeleting} />
        )}
      </CardBody>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Add a progress photo"
        description="Only you can see it unless you choose to share with your coach."
        footer={
          <>
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}>
              Upload privately
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <input ref={fileRef} id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            <label htmlFor="photo-file" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted transition hover:border-primary/50 focus-within:border-primary">
              {preview ? <img src={preview} alt="Selected" className="max-h-56 rounded-xl object-contain" /> : <ImagePlus className="h-8 w-8" />}
              <span>{file ? file.name : 'Tap to choose a photo'}</span>
            </label>
            {fileError && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {fileError}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Taken on" type="date" max={toDateInput(new Date())} value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
            <Select
              label="Pose"
              value={pose}
              onChange={(e) => setPose(e.target.value)}
              options={[
                { value: 'front', label: 'Front' },
                { value: 'side', label: 'Side' },
                { value: 'back', label: 'Back' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
          <Textarea label="Note (optional)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <Alert tone="info">Tip: use the same spot, lighting and time of day so comparisons are fair.</Alert>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting)} loading={del.isPending} tone="danger" title="Delete this photo?" confirmLabel="Delete permanently" description={deleting ? fmtDate(deleting.takenAt) : undefined}>
        <p className="text-sm text-muted">The image file is removed from our servers. This can’t be undone.</p>
      </ConfirmDialog>
    </Card>
  );
}
