import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Send, Bot, AlertTriangle, Trophy, Star } from 'lucide-react';
import { api } from '../../services/api.js';
import { contentApi } from '../../services/content.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, Card, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { TicketThread } from '../../components/dashboard/TicketThread.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { Field, Select, Textarea, Input, FormAlert } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { useList } from '../../hooks/useList.js';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

export function WorkoutsPage() {
  const q = useQuery({ queryKey: ['workouts', 'me'], queryFn: async () => (await api.get('/workouts/me')).data });
  return (
    <>
      <Seo title="Workout plans" noindex />
      <PageHeader title="Workout plans" description="Personal plans written for you by your coach." />
      {q.isLoading ? <Skeleton className="h-64" /> : q.isError ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : !q.data.length ? (
        <EmptyState title="No plan assigned yet" message="Book a personal training session or ask the front desk to assign a coach — they’ll build your plan here." action={<Button to="/dashboard/book" size="sm">Book a session</Button>} />
      ) : q.data.map((p) => (
        <Card key={p._id} className="mb-6" title={p.title} actions={<StatusBadge status={p.status} />}>
          <p className="mb-5 text-sm text-muted">{p.goal}{p.trainer && ` · by ${p.trainer.name}`}{p.startDate && ` · ${formatDate(p.startDate)}${p.endDate ? ` – ${formatDate(p.endDate)}` : ''}`}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {p.days.map((d) => (
              <div key={d.label} className="rounded-brand border border-line/10 bg-elevated/40 p-4">
                <p className="mb-3 font-semibold">{d.label}</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="pb-2 font-medium">Exercise</th><th className="pb-2 font-medium">Sets × reps</th><th className="pb-2 font-medium">Rest</th></tr></thead>
                  <tbody>{d.exercises.map((e, i) => (
                    <tr key={i} className="border-t border-line/5 align-top"><td className="py-2 pr-2">{e.name}{e.notes && <span className="block text-xs text-muted">{e.notes}</span>}</td><td className="py-2">{e.sets ? `${e.sets} × ${e.reps || '—'}` : e.reps || '—'}</td><td className="py-2">{e.restSec ? `${e.restSec}s` : '—'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { rows, meta, query, set } = useList('/notifications', { key: 'notifications-page' });
  const open = async (n) => {
    if (!n.readAt) await api.post(`/notifications/${n._id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-page'] });
    if (n.link) navigate(n.link);
  };
  return (
    <>
      <Seo title="Notifications" noindex />
      <PageHeader title="Notifications" actions={meta?.unread > 0 && <Button size="sm" variant="outline" onClick={async () => { await api.post('/notifications/read-all'); qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-page'] }); }}>Mark all read</Button>} />
      {query.isLoading ? <Skeleton className="h-64" /> : !rows.length ? <EmptyState title="No notifications" /> : (
        <ul className="divide-y divide-line/5 rounded-brand border border-line/10 bg-surface">
          {rows.map((n) => (
            <li key={n._id}>
              <button type="button" onClick={() => open(n)} className={cn('block w-full px-5 py-4 text-left hover:bg-ink/5', !n.readAt && 'bg-gold/5')}>
                <p className="flex items-center gap-2 font-medium">{!n.readAt && <span className="h-2 w-2 rounded-full bg-gold" aria-label="Unread" />}{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager meta={meta} onPage={(page) => set({ page })} />
    </>
  );
}

export function SupportPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'other', message: '' });
  const [error, setError] = useState('');
  const q = useQuery({ queryKey: ['support-me'], queryFn: async () => (await api.get('/support/me')).data });
  const create = async () => {
    setError('');
    try { const res = await api.post('/support', form); toast.success(res.message); qc.invalidateQueries({ queryKey: ['support-me'] }); navigate(`/dashboard/support/${res.data._id}`); } catch (err) { setError(err.details?.map((d) => `${d.field}: ${d.message}`).join(' · ') || err.message); }
  };
  return (
    <>
      <Seo title="Support" noindex />
      <PageHeader title="Support" description="Questions about your membership, payments or the club? Our team replies within one business day."
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />New request</Button>} />
      <DataTable caption="Support requests" rows={q.data} loading={q.isLoading} error={q.error} onRetry={q.refetch} onRowClick={(r) => navigate(`/dashboard/support/${r._id}`)}
        empty={{ title: 'No support requests', message: 'Start one any time.' }}
        columns={[
          { key: 'subject', header: 'Subject', render: (r) => <span className="font-medium">{r.subject}</span> },
          { key: 'category', header: 'Category', hideOnMobile: true, render: (r) => <span className="capitalize">{r.category}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status === 'pending' ? 'replied' : r.status} /> },
          { key: 'updatedAt', header: 'Updated', render: (r) => formatDate(r.updatedAt) },
        ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="New support request" size="sm"
        footer={<><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={create} disabled={form.subject.length < 3 || form.message.length < 5}>Send</Button></>}>
        <div className="space-y-4">
          <FormAlert>{error}</FormAlert>
          <Field label="Subject" required>{(a) => <Input {...a} value={form.subject} maxLength={150} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
          <Field label="Category">{(a) => <Select {...a} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['membership', 'payment', 'booking', 'facility', 'trainer', 'account', 'other'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select>}</Field>
          <Field label="Message" required>{(a) => <Textarea {...a} rows={5} value={form.message} maxLength={3000} onChange={(e) => setForm({ ...form, message: e.target.value })} />}</Field>
        </div>
      </Modal>
    </>
  );
}

export function SupportTicketPage() {
  const { id } = useParams();
  return (
    <>
      <Seo title="Support request" noindex />
      <Link to="/dashboard/support" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" aria-hidden />All requests</Link>
      <TicketThread id={id} />
    </>
  );
}

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="p-1">
          <Star className={cn('h-7 w-7', n <= value ? 'fill-gold text-gold' : 'text-muted/40')} />
        </button>
      ))}
    </div>
  );
}

export function ReviewsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const trainers = useQuery({ queryKey: ['trainers', 'all'], queryFn: async () => (await contentApi.trainers({ limit: 50 })).data });
  const mine = useQuery({ queryKey: ['reviews', 'me'], queryFn: async () => (await api.get('/reviews/me')).data });
  const [form, setForm] = useState({ targetType: 'gym', target: '', rating: 0, comment: '' });
  const submit = async () => {
    try {
      toast.success((await api.post('/reviews', { ...form, target: form.targetType === 'trainer' ? form.target : undefined })).message);
      setForm({ targetType: 'gym', target: '', rating: 0, comment: '' });
      qc.invalidateQueries({ queryKey: ['reviews', 'me'] });
    } catch (err) { toast.error(err); }
  };
  return (
    <>
      <Seo title="Feedback" noindex />
      <PageHeader title="Feedback & ratings" description="Rate the club or a coach you have trained with. Reviews are published after moderation." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Leave a review">
          <div className="space-y-4">
            <Field label="About">{(a) => <Select {...a} value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })}><option value="gym">The club</option><option value="trainer">A trainer</option></Select>}</Field>
            {form.targetType === 'trainer' && <Field label="Trainer">{(a) => <Select {...a} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="">— Choose —</option>{trainers.data?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</Select>}</Field>}
            <Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
            <Field label="Comment (optional)">{(a) => <Textarea {...a} rows={4} maxLength={1000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />}</Field>
            <Button onClick={submit} disabled={!form.rating || (form.targetType === 'trainer' && !form.target)}>Submit review</Button>
            {form.targetType === 'trainer' && <p className="text-xs text-muted">You can review a trainer after completing a session with them.</p>}
          </div>
        </Card>
        <Card title="Your reviews" padded={false}>
          {mine.data?.length ? (
            <ul className="divide-y divide-line/5">{mine.data.map((r) => (
              <li key={r._id} className="px-5 py-3 text-sm"><div className="flex items-center justify-between"><span>{r.targetType === 'gym' ? 'The club' : r.target?.name} · <span className="text-gold">{'★'.repeat(r.rating)}</span></span><StatusBadge status={r.status} /></div>{r.comment && <p className="mt-1 text-muted">{r.comment}</p>}</li>
            ))}</ul>
          ) : <p className="p-5 text-sm text-muted">No reviews yet.</p>}
        </Card>
      </div>
    </>
  );
}

export function ChallengesPage() {
  const q = useQuery({ queryKey: ['events'], queryFn: contentApi.events });
  return (
    <>
      <Seo title="Challenges" noindex />
      <PageHeader title="Events & challenges" description="Join a challenge and climb the leaderboard." />
      {q.isLoading ? <Skeleton className="h-64" /> : !q.data?.length ? <EmptyState icon={Trophy} title="No upcoming events" message="New challenges are announced regularly." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((e) => (
            <Link key={e._id} to={`/events/${e.slug}`} className="group overflow-hidden rounded-brand border border-line/10 bg-surface hover:border-gold/40">
              <Img image={e.image} alt="" sizes="400px" className="aspect-[16/9] w-full" />
              <div className="p-4"><p className="font-semibold group-hover:text-gold">{e.title}</p><p className="text-xs text-muted">{formatDate(e.startDate)} – {formatDate(e.endDate)}{e.metric !== 'none' ? ' · leaderboard' : ''}</p></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function AssistantPage() {
  const status = useQuery({ queryKey: ['assistant', 'status'], queryFn: async () => (await api.get('/assistant/status')).data });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text }].slice(-12);
    setMessages(next); setInput(''); setError(''); setBusy(true);
    try {
      const res = await api.post('/assistant', { messages: next.map(({ role, content }) => ({ role, content })) });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err) { setError(err.message); setMessages((m) => m.slice(0, -1)); setInput(text); } finally { setBusy(false); }
  };
  if (status.isLoading) return <Skeleton className="h-96" />;
  return (
    <>
      <Seo title="AI fitness assistant" noindex />
      <PageHeader title="AI fitness assistant" description="Quick answers on training, technique, recovery and nutrition habits." />
      <div role="note" className="mb-4 flex gap-3 rounded-brand border border-gold/30 bg-gold/5 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-gold" aria-hidden /><p>{status.data?.disclaimer}</p></div>
      {!status.data?.enabled ? (
        <EmptyState icon={Bot} title="Assistant not enabled" message="The club hasn’t switched on the AI assistant yet. Your coaches are happy to help — open a support request or ask at the desk." />
      ) : (
        <div className="flex h-[min(70vh,640px)] flex-col rounded-brand border border-line/10 bg-surface">
          <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
            {!messages.length && (
              <div className="grid gap-2 sm:grid-cols-2">
                {['Build me a 3-day beginner strength routine', 'How much protein should I eat to build muscle?', 'How do I warm up before deadlifts?', 'Which of your programs suits fat loss?'].map((s) => (
                  <button key={s} type="button" onClick={() => setInput(s)} className="rounded-brand border border-line/15 p-3 text-left text-sm text-muted hover:border-gold hover:text-ink">{s}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('max-w-[85%] whitespace-pre-line rounded-brand px-4 py-3 text-sm', m.role === 'user' ? 'ml-auto bg-gold/15' : 'bg-elevated')}>{m.content}</div>
            ))}
            {busy && <div className="w-24 rounded-brand bg-elevated px-4 py-3"><span className="flex gap-1" aria-label="Assistant is typing">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gold" style={{ animationDelay: `${d * 120}ms` }} />)}</span></div>}
            <div ref={end} />
          </div>
          {error && <p className="px-5 pb-2 text-sm text-danger" role="alert">{error}</p>}
          <form onSubmit={send} className="flex gap-2 border-t border-line/10 p-3">
            <label htmlFor="ask" className="sr-only">Ask a question</label>
            <input id="ask" className="input" maxLength={2000} placeholder="Ask about training, technique or nutrition…" value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit" loading={busy} disabled={!input.trim()} aria-label="Send"><Send className="h-4 w-4" aria-hidden /></Button>
          </form>
        </div>
      )}
    </>
  );
}
