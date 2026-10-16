import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, HeartPulse, Search, Target, Users } from 'lucide-react';
import { Avatar, Badge, EmptyState, ErrorState, Input, PageHeader, Skeleton, StatusBadge, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, titleCase } from '@/lib/format';
import type { AssignedMember } from '@/member/components/types';

type Filter = 'all' | 'active' | 'expiring' | 'none';

export default function TrainerMembersPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const members = useQuery({ queryKey: ['trainer', 'members'], queryFn: () => api.get<AssignedMember[]>('/trainers/me/members') });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (members.data ?? [])
      .filter((m) => !term || m.user.name.toLowerCase().includes(term) || (m.user.email ?? '').toLowerCase().includes(term) || (m.user.phone ?? '').includes(term))
      .filter((m) => {
        if (filter === 'active') return Boolean(m.membership);
        if (filter === 'expiring') return m.membership && (m.membership.daysLeft ?? 99) <= 14;
        if (filter === 'none') return !m.membership;
        return true;
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [members.data, q, filter]);

  const counts = {
    all: members.data?.length ?? 0,
    active: members.data?.filter((m) => m.membership).length ?? 0,
    expiring: members.data?.filter((m) => m.membership && (m.membership.daysLeft ?? 99) <= 14).length ?? 0,
    none: members.data?.filter((m) => !m.membership).length ?? 0,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Coaching" title="My members" description="Members assigned to you by the gym. Open a profile for progress, plans, logs and notes." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search members" placeholder="Search name, email or phone" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'expiring', label: 'Expiring', count: counts.expiring },
            { value: 'none', label: 'No plan', count: counts.none },
          ]}
        />
      </div>
      {members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : members.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !members.data?.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No members assigned yet" description="When the gym assigns members to you, they’ll appear here with their goals and membership status." />
      ) : !list.length ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No matches" description="Try a different search or filter." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((m, i) => {
            const goals = m.goals.filter((g) => g.status === 'active');
            return (
              <motion.li key={m.user._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                <Link to={`/trainer/members/${m.user._id}`} className="card flex h-full items-start gap-3 p-4 transition hover:border-primary/40">
                  <Avatar name={m.user.name} src={m.user.avatarUrl || undefined} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{m.user.name}</p>
                      {m.fitnessLevel && <Badge>{titleCase(m.fitnessLevel)}</Badge>}
                      {m.healthNotes && (
                        <Badge tone="warning">
                          <HeartPulse className="h-3 w-3" /> Health note
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">{m.user.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {m.membership ? (
                        <>
                          <StatusBadge status={m.membership.status} />
                          <span className={(m.membership.daysLeft ?? 99) <= 14 ? 'text-warning' : 'text-muted'}>
                            {m.membership.planName} · {m.membership.daysLeft}d left (ends {fmtDate(m.membership.endDate, { day: 'numeric', month: 'short' })})
                          </span>
                        </>
                      ) : (
                        <Badge tone="neutral">No active membership</Badge>
                      )}
                    </div>
                    {goals.length > 0 && (
                      <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted">
                        <Target className="h-3.5 w-3.5 shrink-0 text-primary" /> {goals.map((g) => g.title).join(' · ')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
