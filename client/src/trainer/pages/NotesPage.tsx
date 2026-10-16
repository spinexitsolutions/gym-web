import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlarmClock, CheckCircle2, Circle, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, relativeTime } from '@/lib/format';
import { refId, refName, type AssignedMember, type TrainerNote } from '@/member/components/types';
import { toDateInput } from '@/member/components/utils';

type Filter = 'open' | 'done' | 'all';
type Draft = { id: string | null; member: string; body: string; followUp: string };

export default function TrainerNotesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const [member, setMember] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<TrainerNote | null>(null);

  const notes = useQuery({ queryKey: ['trainer', 'notes', filter, member], queryFn: () => api.get<TrainerNote[]>('/trainers/me/notes', { done: filter === 'all' ? undefined : String(filter === 'done'), member: member || undefined }) });
  const members = useQuery({ queryKey: ['trainer', 'members'], queryFn: () => api.get<AssignedMember[]>('/trainers/me/members') });
  const memberOpts = (members.data ?? []).map((m) => ({ value: m.user._id, label: m.user.name }));

  const sorted = useMemo(
    () =>
      [...(notes.data ?? [])].sort((a, b) => {
        const fa = a.followUpAt && !a.done ? +new Date(a.followUpAt) : Infinity;
        const fb = b.followUpAt && !b.done ? +new Date(b.followUpAt) : Infinity;
        return fa - fb || +new Date(b.createdAt) - +new Date(a.createdAt);
      }),
    [notes.data],
  );
  const overdueCount = sorted.filter((n) => !n.done && n.followUpAt && new Date(n.followUpAt) < new Date()).length;

  const inv = () => qc.invalidateQueries({ queryKey: ['trainer'] });
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const followUpAt = d.followUp ? new Date(`${d.followUp}T09:00:00`).toISOString() : null;
      return d.id ? api.patch(`/trainers/me/notes/${d.id}`, { body: d.body.trim(), followUpAt }) : api.post('/trainers/me/notes', { member: d.member, body: d.body.trim(), followUpAt });
    },
    onSuccess: (_, d) => {
      toast.success(d.id ? 'Note updated' : 'Note added');
      setDraft(null);
      void inv();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.error(e);
    },
  });
  const toggle = useMutation({
    mutationFn: (n: TrainerNote) => api.patch(`/trainers/me/notes/${n._id}`, { done: !n.done }),
    onSuccess: (_, n) => {
      toast.success(n.done ? 'Reopened' : 'Marked done');
      void inv();
    },
    onError: (e) => toast.error(e),
  });
  const del = useMutation({
    mutationFn: (n: TrainerNote) => api.delete(`/trainers/me/notes/${n._id}`),
    onSuccess: () => {
      toast.success('Note deleted');
      setDeleting(null);
      void inv();
    },
    onError: (e) => toast.error(e),
  });

  const submit = () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.id && !draft.member) e.member = 'Choose a member';
    if (!draft.body.trim()) e.body = 'Write the note';
    setErrors(e);
    if (!Object.keys(e).length) save.mutate(draft);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Coaching"
        title="Notes & follow-ups"
        description="Private coaching notes with optional reminders. Members never see these."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => (setErrors({}), setDraft({ id: null, member: member, body: '', followUp: '' }))}>
            New note
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Select aria-label="Filter by member" wrapClassName="sm:w-56" value={member} onChange={(e) => setMember(e.target.value)} placeholder="All members" options={memberOpts} />
      </div>
      {overdueCount > 0 && filter !== 'done' && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          <AlarmClock className="h-4 w-4" /> {overdueCount} follow-up{overdueCount > 1 ? 's are' : ' is'} overdue
        </p>
      )}
      {notes.isError ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : notes.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !sorted.length ? (
        <EmptyState icon={<NotebookPen className="h-5 w-5" />} title={filter === 'done' ? 'Nothing completed yet' : 'No open notes'} description="Jot down session observations and set a follow-up date so nobody slips through the cracks." />
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((n, i) => {
            const overdue = !n.done && n.followUpAt && new Date(n.followUpAt) < new Date();
            const dueSoon = !n.done && n.followUpAt && !overdue && new Date(n.followUpAt).getTime() - Date.now() < 2 * 86400000;
            return (
              <motion.li key={n._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className={cn('card flex gap-3 p-4', overdue && 'border-danger/50', n.done && 'opacity-60')}>
                <button onClick={() => toggle.mutate(n)} aria-label={n.done ? 'Reopen note' : 'Mark note done'} className="mt-0.5 shrink-0 text-muted transition hover:text-primary">
                  {n.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/trainer/members/${refId(n.member as { _id: string })}`} className="text-sm font-semibold hover:text-primary">
                      {refName(n.member as { name: string }, 'Member')}
                    </Link>
                    {n.followUpAt && (
                      <Badge tone={n.done ? 'neutral' : overdue ? 'danger' : dueSoon ? 'warning' : 'neutral'}>
                        <AlarmClock className="h-3 w-3" /> {overdue ? 'Overdue · ' : ''}
                        {fmtDate(n.followUpAt, { day: 'numeric', month: 'short' })}
                      </Badge>
                    )}
                  </div>
                  <p className={cn('mt-1 whitespace-pre-wrap text-sm', n.done && 'line-through')}>{n.body}</p>
                  <p className="mt-1 text-xs text-muted">Written {relativeTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button variant="ghost" size="sm" className="h-8 w-8 !p-0" aria-label="Edit note" onClick={() => (setErrors({}), setDraft({ id: n._id, member: refId(n.member as { _id: string }), body: n.body, followUp: toDateInput(n.followUpAt) }))}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 !p-0 hover:text-danger" aria-label="Delete note" onClick={() => setDeleting(n)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit note' : 'New note'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={submit}>
              Save
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {!draft.id && <Select label="Member" required value={draft.member} onChange={(e) => setDraft({ ...draft, member: e.target.value })} placeholder={memberOpts.length ? 'Choose a member' : 'No assigned members'} options={memberOpts} error={errors.member} />}
            <Textarea label="Note" required rows={5} maxLength={2000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} error={errors.body} />
            <Input label="Follow-up date (optional)" type="date" value={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.value })} error={errors.followUpAt} hint="Shows on your dashboard when it’s within a week." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting)} loading={del.isPending} tone="danger" title="Delete this note?" confirmLabel="Delete" />
    </div>
  );
}
