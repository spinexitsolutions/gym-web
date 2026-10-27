import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api.js';
import { useList } from '../../hooks/useList.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, SearchInput, FilterSelect, Toolbar, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Field, Select, Textarea } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, PERIODS } from '../../utils/format.js';

function ManageModal({ m, onClose, onDone }) {
  const toast = useToast();
  const [endDate, setEndDate] = useState(String(m.endDate).slice(0, 10));
  const [status, setStatus] = useState(m.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = m.cancellation?.status === 'requested';
  const call = async (fn) => { setBusy(true); try { onDone((await fn()).message); } catch (err) { toast.error(err); } finally { setBusy(false); } };
  return (
    <Modal open onClose={onClose} size="sm" title={`${m.user?.name} — ${m.plan?.name}`} description={`${formatDate(m.startDate)} – ${formatDate(m.endDate)}`}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" loading={busy} onClick={() => call(() => api.patch(`/memberships/${m._id}`, { status, endDate: new Date(`${endDate}T23:59:59`).toISOString(), reason }))}>Save changes</Button></>}>
      {pending && (
        <div className="mb-5 rounded-brand border border-gold/40 bg-gold/5 p-4">
          <p className="text-sm font-semibold">Cancellation requested {formatDate(m.cancellation.requestedAt)}</p>
          <p className="mt-1 text-sm text-muted">“{m.cancellation.reason}”</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" loading={busy} onClick={() => call(() => api.post(`/memberships/${m._id}/cancellation`, { decision: 'approve', note: reason || undefined }))}>Approve cancellation</Button>
            <Button size="sm" variant="ghost" loading={busy} onClick={() => call(() => api.post(`/memberships/${m._id}/cancellation`, { decision: 'reject', note: reason || undefined }))}>Reject</Button>
          </div>
          <p className="mt-2 text-xs text-muted">Refunds are handled separately from the Payments page.</p>
        </div>
      )}
      <div className="space-y-4">
        <Field label="Status">{(a) => <Select {...a} value={status} onChange={(e) => setStatus(e.target.value)}>{['active', 'suspended', 'cancelled', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>}</Field>
        <Field label="End date" hint="Extend for a freeze, compensation or correction">{(a) => <input {...a} type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}</Field>
        <Field label="Reason / note" hint="Required for changes; recorded in the audit log">{(a) => <Textarea {...a} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

export default function MembershipsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [managing, setManaging] = useState(null);
  const { rows, meta, query, params, set } = useList('/memberships');
  const isAdmin = ['owner', 'admin'].includes(user.role);
  const columns = [
    { key: 'user', header: 'Member', render: (r) => <Link to={`/admin/members/${r.user?._id}`} onClick={(e) => e.stopPropagation()} className="hover:text-gold"><p className="font-medium">{r.user?.name}</p><p className="text-xs text-muted">{r.user?.phone || r.user?.email}</p></Link> },
    { key: 'plan', header: 'Plan', render: (r) => `${r.plan?.name} · ${PERIODS[r.period]?.label}` },
    { key: 'startDate', header: 'Start', sortKey: 'startDate', hideOnMobile: true, render: (r) => formatDate(r.startDate) },
    { key: 'endDate', header: 'End', sortKey: 'endDate', render: (r) => formatDate(r.endDate) },
    { key: 'status', header: 'Status', render: (r) => <div className="flex flex-wrap gap-1"><StatusBadge status={r.status} />{r.cancellation?.status === 'requested' && <Badge tone="gold">cancel requested</Badge>}{!r.payment && r.assignedBy && <Badge>assigned</Badge>}</div> },
  ];
  return (
    <>
      <Seo title="Memberships" noindex />
      <PageHeader title="Memberships" description="Active and expired memberships, upcoming renewals and cancellation requests." />
      <Toolbar>
        <SearchInput value={params.q || ''} onChange={(q) => set({ q })} placeholder="Member name, email or phone" />
        <FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v, expiringInDays: '' })}
          options={[{ value: '', label: 'All statuses' }, ...['active', 'pending', 'expired', 'cancelled', 'suspended'].map((s) => ({ value: s, label: s }))]} />
        <FilterSelect label="Expiring" value={params.expiringInDays || ''} onChange={(v) => set({ expiringInDays: v, status: '' })}
          options={[{ value: '', label: 'Any end date' }, { value: '7', label: 'Ending in 7 days' }, { value: '14', label: 'Ending in 14 days' }, { value: '30', label: 'Ending in 30 days' }]} />
        <FilterSelect label="Cancellation" value={params.cancellation || ''} onChange={(v) => set({ cancellation: v })}
          options={[{ value: '', label: 'Any' }, { value: 'requested', label: 'Requested' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      </Toolbar>
      <DataTable caption="Memberships" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch}
        sort={params.sort} onSort={(sort) => set({ sort })} onRowClick={isAdmin ? setManaging : undefined} empty={{ title: 'No memberships match these filters' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
      {managing && <ManageModal m={managing} onClose={() => setManaging(null)} onDone={(msg) => { toast.success(msg); setManaging(null); qc.invalidateQueries({ queryKey: ['/memberships'] }); }} />}
    </>
  );
}
