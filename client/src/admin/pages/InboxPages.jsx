import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, MessageCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { useList } from '../../hooks/useList.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, SearchInput, FilterSelect, Toolbar, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { TicketThread } from '../../components/dashboard/TicketThread.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Textarea, Select } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, whatsappLink } from '../../utils/format.js';

function InquiryModal({ inquiry, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(inquiry.status);
  const [note, setNote] = useState('');
  const save = async () => {
    try { onSaved((await api.patch(`/admin/inquiries/${inquiry._id}`, { status, note: note.trim() || undefined })).message); } catch (err) { toast.error(err); }
  };
  return (
    <Modal open onClose={onClose} title={inquiry.name} description={`${inquiry.interest?.replace('_', ' ') || 'General'} · ${formatDate(inquiry.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save}>Save</Button></>}>
      <div className="mb-5 flex flex-wrap gap-2">
        {inquiry.phone && <Button size="sm" variant="outline" href={`tel:${inquiry.phone}`}><Phone className="h-4 w-4" aria-hidden />Call</Button>}
        <Button size="sm" variant="outline" href={`mailto:${inquiry.email}`}><Mail className="h-4 w-4" aria-hidden />Email</Button>
        {inquiry.phone && <Button size="sm" variant="outline" href={whatsappLink(inquiry.phone.replace(/^0/, '91'), `Hi ${inquiry.name.split(' ')[0]}, thanks for contacting us!`)}><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</Button>}
      </div>
      <p className="text-sm text-muted">{inquiry.email}{inquiry.phone && ` · ${inquiry.phone}`}</p>
      {inquiry.subject && <p className="mt-3 font-medium">{inquiry.subject}</p>}
      <p className="mt-2 whitespace-pre-line rounded-brand bg-elevated p-4 text-sm">{inquiry.message}</p>
      {inquiry.notes?.length > 0 && (
        <ul className="mt-5 space-y-2">{inquiry.notes.map((n, i) => <li key={i} className="rounded-brand border border-line/10 p-3 text-sm"><p className="text-xs text-muted">{n.by?.name} · {formatDate(n.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p><p className="mt-1">{n.text}</p></li>)}</ul>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Status">{(a) => <Select {...a} value={status} onChange={(e) => setStatus(e.target.value)}>{['new', 'in_progress', 'resolved', 'spam'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>}</Field>
        <Field label="Add note">{(a) => <Textarea {...a} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called, booked a trial for Saturday…" />}</Field>
      </div>
    </Modal>
  );
}

export function InquiriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(null);
  const { rows, meta, query, params, set } = useList('/admin/inquiries');
  const counts = meta?.counts || {};
  const columns = [
    { key: 'name', header: 'From', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.phone || r.email}</p></div> },
    { key: 'interest', header: 'Interest', render: (r) => <span className="capitalize">{r.interest?.replace('_', ' ') || '—'}</span> },
    { key: 'message', header: 'Message', hideOnMobile: true, render: (r) => <p className="line-clamp-2 max-w-md text-muted">{r.message}</p> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Received', sortKey: 'createdAt', render: (r) => formatDate(r.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
  ];
  return (
    <>
      <Seo title="Inquiries" noindex />
      <PageHeader title="Inquiries" description="Leads from the contact forms. Follow up and record what happened." />
      <Toolbar>
        <SearchInput value={params.q || ''} onChange={(q) => set({ q })} placeholder="Name, email, phone or message" />
        <FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v })}
          options={[{ value: '', label: 'All' }, ...['new', 'in_progress', 'resolved', 'spam'].map((s) => ({ value: s, label: `${s.replace('_', ' ')}${counts[s] ? ` (${counts[s]})` : ''}` }))]} />
      </Toolbar>
      <DataTable caption="Inquiries" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} sort={params.sort} onSort={(sort) => set({ sort })} onRowClick={setOpen} empty={{ title: 'No inquiries' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
      {open && <InquiryModal inquiry={open} onClose={() => setOpen(null)} onSaved={(m) => { toast.success(m); setOpen(null); qc.invalidateQueries({ queryKey: ['/admin/inquiries'] }); }} />}
    </>
  );
}

export function SupportListPage() {
  const navigate = useNavigate();
  const { rows, meta, query, params, set } = useList('/support', { defaults: { sort: '-updatedAt' } });
  const columns = [
    { key: 'subject', header: 'Subject', render: (r) => <div><p className="font-medium">{r.subject}</p><p className="text-xs text-muted">{r.user?.name} · {r.messageCount} messages</p></div> },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'priority', header: 'Priority', render: (r) => <span className={r.priority === 'high' ? 'text-danger' : 'capitalize'}>{r.priority}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'updatedAt', header: 'Updated', sortKey: 'updatedAt', render: (r) => formatDate(r.updatedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
  ];
  return (
    <>
      <Seo title="Support" noindex />
      <PageHeader title="Support tickets" description="Member questions and issues." />
      <Toolbar>
        <FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All' }, ...['open', 'pending', 'resolved', 'closed'].map((s) => ({ value: s, label: s }))]} />
        <FilterSelect label="Category" value={params.category || ''} onChange={(v) => set({ category: v })} options={[{ value: '', label: 'All categories' }, ...['membership', 'payment', 'booking', 'facility', 'trainer', 'account', 'other'].map((s) => ({ value: s, label: s }))]} />
      </Toolbar>
      <DataTable caption="Support tickets" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} sort={params.sort} onSort={(sort) => set({ sort })} onRowClick={(r) => navigate(`/admin/support/${r._id}`)} empty={{ title: 'No tickets' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
    </>
  );
}

export function SupportTicketPage() {
  const { id } = useParams();
  return (
    <>
      <Seo title="Support ticket" noindex />
      <Link to="/admin/support" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" aria-hidden />All tickets</Link>
      <TicketThread id={id} staff />
    </>
  );
}

export function ReviewsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { rows, meta, query, params, set } = useList('/admin/reviews', { defaults: { status: 'pending' } });
  const moderate = async (r, status) => {
    try { toast.success((await api.patch(`/admin/reviews/${r._id}`, { status })).message); qc.invalidateQueries({ queryKey: ['/admin/reviews'] }); } catch (err) { toast.error(err); }
  };
  const columns = [
    { key: 'user', header: 'Member', render: (r) => r.user?.name },
    { key: 'target', header: 'About', render: (r) => (r.targetType === 'gym' ? 'The club' : r.target?.name) },
    { key: 'rating', header: 'Rating', render: (r) => <span className="text-gold">{'★'.repeat(r.rating)}</span> },
    { key: 'comment', header: 'Comment', render: (r) => <p className="max-w-md text-muted">{r.comment || '—'}</p> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: '_a', header: <span className="sr-only">Actions</span>, className: 'whitespace-nowrap text-right', render: (r) => (
      <div className="flex justify-end gap-2">
        {r.status !== 'approved' && <Button size="sm" variant="outline" onClick={() => moderate(r, 'approved')}>Approve</Button>}
        {r.status !== 'rejected' && <Button size="sm" variant="ghost" onClick={() => moderate(r, 'rejected')}>Reject</Button>}
      </div>
    ) },
  ];
  return (
    <>
      <Seo title="Reviews" noindex />
      <PageHeader title="Reviews" description="Approve member ratings before they appear on trainer profiles. Approved ratings update the trainer’s average." />
      <Toolbar><FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} /></Toolbar>
      <DataTable caption="Reviews" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} empty={{ title: 'Nothing to moderate' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
    </>
  );
}
