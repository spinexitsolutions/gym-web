import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { NotificationItem } from '@/types/api';

/** Notification center shared by member, trainer and admin dashboards. */
export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['notifications', filter, page],
    queryFn: () => api.getPaged<NotificationItem[]>('/notifications/me', { page, limit: 20, unread: filter === 'unread' ? 'true' : undefined }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => (invalidate(), toast.success('All caught up')) });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Bookings, payments, membership reminders and messages from the team."
        actions={
          <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      <Tabs
        className="mb-5 w-fit"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: (q.data?.meta?.unreadCount as number) ?? undefined },
        ]}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !q.data?.data.length ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="We’ll let you know about bookings, payments and reminders here." />
      ) : (
        <ul className="space-y-2">
          {q.data.data.map((n) => (
            <li key={n._id} className={cn('card flex items-start gap-4 p-4', !n.readAt && 'ring-1 ring-primary/30')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-fg/15' : 'bg-primary')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <time dateTime={n.createdAt}>{relativeTime(n.createdAt)}</time>
                  {n.link && n.link.startsWith('/') && (
                    <Link to={n.link} className="text-primary hover:underline" onClick={() => !n.readAt && markRead.mutate(n._id)}>
                      Open
                    </Link>
                  )}
                  {!n.readAt && (
                    <button className="hover:text-fg" onClick={() => markRead.mutate(n._id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data?.meta && <Pagination page={page} pages={q.data.meta.pages} total={q.data.meta.total} onPage={setPage} />}
    </div>
  );
}
