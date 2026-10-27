import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from './Widgets.jsx';
import { Button } from '../ui/Button.jsx';
import { ErrorState, Skeleton } from '../ui/States.jsx';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

// Support conversation shared by the member and admin dashboards. Staff can add private notes.
export function TicketThread({ id, staff = false }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await api.get(`/support/${id}`)).data });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const t = q.data;
  const update = async (patch) => {
    try { qc.setQueryData(['ticket', id], (await api.patch(`/support/${id}`, patch)).data); qc.invalidateQueries({ queryKey: ['/support'] }); qc.invalidateQueries({ queryKey: ['support-me'] }); } catch (err) { toast.error(err); }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/support/${id}/messages`, { body, internal });
      qc.setQueryData(['ticket', id], res.data);
      setBody(''); setInternal(false);
      toast.success(res.message);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{t.subject}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><StatusBadge status={t.status} /><span className="capitalize">{t.category}</span>· opened {formatDate(t.createdAt)}{staff && ` · ${t.user?.name} (${t.user?.email})`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {staff ? (
            <>
              <select aria-label="Status" className="input h-10 w-auto py-2" value={t.status} onChange={(e) => update({ status: e.target.value })}>{['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <select aria-label="Priority" className="input h-10 w-auto py-2" value={t.priority} onChange={(e) => update({ priority: e.target.value })}>{['low', 'normal', 'high'].map((s) => <option key={s} value={s}>{s} priority</option>)}</select>
            </>
          ) : t.status !== 'closed'
            ? <Button size="sm" variant="outline" onClick={() => update({ status: 'closed' })}>Close ticket</Button>
            : <Button size="sm" variant="outline" onClick={() => update({ status: 'open' })}>Reopen</Button>}
        </div>
      </div>
      <ol className="space-y-4">
        {t.messages.map((m) => {
          const fromStaff = m.author?.role && m.author.role !== 'member';
          return (
            <li key={m._id} className={cn('max-w-[85%] rounded-brand border p-4', m.internal ? 'border-gold/40 bg-gold/5' : fromStaff ? 'ml-auto border-line/10 bg-elevated' : 'border-line/10 bg-surface')}>
              <p className="mb-1 flex items-center gap-2 text-xs text-muted">
                {m.internal && <Lock className="h-3 w-3 text-gold" aria-label="Internal note" />}
                <span className="font-medium text-ink">{m.author?.name}{fromStaff ? ' · Team' : ''}</span>{formatDate(m.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="whitespace-pre-line text-sm">{m.body}</p>
            </li>
          );
        })}
      </ol>
      {t.status !== 'closed' ? (
        <form onSubmit={send} className="space-y-3 rounded-brand border border-line/10 bg-surface p-4">
          <label htmlFor="reply" className="sr-only">Reply</label>
          <textarea id="reply" className="input min-h-[100px]" placeholder={internal ? 'Private note for the team…' : 'Write a reply…'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {staff ? <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[rgb(var(--accent))]" />Internal note (not visible to member)</label> : <span />}
            <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>{internal ? 'Add note' : 'Send reply'}</Button>
          </div>
        </form>
      ) : <p className="text-sm text-muted">This ticket is closed.</p>}
    </div>
  );
}
