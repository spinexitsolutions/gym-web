import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Avatar, Badge, Button, DataTable, Input, Modal, PageHeader, Pagination, StatusBadge, useToast, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { User } from '@/types/api';
import { ExportButton, FilterBar, FilterSelect, SearchInput } from '../components/FilterBar';
import { PersonCell } from '../components/Bits';
import { trainerOptions, useTrainersAdmin } from '../components/queries';
import type { MemberRow } from '../components/types';
import { applyApiErrors, cleanQuery, useDebounced } from '../components/utils';

const addSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/, 'Digits, spaces, + ( ) - only'),
  password: z
    .string()
    .max(128)
    .refine((v) => v === '' || v.length >= 10, 'At least 10 characters, or leave empty')
    .refine((v) => v === '' || (/[A-Za-z]/.test(v) && /\d/.test(v)), 'Include at least one letter and one number'),
});
type AddForm = z.infer<typeof addSchema>;

function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, setError, formState } = useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { name: '', email: '', phone: '', password: '' } });
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  const m = useMutation({
    mutationFn: (f: AddForm) => api.post<User>('/members', { name: f.name, email: f.email, phone: f.phone, password: f.password || undefined }),
    onSuccess: (u) => {
      toast.success('Member created', u.email);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
      navigate(`/admin/members/${u.id}`);
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add member"
      description="Creates a member account. Record a payment or grant a membership from their profile next."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-member-form" loading={m.isPending}>
            Create member
          </Button>
        </>
      }
    >
      <form id="add-member-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Input label="Full name" required autoComplete="off" wrapClassName="sm:col-span-2" error={e.name?.message} {...register('name')} />
        <Input label="Email" type="email" required autoComplete="off" error={e.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" placeholder="+91 98…" error={e.phone?.message} {...register('phone')} />
        <Input
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          wrapClassName="sm:col-span-2"
          error={e.password?.message}
          hint="Optional. Leave empty and the member can set one with “Forgot password”."
          {...register('password')}
        />
      </form>
    </Modal>
  );
}

const MEMBERSHIP_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring ≤14 days' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'Never purchased' },
] as const;

export default function MembersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'pending'>((params.get('status') as 'active') ?? '');
  const [membership, setMembership] = useState<'' | (typeof MEMBERSHIP_FILTERS)[number]['value']>((params.get('membership') as 'active') ?? '');
  const [trainer, setTrainer] = useState(params.get('trainer') ?? '');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(params.get('new') === '1');
  const dq = useDebounced(q.trim(), 300);
  const trainers = useTrainersAdmin(can('trainers:write'));

  useEffect(() => setPage(1), [dq, status, membership, trainer]);
  useEffect(() => {
    setParams(cleanQuery({ q: dq, status, membership, trainer }) as Record<string, string>, { replace: true });
  }, [dq, status, membership, trainer, setParams]);

  const filters = cleanQuery({ q: dq, status, membership, trainer });
  const list = useQuery({
    queryKey: ['admin', 'members', 'list', filters, page],
    queryFn: () => api.getPaged<MemberRow[]>('/members', { ...filters, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<MemberRow>[] = [
    {
      key: 'member',
      header: 'Member',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.name} src={m.avatarUrl || undefined} size={34} />
          <PersonCell name={m.name} sub={m.email} />
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideOnMobile: true, cell: (m) => <span className="tabular-nums text-muted">{m.phone || '—'}</span> },
    {
      key: 'membership',
      header: 'Membership',
      cell: (m) =>
        m.membership ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{m.membership.planName}</span>
              <StatusBadge status={m.membership.status} />
            </div>
            <p className="text-xs text-muted">
              {m.membership.status === 'active' && m.membership.daysLeft !== null ? `${m.membership.daysLeft} days left · ` : ''}ends {fmtDate(m.membership.endDate)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted">No membership</span>
        ),
    },
    { key: 'trainer', header: 'Trainer', hideOnMobile: true, cell: (m) => m.assignedTrainer?.name ?? <span className="text-muted">—</span> },
    { key: 'status', header: 'Account', cell: (m) => (m.status === 'active' ? <Badge tone="neutral">active</Badge> : <StatusBadge status={m.status} />) },
    { key: 'joined', header: 'Joined', hideOnMobile: true, cell: (m) => <span className="text-muted">{fmtDate(m.createdAt)}</span> },
  ];

  const hasFilters = Boolean(dq || status || membership || trainer);
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Members"
        description="Search, filter and manage member accounts."
        actions={
          <>
            <ExportButton path="/members" query={filters} filename="members.csv" />
            {can('members:write') && (
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add member
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Name, email or phone" label="Search members" />
        <FilterSelect
          label="Account"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'pending', label: 'Pending' },
          ]}
        />
        <FilterSelect label="Membership" value={membership} onChange={setMembership} options={MEMBERSHIP_FILTERS.map((x) => ({ ...x }))} />
        {can('trainers:write') && <FilterSelect label="Trainer" value={trainer} onChange={setTrainer} options={trainerOptions(trainers.data, false)} />}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setQ('');
              setStatus('');
              setMembership('');
              setTrainer('');
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>
      <DataTable
        caption="Members"
        columns={columns}
        rows={list.data?.data}
        rowKey={(m) => m.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        onRowClick={(m) => navigate(`/admin/members/${m.id}`)}
        empty={
          hasFilters
            ? { title: 'No members match these filters', description: 'Try a different search or clear the filters.' }
            : {
                title: 'No members yet',
                description: 'Members appear here when they register on the website or when staff add them.',
                action: can('members:write') ? (
                  <Button icon={<Users className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                    Add the first member
                  </Button>
                ) : undefined,
              }
        }
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
