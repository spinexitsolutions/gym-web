import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus, Download } from 'lucide-react';
import { api } from '../../services/api.js';
import { useList } from '../../hooks/useList.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from '../../components/dashboard/DataTable.jsx';
import { PageHeader, SearchInput, FilterSelect, Toolbar, StatusBadge } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { apiUrl } from '../../utils/download.js';
import { qs } from '../../hooks/useList.js';

function AddMember({ onClose, onCreated }) {
  const [error, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm();
  const submit = async (v) => {
    try { onCreated(await api.post('/members', v)); } catch (err) { setFormError(applyServerErrors(err, setError)); }
  };
  return (
    <Modal open onClose={onClose} title="Add walk-in member" description="The member receives an email to set their own password." size="sm"
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(submit)}>Create & invite</Button></>}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <FormAlert>{error}</FormAlert>
        <TextField label="Full name" name="name" register={register} errors={errors} required />
        <TextField label="Email" name="email" type="email" register={register} errors={errors} required />
        <TextField label="Phone" name="phone" type="tel" register={register} errors={errors} />
      </form>
    </Modal>
  );
}

export default function MembersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const { rows, meta, query, params, set } = useList('/members', { defaults: { sort: '-createdAt' } });
  const isAdmin = ['owner', 'admin'].includes(user.role);
  const { page: _p, ...exportParams } = params;

  const columns = [
    { key: 'name', header: 'Member', sortKey: 'name', render: (r) => (
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-elevated">{r.avatar?.url ? <Img image={r.avatar} alt="" sizes="36px" className="h-full w-full" /> : <span className="grid h-full place-items-center text-sm text-gold">{r.name[0]}</span>}</span>
        <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.email}</p></div>
      </div>
    ) },
    { key: 'phone', header: 'Phone', hideOnMobile: true },
    { key: 'membership', header: 'Membership', render: (r) => <div className="flex flex-col gap-1"><StatusBadge status={r.membershipState} />{r.membership?.plan && <span className="text-xs text-muted">{r.membership.plan.name}</span>}</div> },
    { key: 'membershipEnd', header: 'Ends', sortKey: 'membershipEnd', render: (r) => (r.membership?.endDate ? formatDate(r.membership.endDate) : '—') },
    { key: 'status', header: 'Account', render: (r) => <div className="flex flex-wrap gap-1"><StatusBadge status={r.status} />{!r.emailVerified && <Badge>unverified</Badge>}{r.deletionRequestedAt && <Badge tone="danger">deletion requested</Badge>}</div> },
    { key: 'createdAt', header: 'Joined', sortKey: 'createdAt', hideOnMobile: true, render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <>
      <Seo title="Members" noindex />
      <PageHeader title="Members" description="Search, filter and manage member accounts and memberships."
        actions={(
          <>
            {isAdmin && <Button variant="outline" size="sm" href={apiUrl(`/members/export.csv${qs(exportParams)}`)} download><Download className="h-4 w-4" aria-hidden />Export CSV</Button>}
            <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" aria-hidden />Add member</Button>
          </>
        )} />
      <Toolbar>
        <SearchInput value={params.q || ''} onChange={(q) => set({ q })} placeholder="Name, email or phone" />
        <FilterSelect label="Membership" value={params.membership || ''} onChange={(v) => set({ membership: v })}
          options={[{ value: '', label: 'Any membership' }, { value: 'active', label: 'Active' }, { value: 'expiring', label: 'Expiring in 14 days' }, { value: 'expired', label: 'Expired' }, { value: 'none', label: 'Never purchased' }]} />
        <FilterSelect label="Account" value={params.status || ''} onChange={(v) => set({ status: v })}
          options={[{ value: '', label: 'Any account status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={params.deletionRequested === 'true'} onChange={(e) => set({ deletionRequested: e.target.checked ? 'true' : '' })} className="accent-[rgb(var(--accent))]" />Deletion requests</label>
      </Toolbar>
      <DataTable caption="Members" columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch}
        sort={params.sort} onSort={(sort) => set({ sort })} onRowClick={(r) => navigate(`/admin/members/${r._id}`)}
        empty={{ title: 'No members found', message: 'Adjust the filters or add a walk-in member.' }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
      {adding && <AddMember onClose={() => setAdding(false)} onCreated={(res) => { toast.success(res.message); setAdding(false); qc.invalidateQueries({ queryKey: ['/members'] }); navigate(`/admin/members/${res.data.id}`); }} />}
      <p className="mt-6 text-xs text-muted">Tip: open a member to assign a plan, record a cash payment or check them in. <Link to="/admin/check-in" className="text-gold hover:underline">Front desk check-in</Link></p>
    </>
  );
}
