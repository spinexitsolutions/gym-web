import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw } from 'lucide-react';
import { api } from '../../services/api.js';
import { useList, qs } from '../../hooks/useList.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, SearchInput, FilterSelect, Toolbar, StatusBadge, StatCard } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Textarea } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, formatPaise, PERIODS } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';
import { usePlans } from '../../components/sections/Pricing.jsx';

function RefundModal({ payment, onClose, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(payment.amountPaise / 100));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (decision) => {
    setBusy(true);
    try {
      const res = await api.post(`/payments/${payment._id}/refund`, { decision, note: note || undefined, amountPaise: decision === 'approve' ? Math.round(Number(amount) * 100) : undefined });
      onDone(res.message);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  const online = ['razorpay', 'sandbox'].includes(payment.method);
  return (
    <Modal open onClose={onClose} size="sm" title={`Refund ${payment.invoiceNumber}`}
      description={online ? 'The refund is sent to the original payment method through Razorpay.' : 'Offline payment — return the money at the desk; this records the refund.'}
      footer={(
        <>
          {payment.status === 'refund_requested' && <Button variant="ghost" size="sm" loading={busy} onClick={() => go('reject')}>Decline request</Button>}
          <Button variant="danger" size="sm" loading={busy} onClick={() => go('approve')}>Refund {formatPaise(Number(amount) * 100)}</Button>
        </>
      )}>
      {payment.refund?.reason && <p className="mb-4 rounded-brand bg-elevated p-3 text-sm">Member’s reason: “{payment.refund.reason}”</p>}
      <Field label="Amount (₹)" hint={`Paid ${formatPaise(payment.amountPaise)}. Enter less for a partial refund.`}>{(a) => <input {...a} type="number" min="1" max={payment.amountPaise / 100} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
      <Field label="Note to member" className="mt-4">{(a) => <Textarea {...a} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
    </Modal>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: plans } = usePlans();
  const [refunding, setRefunding] = useState(null);
  const { rows, meta, query, params, set } = useList('/payments', { defaults: { sort: '-createdAt' } });
  const isAdmin = ['owner', 'admin'].includes(user.role);
  const totals = meta?.totals;
  const { page: _p, ...exportParams } = params;

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber || '—'}</span> },
    { key: 'user', header: 'Member', render: (r) => <Link to={`/admin/members/${r.user?._id}`} className="hover:text-gold" onClick={(e) => e.stopPropagation()}><p className="font-medium">{r.user?.name}</p><p className="text-xs text-muted">{r.user?.email}</p></Link> },
    { key: 'plan', header: 'Plan', hideOnMobile: true, render: (r) => `${r.plan?.name || r.purpose}${r.period ? ` · ${PERIODS[r.period]?.label}` : ''}` },
    { key: 'amountPaise', header: 'Amount', sortKey: 'amountPaise', render: (r) => <span>{formatPaise(r.amountPaise)}{r.discountPaise > 0 && <span className="block text-xs text-muted">−{formatPaise(r.discountPaise)} discount</span>}</span> },
    { key: 'method', header: 'Method', hideOnMobile: true, render: (r) => <span className="capitalize">{r.method.replace('_', ' ')}</span> },
    { key: 'status', header: 'Status', render: (r) => <div><StatusBadge status={r.status} />{r.failureReason && <p className="mt-1 max-w-[12rem] text-xs text-danger">{r.failureReason}</p>}</div> },
    { key: 'createdAt', header: 'Date', sortKey: 'createdAt', render: (r) => formatDate(r.paidAt || r.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) },
    { key: '_a', header: <span className="sr-only">Actions</span>, className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex justify-end gap-1">
        {r.invoiceNumber && <a href={apiUrl(`/payments/${r._id}/invoice`)} className="rounded-full p-2 text-muted hover:text-gold" aria-label="Download invoice"><Download className="h-4 w-4" /></a>}
        {isAdmin && ['paid', 'refund_requested'].includes(r.status) && <button type="button" onClick={() => setRefunding(r)} className="rounded-full p-2 text-muted hover:text-danger" aria-label="Refund"><RotateCcw className="h-4 w-4" /></button>}
      </div>
    ) },
  ];

  return (
    <>
      <Seo title="Payments" noindex />
      <PageHeader title="Payments" description="Every transaction, verified on the server. Card details never touch this system."
        actions={isAdmin && <Button variant="outline" size="sm" href={apiUrl(`/payments/export.csv${qs(exportParams)}`)} download><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected (filtered)" value={totals ? formatPaise(totals.paid) : '—'} loading={query.isLoading} />
        <StatCard label="Refunded (filtered)" value={totals ? formatPaise(totals.refunded) : '—'} loading={query.isLoading} />
        <StatCard label="Transactions" value={totals?.count ?? '—'} loading={query.isLoading} />
      </div>
      <Toolbar>
        <SearchInput value={params.q || ''} onChange={(q) => set({ q })} placeholder="Member, invoice or payment ID" />
        <FilterSelect label="Status" value={params.status || ''} onChange={(v) => set({ status: v })}
          options={[{ value: '', label: 'All statuses' }, ...['paid', 'pending', 'failed', 'refund_requested', 'refunded'].map((s) => ({ value: s, label: s.replace('_', ' ') }))]} />
        <FilterSelect label="Plan" value={params.plan || ''} onChange={(v) => set({ plan: v })} options={[{ value: '', label: 'All plans' }, ...(plans || []).map((p) => ({ value: p._id, label: p.name }))]} />
        <FilterSelect label="Method" value={params.method || ''} onChange={(v) => set({ method: v })}
          options={[{ value: '', label: 'All methods' }, { value: 'razorpay', label: 'Razorpay' }, { value: 'cash', label: 'Cash' }, { value: 'upi_offline', label: 'UPI (desk)' }, { value: 'card_offline', label: 'Card (desk)' }, { value: 'complimentary', label: 'Complimentary' }, { value: 'sandbox', label: 'Sandbox (test)' }]} />
        <label className="flex items-center gap-2 text-xs text-muted">From<input type="date" className="input h-10 w-auto py-2" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs text-muted">To<input type="date" className="input h-10 w-auto py-2" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} /></label>
      </Toolbar>
      <DataTable caption="Payments" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch} sort={params.sort} onSort={(sort) => set({ sort })}
        empty={{ title: 'No payments found', message: 'Payments appear here once members check out or staff record offline payments.' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} onDone={(m) => { toast.success(m); setRefunding(null); qc.invalidateQueries({ queryKey: ['/payments'] }); }} />}
    </>
  );
}
