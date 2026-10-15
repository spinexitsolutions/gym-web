import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, History, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, DataTable, ErrorState, Modal, PageHeader, Skeleton, StatusBadge, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, money, titleCase } from '@/lib/format';
import type { MembershipView, Plan } from '@/types/api';
import { MembershipCard } from '../components/MembershipCard';
import { plural } from '../components/utils';

type MembershipsResponse = { active: MembershipView | null; history: MembershipView[] };

export default function MembershipPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const ms = useQuery({ queryKey: ['member', 'memberships'], queryFn: () => api.get<MembershipsResponse>('/memberships/me') });
  const plans = useQuery({ queryKey: ['public', 'plans'], queryFn: () => api.get<Plan[]>('/plans') });
  const [cancelFor, setCancelFor] = useState<MembershipView | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash === '#plans' && plans.data && ms.data) {
      setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [location.hash, plans.data, ms.data]);

  const cancelReq = useMutation({
    mutationFn: () => api.post<MembershipView>(`/memberships/me/${cancelFor!.id}/cancel-request`, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Cancellation request sent', 'Our team will review it and get back to you, usually within 1–2 working days.');
      setCancelFor(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['member'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.reason) setReasonError(err.fieldErrors.reason);
      else toast.error(err);
    },
  });

  if (ms.isError) return <ErrorState error={ms.error} onRetry={() => ms.refetch()} />;

  const history = ms.data?.history ?? [];
  const active = ms.data?.active ?? null;
  const upcoming = history.filter((m) => m.status === 'upcoming').sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  const current = active ?? upcoming[0] ?? null;
  const hasAny = history.length > 0;
  const planById = (id: string) => plans.data?.find((p) => p.id === id || p._id === id);
  const activePlan = active ? planById(active.plan) : undefined;
  const visiblePlans = (plans.data ?? []).filter((p) => !(p.isTrial && hasAny));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="Account" title="Membership" description="Your plan, renewals and history. Renewals are queued to start the day your current plan ends — you never lose days." />

      {!ms.data ? (
        <Skeleton className="h-44" />
      ) : (
        <MembershipCard
          membership={active}
          upcoming={upcoming[0]}
          actions={
            active && (
              <>
                {activePlan?.active !== false && (
                  <ButtonLink to={`/member/checkout/${active.plan}`} size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />}>
                    Renew {active.planName}
                  </ButtonLink>
                )}
                {!active.cancellationRequestedAt && !active.isTrial && (
                  <Button variant="ghost" size="sm" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => (setCancelFor(active), setReasonError(null))}>
                    Request cancellation
                  </Button>
                )}
              </>
            )
          }
        />
      )}

      {active?.cancellationRequestedAt && (
        <Alert tone="warning" title="Cancellation requested">
          You asked to cancel on {fmtDate(active.cancellationRequestedAt)}. Our team will contact you to confirm any refund under your plan’s policy. Your membership stays active until then.
        </Alert>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader title="Queued memberships" description="These start automatically when the previous one ends." />
          <ul className="divide-y divide-line/70">
            {upcoming.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="font-medium">{m.planName}</p>
                  <p className="text-sm text-muted">
                    {fmtDate(m.startDate)} → {fmtDate(m.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  {m.cancellationRequestedAt ? (
                    <Badge tone="warning">Cancellation requested</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => (setCancelFor(m), setReasonError(null))}>
                      Request cancellation
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section id="plans" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{current ? 'Renew or upgrade' : 'Choose your plan'}</h2>
            <p className="text-sm text-muted">
              {current
                ? 'Renew to queue a new plan after your current one, or upgrade to switch right now.'
                : 'Your membership activates the moment your payment is confirmed.'}
            </p>
          </div>
        </div>
        {current && (
          <Alert tone="info" className="mb-4" title="How upgrades work">
            Upgrading starts the new plan immediately and ends your current plan today. Upgrades aren’t prorated — unused days on your current plan aren’t credited — so upgrading is best near the end of a plan, or choose “Renew” to queue it instead.
          </Alert>
        )}
        {plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        ) : !plans.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visiblePlans.map((p, i) => {
              const isCurrent = active?.plan === p.id || active?.plan === p._id;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn('card relative flex flex-col p-5', p.highlight && 'border-primary/50 shadow-glow')}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.highlight && (
                      <Badge tone="primary">
                        <Sparkles className="h-3 w-3" /> Most popular
                      </Badge>
                    )}
                    {p.promoLabel && <Badge tone="warning">{p.promoLabel}</Badge>}
                    {isCurrent && <Badge tone="success">Current plan</Badge>}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{p.name}</h3>
                  {p.tagline && <p className="text-sm text-muted">{p.tagline}</p>}
                  <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
                    {p.priceMinor === 0 ? 'Free' : money(p.priceMinor)}
                    <span className="ml-1 text-sm font-normal text-muted">/ {plural(p.durationDays, 'day')}</span>
                  </p>
                  {p.compareAtMinor ? <p className="text-xs text-muted line-through">{money(p.compareAtMinor)}</p> : null}
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {p.benefits.slice(0, 6).map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{b}</span>
                      </li>
                    ))}
                    <li className="flex gap-2 text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" /> {p.limits.classesPerWeek == null ? 'Unlimited classes' : `${p.limits.classesPerWeek} classes / week`}
                    </li>
                  </ul>
                  <div className="mt-5 flex flex-col gap-2">
                    {!current ? (
                      <ButtonLink to={`/member/checkout/${p.id}`} variant={p.highlight ? 'primary' : 'secondary'} icon={<ArrowUpRight className="h-4 w-4" />}>
                        {p.isTrial ? 'Start trial' : 'Choose plan'}
                      </ButtonLink>
                    ) : (
                      <>
                        <ButtonLink to={`/member/checkout/${p.id}`} variant={p.highlight ? 'primary' : 'secondary'} size="sm">
                          {isCurrent ? 'Renew (queued)' : 'Switch at renewal'}
                        </ButtonLink>
                        {!isCurrent && active && (
                          <ButtonLink to={`/member/checkout/${p.id}?mode=upgrade`} variant="ghost" size="sm">
                            Upgrade now
                          </ButtonLink>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><History className="h-4 w-4 text-primary" /> History</span>} description="Every membership on your account." />
        <div className="p-4">
          <DataTable
            caption="Membership history"
            isLoading={ms.isLoading}
            rows={history}
            rowKey={(m) => m.id}
            empty={{ title: 'No memberships yet', description: 'Once you join, every plan you’ve held appears here.' }}
            columns={[
              { key: 'plan', header: 'Plan', cell: (m) => <span className="font-medium">{m.planName}</span> },
              { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
              { key: 'dates', header: 'Dates', cell: (m) => `${fmtDate(m.startDate)} → ${fmtDate(m.endDate)}` },
              { key: 'source', header: 'Source', hideOnMobile: true, cell: (m) => <span className="text-muted">{m.source === 'online' ? 'Online payment' : m.source === 'trial' ? 'Trial' : titleCase(m.source)}</span> },
            ]}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(cancelFor)}
        onClose={() => setCancelFor(null)}
        title="Request cancellation"
        description={cancelFor ? `${cancelFor.planName} · ${fmtDate(cancelFor.startDate)} → ${fmtDate(cancelFor.endDate)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelFor(null)}>
              Keep membership
            </Button>
            <Button
              variant="danger"
              loading={cancelReq.isPending}
              onClick={() => {
                if (reason.trim().length < 3) return setReasonError('Please tell us briefly why (at least 3 characters)');
                cancelReq.mutate();
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        {cancelFor && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-fg/[0.04] p-4 text-sm">
              <p className="font-medium">Cancellation policy</p>
              <p className="mt-1 text-muted">{planById(cancelFor.plan)?.cancellationPolicy || 'Cancellations are reviewed by our team. Refunds, if any, follow the terms shown when you purchased.'}</p>
              {planById(cancelFor.plan)?.refundableDays ? <p className="mt-1 text-xs text-muted">Refund window: {plural(planById(cancelFor.plan)!.refundableDays!, 'day')} from purchase.</p> : null}
            </div>
            <p className="text-sm text-muted">This sends a request to our team — it doesn’t cancel immediately. You keep full access until it’s processed.</p>
            <Textarea label="Reason" required rows={3} maxLength={500} value={reason} onChange={(e) => (setReason(e.target.value), setReasonError(null))} error={reasonError ?? undefined} placeholder="e.g. Moving to another city" />
          </div>
        )}
      </Modal>
    </div>
  );
}
