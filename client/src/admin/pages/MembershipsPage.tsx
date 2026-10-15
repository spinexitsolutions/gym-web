import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, DataTable, PageHeader, Pagination, StatusBadge, Tabs, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, relativeTime, titleCase } from '@/lib/format';
import { PersonCell, RowActions } from '../components/Bits';
import { ExportButton } from '../components/FilterBar';
import { MembershipActions } from '../components/MembershipActionsModal';
import type { AdminMembership } from '../components/types';

type View = 'active' | 'upcoming' | 'expiring7' | 'expiring14' | 'expiring30' | 'cancel_requests' | 'expired' | 'cancelled' | 'all';

const VIEWS: { value: View; label: string; query: Record<string, string | number> }[] = [
  { value: 'active', label: 'Active', query: { status: 'active' } },
  { value: 'expiring7', label: 'Expiring ≤7d', query: { expiringInDays: 7 } },
  { value: 'expiring14', label: '≤14d', query: { expiringInDays: 14 } },
  { value: 'expiring30', label: '≤30d', query: { expiringInDays: 30 } },
  { value: 'upcoming', label: 'Upcoming', query: { status: 'upcoming' } },
  { value: 'cancel_requests', label: 'Cancel requests', query: { cancellationRequested: 'true' } },
  { value: 'expired', label: 'Expired', query: { status: 'expired' } },
  { value: 'cancelled', label: 'Cancelled', query: { status: 'cancelled' } },
  { value: 'all', label: 'All', query: {} },
];

const DESCRIPTIONS: Partial<Record<View, string>> = {
  expiring7: 'Active memberships ending in the next 7 days — good candidates for a renewal call.',
  expiring14: 'Active memberships ending in the next 14 days.',
  expiring30: 'Active memberships ending in the next 30 days.',
  cancel_requests: 'Members who asked to cancel. Cancel the membership or dismiss the request (reason required).',
};

export default function MembershipsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('view') as View) || 'active';
  const [view, setView] = useState<View>(VIEWS.some((v) => v.value === initial) ? initial : 'active');
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
    setParams({ view }, { replace: true });
  }, [view, setParams]);
  const vq = VIEWS.find((v) => v.value === view)!.query;
  const list = useQuery({
    queryKey: ['admin', 'memberships', view, page],
    queryFn: () => api.getPaged<AdminMembership[]>('/memberships', { ...vq, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const requests = useQuery({ queryKey: ['admin', 'memberships', 'cancel-count'], queryFn: () => api.getPaged<AdminMembership[]>('/memberships', { cancellationRequested: 'true', limit: 1 }) });
  const reqCount = requests.data?.meta?.total;

  const columns: Column<AdminMembership>[] = [
    { key: 'member', header: 'Member', cell: (m) => <PersonCell name={m.user?.name ?? 'Deleted member'} sub={m.user?.email} /> },
    {
      key: 'plan',
      header: 'Plan',
      cell: (m) => (
        <span className="font-medium">
          {m.planName}
          {m.isTrial && <Badge className="ml-2">trial</Badge>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (m) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={m.status} />
          {m.cancellationRequestedAt && ['active', 'upcoming'].includes(m.status) && <Badge tone="warning">cancel requested</Badge>}
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Start → End',
      cell: (m) => (
        <span className="tabular-nums">
          {fmtDate(m.startDate)} → {fmtDate(m.endDate)}
          {m.daysLeft !== null && <span className={`block text-xs ${m.daysLeft <= 7 ? 'text-warning' : 'text-muted'}`}>{m.daysLeft} days left</span>}
        </span>
      ),
    },
    {
      key: 'detail',
      header: view === 'cancel_requests' ? 'Request' : 'Source',
      hideOnMobile: true,
      cell: (m) =>
        view === 'cancel_requests' && m.cancellationRequestedAt ? (
          <div className="max-w-xs">
            <p className="text-xs text-muted">{relativeTime(m.cancellationRequestedAt)}</p>
            <p className="line-clamp-2 text-sm">{m.cancelReason ?? '—'}</p>
          </div>
        ) : (
          <span className="text-muted">{titleCase(m.source)}</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (m) => (
        <RowActions>
          <MembershipActions membership={m} compact />
        </RowActions>
      ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Memberships" description="Track renewals, expiries and cancellation requests." actions={<ExportButton path="/memberships" query={vq} filename="memberships.csv" />} />
      <Tabs className="mb-3 w-fit max-w-full" tabs={VIEWS.map((v) => ({ value: v.value, label: v.label, count: v.value === 'cancel_requests' && reqCount ? reqCount : undefined }))} value={view} onChange={setView} />
      {DESCRIPTIONS[view] && <p className="mb-4 text-sm text-muted">{DESCRIPTIONS[view]}</p>}
      <div className={DESCRIPTIONS[view] ? '' : 'mt-4'}>
        <DataTable
          caption="Memberships"
          columns={columns}
          rows={list.data?.data}
          rowKey={(m) => m.id}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowClick={(m) => m.user && navigate(`/admin/members/${m.user._id}`)}
          empty={{ title: view === 'cancel_requests' ? 'No pending cancellation requests' : 'No memberships in this view', description: view.startsWith('expiring') ? 'Nobody’s membership ends in this window.' : undefined }}
        />
      </div>
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
    </div>
  );
}
