import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, KeyValue, Select, Skeleton, StatusBadge, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime, titleCase } from '@/lib/format';
import type { SupportTicket } from '../components/types';
import { priorityTone } from './SupportPage';

export default function SupportTicketPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['admin', 'support', 'ticket', id], queryFn: () => api.get<SupportTicket>(`/support/${id}`), refetchInterval: 30_000 });
  const t = q.data;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [t?.messages.length]);

  const send = useMutation({
    mutationFn: () => api.post<SupportTicket>(`/support/${id}/messages`, { body: reply.trim() }),
    onSuccess: (nt) => {
      qc.setQueryData(['admin', 'support', 'ticket', id], { ...nt, user: t?.user ?? nt.user });
      void qc.invalidateQueries({ queryKey: ['admin', 'support'] });
      setReply('');
      toast.success('Reply sent', 'The member was notified.');
    },
    onError: (err) => toast.error(err),
  });
  const patch = useMutation({
    mutationFn: (body: Partial<Pick<SupportTicket, 'status' | 'priority'>>) => api.patch<SupportTicket>(`/support/${id}`, body),
    onSuccess: (nt, v) => {
      qc.setQueryData(['admin', 'support', 'ticket', id], { ...nt, user: t?.user ?? nt.user });
      void qc.invalidateQueries({ queryKey: ['admin', 'support'] });
      toast.success(v.status ? `Marked ${titleCase(v.status).toLowerCase()}` : `Priority set to ${v.priority}`);
    },
    onError: (err) => toast.error(err),
  });

  const back = (
    <Link to="/admin/support" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeft className="h-4 w-4" /> Support
    </Link>
  );
  if (q.error)
    return (
      <div>
        {back}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    );
  if (!t)
    return (
      <div>
        {back}
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-96" />
      </div>
    );

  const closed = t.status === 'closed';
  return (
    <div>
      {back}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t.subject}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={t.status} />
            <Badge tone={priorityTone[t.priority]}>{t.priority} priority</Badge>
            <span>{titleCase(t.category)}</span>
            <span>· opened {relativeTime(t.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status !== 'resolved' && !closed && (
            <Button variant="secondary" size="sm" loading={patch.isPending && patch.variables?.status === 'resolved'} onClick={() => patch.mutate({ status: 'resolved' })}>
              Mark resolved
            </Button>
          )}
          {closed || t.status === 'resolved' ? (
            <Button variant="secondary" size="sm" onClick={() => patch.mutate({ status: 'open' })}>
              Reopen
            </Button>
          ) : null}
          {!closed && (
            <Button variant="ghost" size="sm" onClick={() => patch.mutate({ status: 'closed' })}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex flex-col">
          <ol className="scrollbar-thin max-h-[60vh] flex-1 space-y-4 overflow-y-auto p-5" aria-label="Conversation">
            {t.messages.map((m) => (
              <li key={m._id} className={cn('flex gap-3', m.staff && 'flex-row-reverse')}>
                <Avatar name={m.authorName ?? (m.staff ? 'Staff' : 'Member')} size={32} />
                <div className={cn('max-w-[80%] rounded-theme px-4 py-3', m.staff ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-fg/[0.05] ring-1 ring-line')}>
                  <p className="mb-1 text-xs text-muted">
                    <span className="font-medium text-fg">{m.authorName ?? (m.staff ? 'Staff' : 'Member')}</span> {m.staff && <Badge className="ml-1">staff</Badge>} · <time title={fmtDateTime(m.createdAt)}>{relativeTime(m.createdAt)}</time>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </div>
              </li>
            ))}
            <div ref={bottom} />
          </ol>
          <div className="border-t border-line/70 p-4">
            {closed ? (
              <Alert tone="info">This ticket is closed. Reopen it to reply.</Alert>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) send.mutate();
                }}
              >
                <Textarea
                  label="Reply"
                  rows={4}
                  maxLength={4000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply… (Ctrl/⌘ + Enter to send)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reply.trim()) send.mutate();
                  }}
                  hint={t.status === 'open' ? 'Replying moves the ticket to “in progress”.' : `${reply.length}/4000`}
                />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" icon={<Send className="h-4 w-4" />} loading={send.isPending} disabled={!reply.trim()}>
                    Send reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Member" />
            <CardBody>
              {t.user ? (
                <div className="flex items-center gap-3">
                  <Avatar name={t.user.name} size={40} />
                  <div className="min-w-0">
                    <Link to={`/admin/members/${t.user._id}`} className="block truncate font-medium hover:text-primary">
                      {t.user.name}
                    </Link>
                    <a href={`mailto:${t.user.email}`} className="block truncate text-xs text-muted hover:text-fg">
                      {t.user.email}
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Unknown member</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Ticket" />
            <CardBody className="space-y-4">
              <Select
                label="Status"
                value={t.status}
                disabled={patch.isPending}
                onChange={(e) => patch.mutate({ status: e.target.value as SupportTicket['status'] })}
                options={(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => ({ value: s, label: titleCase(s) }))}
              />
              <Select label="Priority" value={t.priority} disabled={patch.isPending} onChange={(e) => patch.mutate({ priority: e.target.value as SupportTicket['priority'] })} options={(['low', 'normal', 'high'] as const).map((s) => ({ value: s, label: titleCase(s) }))} />
              <KeyValue className="sm:grid-cols-1" items={[{ label: 'Created', value: fmtDateTime(t.createdAt) }, { label: 'Updated', value: fmtDateTime(t.updatedAt) }, { label: 'Messages', value: t.messages.length }]} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
