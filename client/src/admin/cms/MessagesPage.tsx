import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Inbox, Mail, MailOpen, Phone, Reply } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Tabs, useToast } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime } from '@/lib/format';

interface Message {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}
type Filter = 'new' | 'read' | 'archived' | 'all';

export default function MessagesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['cms-messages', filter, page],
    placeholderData: keepPreviousData,
    queryFn: () => apiRequest<Message[]>('/cms/admin/messages', { query: { status: filter === 'all' ? undefined : filter, page, limit: 25 } }),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: Message['status'] }) => api.patch<Message>(`/cms/admin/messages/${v.id}`, { status: v.status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-messages'] }),
    onError: (e) => toast.error(e),
  });
  const items = list.data?.data ?? [];
  const selected = items.find((m) => m._id === openId) ?? null;

  const openMessage = (m: Message) => {
    setOpenId(m._id);
    if (m.status === 'new') setStatus.mutate({ id: m._id, status: 'read' });
  };

  return (
    <div>
      <PageHeader eyebrow="Website" title="Messages" description="Enquiries sent through the website contact form. Opening a message marks it as read." />
      <Tabs
        className="mb-5 w-fit"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
          setOpenId(null);
        }}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'new', label: 'Unread' },
          { value: 'read', label: 'Read' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <Skeleton className="h-80" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="Inbox zero" description="No messages in this view." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <ul className="card divide-y divide-line/70 overflow-hidden" aria-label="Messages">
            {items.map((m) => (
              <li key={m._id}>
                <button type="button" onClick={() => openMessage(m)} aria-current={m._id === openId ? 'true' : undefined} className={cn('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-fg/[0.03]', m._id === openId && 'bg-primary/[0.07]')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', m.status === 'new' ? 'bg-primary' : 'bg-transparent')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', m.status === 'new' ? 'font-semibold' : 'font-medium text-fg/85')}>{m.name}</span>
                      <span className="shrink-0 text-[0.7rem] text-muted">{relativeTime(m.createdAt)}</span>
                    </span>
                    <span className="block truncate text-xs text-fg/75">{m.subject || '(no subject)'}</span>
                    <span className="block truncate text-xs text-muted">{m.message}</span>
                  </span>
                  {m.status === 'new' && <span className="sr-only">Unread</span>}
                </button>
              </li>
            ))}
          </ul>
          <div>
            {selected ? (
              <article className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{selected.subject || '(no subject)'}</h2>
                    <p className="mt-1 text-sm">
                      {selected.name} · <a className="text-primary hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a>
                    </p>
                    <p className="text-xs text-muted">{fmtDateTime(selected.createdAt)}</p>
                  </div>
                  <Badge tone={selected.status === 'new' ? 'primary' : 'neutral'}>{selected.status}</Badge>
                </div>
                <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-fg/90">{selected.message}</p>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-line/70 pt-4">
                  <a className="btn btn-primary btn-sm" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject || 'Your enquiry'}`)}`}>
                    <Reply className="h-3.5 w-3.5" /> Reply by email
                  </a>
                  {selected.phone && (
                    <a className="btn btn-secondary btn-sm" href={`tel:${selected.phone}`}>
                      <Phone className="h-3.5 w-3.5" /> {selected.phone}
                    </a>
                  )}
                  {selected.status !== 'new' && selected.status !== 'archived' && (
                    <Button size="sm" variant="ghost" icon={<Mail className="h-3.5 w-3.5" />} onClick={() => setStatus.mutate({ id: selected._id, status: 'new' })}>
                      Mark unread
                    </Button>
                  )}
                  {selected.status === 'archived' ? (
                    <Button size="sm" variant="ghost" icon={<ArchiveRestore className="h-3.5 w-3.5" />} onClick={() => setStatus.mutate({ id: selected._id, status: 'read' })}>
                      Move to inbox
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<Archive className="h-3.5 w-3.5" />} onClick={() => (setStatus.mutate({ id: selected._id, status: 'archived' }), toast.success('Archived'))}>
                      Archive
                    </Button>
                  )}
                </div>
              </article>
            ) : (
              <div className="card grid h-full min-h-[240px] place-items-center p-6 text-center text-sm text-muted">
                <div>
                  <MailOpen className="mx-auto mb-2 h-6 w-6" />
                  Select a message to read it.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
    </div>
  );
}
