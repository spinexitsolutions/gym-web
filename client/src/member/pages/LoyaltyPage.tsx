import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Copy, Gift, History, Share2, UserPlus, Zap } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { LoyaltyTx } from '../components/types';

interface Loyalty {
  points: number;
  referralCode: string | null;
  referrals: number;
  history: LoyaltyTx[];
}
const reasonLabel = { check_in: 'Check-in', referral: 'Referral reward', adjustment: 'Adjustment', redemption: 'Redeemed' } as const;

export default function LoyaltyPage() {
  const toast = useToast();
  const { site, brandName } = useSite();
  const loyalty = site?.settings.loyalty;
  const q = useQuery({ queryKey: ['member', 'loyalty'], queryFn: () => api.get<Loyalty>('/members/me/loyalty') });
  const link = q.data?.referralCode ? `${window.location.origin}/register?ref=${encodeURIComponent(q.data.referralCode)}` : '';

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Couldn’t copy automatically', text);
    }
  };
  const share = async () => {
    const data = { title: `Join me at ${brandName}`, text: `Train with me at ${brandName}! Sign up with my code ${q.data?.referralCode}.`, url: link };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* cancelled */
      }
    } else void copy(link, 'Invite link');
  };

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader eyebrow="Account" title="Rewards & referrals" description="Earn points every time you train, and bonus points when friends join through your link." />

      {loyalty && !loyalty.enabled && <p className="rounded-xl bg-fg/[0.04] px-4 py-3 text-sm text-muted">The rewards programme is currently paused. Your points are safe.</p>}

      <div className="grid gap-5 md:grid-cols-[1fr_1.3fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-6">
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-muted">Your points</p>
          {q.isLoading ? <Skeleton className="mt-3 h-14 w-40" /> : <p className="relative mt-2 font-display text-6xl font-semibold tabular-nums text-gradient">{q.data!.points.toLocaleString('en-IN')}</p>}
          <div className="relative mt-5 space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> +{loyalty?.pointsPerCheckIn ?? 5} per daily check-in
            </p>
            <p className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> +{loyalty?.referralRewardPoints ?? 200} when a friend you refer buys a membership
            </p>
          </div>
          <p className="relative mt-4 text-xs text-muted">Ask the front desk about redeeming points for merchandise or extra sessions.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Invite friends</p>
          {q.isLoading ? (
            <Skeleton className="mt-3 h-24" />
          ) : q.data?.referralCode ? (
            <>
              <button type="button" onClick={() => copy(q.data!.referralCode!, 'Referral code')} className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-5 py-4 transition hover:bg-primary/10" aria-label={`Copy referral code ${q.data.referralCode}`}>
                <span className="font-mono text-2xl font-semibold tracking-[0.25em] text-primary">{q.data.referralCode}</span>
                <Copy className="h-4 w-4 text-muted" />
              </button>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{link}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button icon={<Share2 className="h-4 w-4" />} onClick={share}>
                  Share invite
                </Button>
                <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copy(link, 'Invite link')}>
                  Copy link
                </Button>
              </div>
              <p className="mt-4 text-sm">
                <span className="font-display text-xl font-semibold">{q.data.referrals}</span> <span className="text-muted">{q.data.referrals === 1 ? 'friend has' : 'friends have'} joined with your code</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Your referral code isn’t ready yet — check back shortly.</p>
          )}
        </motion.div>
      </div>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Points history</span>} description="Latest 50 transactions" />
        {q.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-32" />
          </div>
        ) : !q.data?.history.length ? (
          <div className="p-5">
            <EmptyState icon={<Gift className="h-5 w-5" />} title="No points yet" description="Check in at the gym to earn your first points." />
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {q.data.history.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{reasonLabel[t.reason] ?? t.reason}</p>
                  <p className="truncate text-xs text-muted">
                    {fmtDate(t.createdAt)}
                    {t.note && t.reason !== 'check_in' ? ` · ${t.note}` : ''}
                  </p>
                </div>
                <span className={cn('font-display font-semibold tabular-nums', t.points >= 0 ? 'text-success' : 'text-danger')}>
                  {t.points >= 0 ? '+' : ''}
                  {t.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
