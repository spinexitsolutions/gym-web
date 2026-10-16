import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PERMISSIONS, PERMISSION_LABELS, type Permission, type Role } from '@apex/shared';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Alert, Avatar, Badge, Button, Checkbox, DataTable, Input, Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, useToast, type Column } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { fmtDate, relativeTime } from '@/lib/format';
import type { User } from '@/types/api';
import { PersonCell, RowActions } from '../components/Bits';
import { SearchInput } from '../components/FilterBar';
import { applyApiErrors, cleanQuery, useDebounced } from '../components/utils';

const GROUPS: { label: string; perms: Permission[] }[] = [
  { label: 'Members & front desk', perms: ['members:read', 'members:write', 'attendance:write', 'support:write'] },
  { label: 'Revenue', perms: ['payments:read', 'payments:write', 'plans:write', 'reports:read'] },
  { label: 'Schedule & coaching', perms: ['classes:write', 'trainers:write'] },
  { label: 'Website', perms: ['cms:write', 'media:write'] },
  { label: 'System', perms: ['settings:write', 'audit:read'] },
];

const adminSchema = z.object({ name: z.string().trim().min(2, 'At least 2 characters').max(100), email: z.string().trim().toLowerCase().email('Enter a valid email') });
type AdminForm = z.infer<typeof adminSchema>;

function CreateAdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { register, handleSubmit, reset, setError, formState } = useForm<AdminForm>({ resolver: zodResolver(adminSchema) });
  useEffect(() => {
    if (open) reset({ name: '', email: '' });
  }, [open, reset]);
  const m = useMutation({
    mutationFn: (f: AdminForm) => api.post<User>('/users/admins', f),
    onSuccess: (u) => {
      toast.success('Admin created', `A password setup email was sent to ${u.email}.`);
      void qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setError('email', { message: err.message });
      else if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create admin"
      description="Admins have full access to everything, including staff management."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-form" loading={m.isPending}>
            Create & send invite
          </Button>
        </>
      }
    >
      <form id="admin-form" className="space-y-4" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Alert tone="info">They’ll receive an email with a link to set their own password. For limited access (e.g. a front-desk role), create a trainer and grant specific permissions instead.</Alert>
        <Input label="Full name" required error={e.name?.message} {...register('name')} />
        <Input label="Email" type="email" required error={e.email?.message} {...register('email')} />
      </form>
    </Modal>
  );
}

function AccessModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const [role, setRole] = useState<Role>('trainer');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [perms, setPerms] = useState<Permission[]>([]);
  useEffect(() => {
    if (!user) return;
    setRole(user.role);
    setStatus(user.status === 'suspended' ? 'suspended' : 'active');
    setPerms(user.permissions ?? []);
  }, [user]);
  const self = Boolean(user && me && user.id === me.id);
  const m = useMutation({
    mutationFn: () => api.patch<User>(`/users/${user!.id}/access`, { role, status, permissions: role === 'admin' ? [] : perms }),
    onSuccess: (u) => {
      toast.success('Access updated', u.role !== user?.role || u.status === 'suspended' ? 'Their sessions were signed out.' : undefined);
      void qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
      onClose();
    },
    onError: (err) => toast.error(err),
  });
  const toggle = (p: Permission, on: boolean) => setPerms((x) => (on ? Array.from(new Set([...x, p])) : x.filter((y) => y !== p)));
  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      size="lg"
      title={user ? `Access · ${user.name}` : 'Access'}
      description={user?.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>
            Save access
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {self && <Alert tone="warning">This is your own account. You can’t remove your admin role or suspend yourself.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={self}
            options={[
              { value: 'admin', label: 'Admin — full access' },
              { value: 'trainer', label: 'Trainer' },
              { value: 'member', label: 'Member' },
            ]}
            hint={user && role !== user.role ? 'Changing the role signs the user out everywhere.' : undefined}
          />
          <Select
            label="Account status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
            disabled={self}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </div>
        {role === 'admin' ? (
          <Alert tone="info" title="Admins hold every permission">
            Individual permissions only apply to trainers and members.
          </Alert>
        ) : (
          <fieldset>
            <legend className="label">Extra permissions</legend>
            <p className="mb-3 text-xs text-muted">Grant specific admin areas without making someone a full admin. {perms.length} selected.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {GROUPS.map((g) => (
                <div key={g.label} className="rounded-theme-sm border border-line p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                  <div className="space-y-2">
                    {g.perms.map((p) => (
                      <Checkbox
                        key={p}
                        checked={perms.includes(p)}
                        onChange={(e) => toggle(p, e.target.checked)}
                        label={
                          <span>
                            {PERMISSION_LABELS[p]} <code className="ml-1 text-[0.7rem] text-muted">{p}</code>
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {PERMISSIONS.length !== GROUPS.flatMap((g) => g.perms).length && <p className="mt-2 text-xs text-warning">Some permissions are not listed above.</p>}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const { user: me } = useAuth();
  const [role, setRole] = useState<'' | Role>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const dq = useDebounced(q.trim(), 300);
  useEffect(() => setPage(1), [role, dq]);
  const filters = cleanQuery({ role, q: dq });
  const list = useQuery({ queryKey: ['admin', 'staff', filters, page], queryFn: () => api.getPaged<User[]>('/users', { ...filters, page, limit: 25 }), placeholderData: keepPreviousData });

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} src={u.avatarUrl || undefined} size={34} />
          <PersonCell
            name={
              <>
                {u.name}
                {me?.id === u.id && <Badge className="ml-2">you</Badge>}
              </>
            }
            sub={u.email}
          />
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={u.role === 'admin' ? 'primary' : 'neutral'}>{u.role}</Badge> },
    {
      key: 'perms',
      header: 'Permissions',
      hideOnMobile: true,
      cell: (u) =>
        u.role === 'admin' ? (
          <span className="text-xs text-muted">All</span>
        ) : u.permissions.length ? (
          <div className="flex max-w-sm flex-wrap gap-1">
            {u.permissions.map((p) => (
              <span key={p} title={PERMISSION_LABELS[p]}>
                <Badge>{p}</Badge>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted">Role defaults</span>
        ),
    },
    { key: 'status', header: 'Status', cell: (u) => <StatusBadge status={u.status} /> },
    { key: 'last', header: 'Last login', hideOnMobile: true, cell: (u) => <span className="text-xs text-muted" title={fmtDate(u.lastLoginAt)}>{u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Never'}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (u) => (
        <RowActions>
          <Button size="sm" variant="secondary" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setEditing(u)}>
            Access
          </Button>
        </RowActions>
      ),
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Staff & permissions"
        description="Who can access the admin area, and what they can do."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Create admin
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          className="w-fit"
          value={role || 'staff'}
          onChange={(v) => setRole(v === 'staff' ? '' : (v as Role))}
          tabs={[
            { value: 'staff', label: 'All staff' },
            { value: 'admin', label: 'Admins' },
            { value: 'trainer', label: 'Trainers' },
            { value: 'member', label: 'Members' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Name or email" label="Search users" />
      </div>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5" /> Trainers are added from <span className="text-fg">Trainers</span>; here you can grant them extra permissions (e.g. check-in or payments for front-desk duty).
      </p>
      <DataTable caption="Users" columns={columns} rows={list.data?.data} rowKey={(u) => u.id} isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} onRowClick={setEditing} empty={{ title: 'No users found', description: dq ? 'Try another search.' : undefined }} />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      <CreateAdminModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AccessModal user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
