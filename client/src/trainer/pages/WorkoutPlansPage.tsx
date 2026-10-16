import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Archive, ArchiveRestore, ArrowLeft, ClipboardList, Copy, LayoutTemplate, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { refName, type AssignedMember, type WorkoutPlan } from '@/member/components/types';
import { plural } from '@/member/components/utils';
import { PlanBuilder, draftFromPlan, draftToBody, emptyDraft, validateDraft, type PlanDraft } from '../components/PlanBuilder';

type Filter = 'assigned' | 'templates' | 'archived';
type Editing = { id: string | null; draft: PlanDraft } | null;

export default function TrainerWorkoutPlansPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('assigned');
  const [editing, setEditing] = useState<Editing>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<WorkoutPlan | null>(null);

  const plans = useQuery({ queryKey: ['trainer', 'plans', 'all'], queryFn: () => api.get<WorkoutPlan[]>('/workouts/plans') });
  const members = useQuery({ queryKey: ['trainer', 'members'], queryFn: () => api.get<AssignedMember[]>('/trainers/me/members') });

  useEffect(() => {
    const edit = params.get('edit');
    if (params.get('new')) {
      setEditing({ id: null, draft: emptyDraft(params.get('member') ?? '') });
      setParams({}, { replace: true });
    } else if (edit && plans.data) {
      const p = plans.data.find((x) => x._id === edit);
      if (p) setEditing({ id: p._id, draft: draftFromPlan(p) });
      setParams({}, { replace: true });
    }
  }, [params, plans.data, setParams]);

  const list = useMemo(() => {
    const all = plans.data ?? [];
    if (filter === 'archived') return all.filter((p) => p.status === 'archived');
    if (filter === 'templates') return all.filter((p) => p.isTemplate && p.status === 'active');
    return all.filter((p) => !p.isTemplate && p.status === 'active');
  }, [plans.data, filter]);
  const count = (f: Filter) => (plans.data ?? []).filter((p) => (f === 'archived' ? p.status === 'archived' : p.status === 'active' && (f === 'templates' ? p.isTemplate : !p.isTemplate))).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['trainer'] });
  const save = useMutation({
    mutationFn: (e: NonNullable<Editing>) => (e.id ? api.put<WorkoutPlan>(`/workouts/plans/${e.id}`, draftToBody(e.draft)) : api.post<WorkoutPlan>('/workouts/plans', draftToBody(e.draft))),
    onSuccess: (p, e) => {
      toast.success(e.id ? 'Plan updated' : p.isTemplate ? 'Template saved' : 'Plan assigned', p.isTemplate ? undefined : 'The member has been notified.');
      setEditing(null);
      setFilter(p.status === 'archived' ? 'archived' : p.isTemplate ? 'templates' : 'assigned');
      void invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      toast.error(err);
    },
  });
  const setStatus = useMutation({
    mutationFn: (p: WorkoutPlan) => api.put(`/workouts/plans/${p._id}`, draftToBody({ ...draftFromPlan(p), status: p.status === 'active' ? 'archived' : 'active' })),
    onSuccess: (_, p) => {
      toast.success(p.status === 'active' ? 'Plan archived' : 'Plan restored');
      void invalidate();
    },
    onError: (e) => toast.error(e),
  });
  const del = useMutation({
    mutationFn: (p: WorkoutPlan) => api.delete(`/workouts/plans/${p._id}`),
    onSuccess: () => {
      toast.success('Plan deleted');
      setDeleting(null);
      void invalidate();
    },
    onError: (e) => toast.error(e),
  });

  const submit = () => {
    if (!editing) return;
    const errs = validateDraft(editing.draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    save.mutate(editing);
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-4xl pb-24">
        <button onClick={() => setEditing(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> All plans
        </button>
        <PageHeader eyebrow="Plan builder" title={editing.id ? 'Edit plan' : 'New workout plan'} description="Build training days, add exercises from the library, and set the prescription. Reorder with the arrows." />
        {!members.isLoading && !members.data?.length && !editing.draft.isTemplate && (
          <Alert tone="info" className="mb-4">
            You have no assigned members yet, so this can only be saved as a template for now.
          </Alert>
        )}
        <Card>
          <CardBody>
            <PlanBuilder value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} errors={errors} members={members.data ?? []} />
          </CardBody>
        </Card>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur lg:pl-64">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="hidden text-sm text-muted sm:block">
              {plural(editing.draft.days.length, 'day')} · {plural(editing.draft.days.reduce((a, d) => a + d.exercises.length, 0), 'exercise')}
            </p>
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button loading={save.isPending} onClick={submit}>
                {editing.draft.isTemplate ? 'Save template' : editing.id ? 'Save changes' : 'Assign plan'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Coaching"
        title="Workout plans"
        description="Programmes you’ve assigned to members, plus reusable templates."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => (setErrors({}), setEditing({ id: null, draft: emptyDraft() }))}>
            New plan
          </Button>
        }
      />
      <Tabs<Filter>
        className="mb-5 w-fit"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'assigned', label: 'Assigned', count: count('assigned') },
          { value: 'templates', label: 'Templates', count: count('templates') },
          { value: 'archived', label: 'Archived', count: count('archived') },
        ]}
      />
      {plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      ) : plans.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !list.length ? (
        <EmptyState
          icon={filter === 'templates' ? <LayoutTemplate className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
          title={filter === 'templates' ? 'No templates yet' : filter === 'archived' ? 'Nothing archived' : 'No assigned plans yet'}
          description={filter === 'templates' ? 'Save a plan as a template to reuse it for multiple members.' : filter === 'archived' ? 'Archived plans are hidden from members but kept for reference.' : 'Create a plan and assign it to one of your members.'}
          action={filter !== 'archived' ? <Button onClick={() => setEditing({ id: null, draft: emptyDraft() })}>Create a plan</Button> : undefined}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((p, i) => {
            const exCount = p.days.reduce((a, d) => a + d.exercises.length, 0);
            return (
              <motion.li key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">{p.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      {p.isTemplate ? (
                        <>
                          <LayoutTemplate className="h-3.5 w-3.5" /> Template
                        </>
                      ) : (
                        <>
                          <UserRound className="h-3.5 w-3.5" /> {refName(p.member as { name: string }, 'Unassigned')}
                        </>
                      )}
                      {p.updatedAt && ` · updated ${relativeTime(p.updatedAt)}`}
                    </p>
                  </div>
                  {p.status === 'archived' && <Badge>Archived</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.days.slice(0, 5).map((d, j) => (
                    <Badge key={j} tone="primary">
                      {d.name}
                      {d.focus ? ` · ${d.focus}` : ''}
                    </Badge>
                  ))}
                  {p.days.length > 5 && <Badge>+{p.days.length - 5}</Badge>}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {plural(p.days.length, 'day')} · {plural(exCount, 'exercise')}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line/60 pt-3">
                  <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => (setErrors({}), setEditing({ id: p._id, draft: draftFromPlan(p) }))}>
                    Edit
                  </Button>
                  {p.isTemplate && (
                    <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => (setErrors({}), setEditing({ id: null, draft: draftFromPlan(p, true) }))}>
                      Assign copy
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" loading={setStatus.isPending && setStatus.variables?._id === p._id} icon={p.status === 'active' ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />} onClick={() => setStatus.mutate(p)}>
                    {p.status === 'active' ? 'Archive' : 'Restore'}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-danger" aria-label={`Delete ${p.title}`} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(p)} />
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting)} loading={del.isPending} tone="danger" title="Delete this plan?" confirmLabel="Delete" description={deleting?.title}>
        <p className="text-sm text-muted">{deleting?.isTemplate ? 'The template will be removed.' : 'The member will no longer see this plan. Their logged workouts are kept. Consider archiving instead.'}</p>
      </ConfirmDialog>
    </div>
  );
}
