import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Avatar, Badge, Button, ConfirmDialog, ErrorState, Skeleton, StatusBadge, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, titleCase } from '@/lib/format';
import type { SupportTicket } from '../components/types';

export default function SupportTicketPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const key = ['member', 'support', 'ticket', id];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<SupportTicket>(`/support/${id}`), refetchInterval: 30_000 });

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [q.data?.messages.length]);

  const onTicket = (t: SupportTicket) => {
    qc.setQueryData(key, t);
    void qc.invalidateQueries({ queryKey: ['member', 'support'], exact: false, refetchType: 'none' });
  };
  const send = useMutation({
    mutationFn: () => api.post<SupportTicket>(`/support/${id}/messages`, { body: reply.trim() }),
    onSuccess: (t) => {
      setReply('');
      onTicket(t);
    },
    onError: (err) => toast.error(err),
  });
  const close = useMutation({
    mutationFn: () => api.patch<SupportTicket>(`/support/${id}`, { status: 'closed' }),
    onSuccess: (t) => {
      setConfirmClose(false);
      onTicket(t);
      toast.success('Ticket closed', 'Thanks — open a new ticket any time.');
    },
    onError: (err) => toast.error(err),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  const closed = t?.status === 'closed';

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/member/support" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>
      {!t ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="card flex flex-col">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 p-5">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold">{t.subject}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <StatusBadge status={t.status} />
                <Badge>{titleCase(t.category)}</Badge>
                <span>Opened {fmtDateTime(t.createdAt)}</span>
              </div>
            </div>
            {!closed && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)}>
                Close ticket
              </Button>
            )}
          </header>
          <ol className="space-y-4 p-5" aria-label="Conversation">
            {t.messages.map((m, i) => {
              const mine = !m.staff;
              return (
                <motion.li key={m._id ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                  <Avatar name={m.authorName ?? (mine ? (user?.name ?? 'You') : 'Team')} src={mine ? user?.avatarUrl || undefined : undefined} size={32} />
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 text-sm', mine ? 'rounded-tr-sm bg-primary/15' : 'rounded-tl-sm bg-fg/[0.05]')}>
                    <p className="mb-1 text-xs font-semibold">
                      {mine ? 'You' : (m.authorName ?? 'Support team')}
                      {m.staff && <span className="ml-1.5 font-normal text-primary">Staff</span>}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="mt-1.5 text-[0.68rem] text-muted">{fmtDateTime(m.createdAt)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          <div ref={endRef} />
          <footer className="border-t border-line/70 p-4">
            {closed ? (
              <p className="flex items-center justify-center gap-2 text-sm text-muted">
                <Lock className="h-4 w-4" /> This ticket is closed. <Link to="/member/support" className="text-primary hover:underline">Open a new one</Link> if you need more help.
              </p>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) send.mutate();
                }}
              >
                <Textarea
                  aria-label="Reply"
                  wrapClassName="flex-1"
                  rows={2}
                  maxLength={4000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reply.trim()) send.mutate();
                  }}
                  placeholder="Write a reply… (Ctrl+Enter to send)"
                />
                <Button type="submit" loading={send.isPending} disabled={!reply.trim()} icon={<Send className="h-4 w-4" />} aria-label="Send reply">
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            )}
          </footer>
        </div>
      )}
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={() => close.mutate()} loading={close.isPending} title="Close this ticket?" confirmLabel="Close ticket">
        <p className="text-sm text-muted">Closed tickets can’t receive new replies. You can always open a new one.</p>
      </ConfirmDialog>
    </div>
  );
}
