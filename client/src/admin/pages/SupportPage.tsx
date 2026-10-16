import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, DataTable, PageHeader, Pagination, StatusBadge, Tabs, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { relativeTime, titleCase } from '@/lib/format';
import { PersonCell } from '../components/Bits';
import type { SupportTicket } from '../components/types';

type Status = 'open' | 'in_progress' | 'resolved' | 'closed' | 'all';
export const priorityTone = { high: 'danger', normal: 'neutral', low: 'info' } as const;

export default function SupportPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('open');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status]);
  const q = useQuery({
    queryKey: ['admin', 'support', status, page],
    queryFn: () => api.getPaged<SupportTicket[]>('/support', { scope: 'all', status: status === 'all' ? undefined : status, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const openCount = useQuery({ queryKey: ['admin', 'support', 'count', 'open'], queryFn: () => api.getPaged<SupportTicket[]>('/support', { scope: 'all', status: 'open', limit: 1 }) });
  const progressCount = useQuery({ queryKey: ['admin', 'support', 'count', 'in_progress'], queryFn: () => api.getPaged<SupportTicket[]>('/support', { scope: 'all', status: 'in_progress', limit: 1 }) });

  const columns: Column<SupportTicket>[] = [
    {
      key: 'subject',
      header: 'Subject',
      cell: (t) => {
        const last = t.messages[t.messages.length - 1];
        return <PersonCell name={t.subject} sub={last ? `${last.staff ? 'Staff' : 'Member'}: ${last.body.slice(0, 80)}` : undefined} />;
      },
    },
    { key: 'member', header: 'Member', cell: (t) => <PersonCell name={t.user?.name ?? '—'} sub={t.user?.email} /> },
    { key: 'category', header: 'Category', hideOnMobile: true, cell: (t) => <span className="text-muted">{titleCase(t.category)}</span> },
    { key: 'priority', header: 'Priority', cell: (t) => <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge> },
    { key: 'status', header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'waiting',
      header: 'Last update',
      hideOnMobile: true,
      cell: (t) => {
        const last = t.messages[t.messages.length - 1];
        const awaiting = last && !last.staff && ['open', 'in_progress'].includes(t.status);
        return (
          <span className="text-xs">
            <span className="text-muted">{relativeTime(t.updatedAt)}</span>
            {awaiting && <span className="block text-warning">awaiting reply</span>}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Support" description="Member tickets about memberships, payments, bookings and the facility." />
      <Tabs
        className="mb-4 w-fit max-w-full"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'open', label: 'Open', count: openCount.data?.meta?.total },
          { value: 'in_progress', label: 'In progress', count: progressCount.data?.meta?.total },
          { value: 'resolved', label: 'Resolved' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ]}
      />
      <DataTable
        caption="Support tickets"
        columns={columns}
        rows={q.data?.data}
        rowKey={(t) => t._id}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(t) => navigate(`/admin/support/${t._id}`)}
        empty={{ title: status === 'open' ? 'Inbox zero' : 'No tickets here', description: status === 'open' ? 'No open tickets. New member tickets also arrive as notifications.' : undefined }}
      />
      {q.data?.meta && <Pagination page={q.data.meta.page} pages={q.data.meta.pages} total={q.data.meta.total} onPage={setPage} />}
    </div>
  );
}
