import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { DataTable } from '../../components/dashboard/DataTable.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Textarea } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, formatPaise, PERIODS } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';

export default function MemberPaymentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [refund, setRefund] = useState(null);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['payments', 'me'], queryFn: async () => (await api.get('/payments/me')).data });
  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.paidAt || r.createdAt) },
    { key: 'plan', header: 'Description', render: (r) => <span>{r.plan?.name || 'Payment'}{r.period ? ` · ${PERIODS[r.period].label}` : ''}{r.invoiceNumber && <span className="block font-mono text-xs text-muted">{r.invoiceNumber}</span>}</span> },
    { key: 'amount', header: 'Amount', render: (r) => formatPaise(r.amountPaise) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: '_a', header: <span className="sr-only">Actions</span>, className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex justify-end gap-1">
        {r.invoiceNumber && <Button size="sm" variant="ghost" href={apiUrl(`/payments/${r._id}/invoice`)}><Download className="h-4 w-4" aria-hidden />Invoice</Button>}
        {r.status === 'paid' && r.method !== 'complimentary' && <Button size="sm" variant="ghost" onClick={() => setRefund(r)}><RotateCcw className="h-4 w-4" aria-hidden />Refund</Button>}
      </div>
    ) },
  ];
  const submit = async () => {
    try { toast.success((await api.post(`/payments/${refund._id}/refund-request`, { reason })).message); setRefund(null); setReason(''); qc.invalidateQueries({ queryKey: ['payments', 'me'] }); } catch (err) { toast.error(err); }
  };
  return (
    <>
      <Seo title="Payments" noindex />
      <PageHeader title="Payments & invoices" description="Download GST invoices and request refunds." />
      <DataTable caption="Payment history" columns={columns} rows={q.data} loading={q.isLoading} error={q.error} onRetry={q.refetch} empty={{ title: 'No payments yet' }} />
      <Modal open={Boolean(refund)} onClose={() => setRefund(null)} size="sm" title="Request a refund"
        footer={<><Button size="sm" variant="ghost" onClick={() => setRefund(null)}>Cancel</Button><Button size="sm" disabled={reason.trim().length < 5} onClick={submit}>Submit request</Button></>}>
        <p className="text-sm text-muted">Refunds follow the club’s refund policy and are reviewed within 3 business days. Approved refunds return to the original payment method.</p>
        <Field label="Reason" className="mt-4" required>{(a) => <Textarea {...a} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Modal>
    </>
  );
}
