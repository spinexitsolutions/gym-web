import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Check, UserX } from 'lucide-react';
import { api } from '../../services/api.js';
import { useList, qs } from '../../hooks/useList.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, FilterSelect, Toolbar, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';

export default function BookingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { rows, meta, query, params, set } = useList('/bookings', { defaults: { sort: '-startAt' } });
  const trainers = useQuery({ queryKey: ['options', 'trainers-active'], queryFn: async () => (await api.get('/admin/trainers?limit=100&isActive=true')).data });
  const mark = async (b, status) => {
    try { toast.success((await api.patch(`/bookings/${b._id}/status`, { status })).message); qc.invalidateQueries({ queryKey: ['/bookings'] }); } catch (err) { toast.error(err); }
  };
  const { page: _p, ...exportParams } = params;
  const columns = [
    { key: 'startAt', header: 'When', sortKey: 'startAt', render: (r) => formatDate(r.startAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
    { key: 'member', header: 'Member', render: (r) => <Link to={`/admin/members/${r.member?._id}`} className="hover:text-gold"><p className="font-medium">{r.member?.name}</p><p className="text-xs text-muted">{r.member?.phone || r.member?.email}</p></Link> },
    { key: 'type', header: 'Session', render: (r) => (r.type === 'class' ? r.classSchedule?.title : 'Personal training') },
    { key: 'trainer', header: 'Trainer', hideOnMobile: true, render: (r) => r.trainer?.name },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: '_a', header: <span className="sr-only">Actions</span>, className: 'text-right whitespace-nowrap', render: (r) => (r.status === 'booked' && new Date(r.startAt) < new Date() ? (
      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => mark(r, 'completed')} className="rounded-full p-2 text-muted hover:text-success" aria-label="Mark completed"><Check className="h-4 w-4" /></button>
        <button type="button" onClick={() => mark(r, 'no_show')} className="rounded-full p-2 text-muted hover:text-danger" aria-label="Mark no-show"><UserX className="h-4 w-4" /></button>
      </div>
    ) : null) },
  ];
  return (
    <>
      <Seo title="Bookings" noindex />
      <PageHeader title="Bookings" description="Personal training and class bookings across all trainers."
        actions={<Button variant="outline" size="sm" href={apiUrl(`/bookings/export.csv${qs(exportParams)}`)} download><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
      <Toolbar>
        <FilterSelect label="Type" value={params.type || ''} onChange={(v) => set({ type: v })} options={[{ value: '', label: 'All types' }, { value: 'personal_training', label: 'Personal training' }, { value: 'class', label: 'Classes' }]} />
        <FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All statuses' }, ...['booked', 'waitlisted', 'completed', 'no_show', 'cancelled'].map((s) => ({ value: s, label: s.replace('_', ' ') }))]} />
        <FilterSelect label="Trainer" value={params.trainer || ''} onChange={(v) => set({ trainer: v })} options={[{ value: '', label: 'All trainers' }, ...(trainers.data || []).map((t) => ({ value: t._id, label: t.name }))]} />
        <label className="flex items-center gap-2 text-xs text-muted">From<input type="date" className="input h-10 w-auto py-2" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs text-muted">To<input type="date" className="input h-10 w-auto py-2" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} /></label>
      </Toolbar>
      <DataTable caption="Bookings" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} sort={params.sort} onSort={(sort) => set({ sort })} empty={{ title: 'No bookings match' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
    </>
  );
}
