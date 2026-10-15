import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, BadgePercent, Building2, Check, CheckCircle2, Clock, Download, FlaskConical, Loader2, Lock, RefreshCw, ShieldCheck, Tag, X, XCircle } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, ErrorState, Input, Modal, Skeleton, useToast } from '@/components/ui';
import { ApiError, api, download, errorMessage } from '@/lib/api';
import { fmtDate, money } from '@/lib/format';
import type { MembershipView, PaymentView, Plan } from '@/types/api';
import { loadRazorpay } from '../components/razorpay';
import { plural } from '../components/utils';

interface Quote {
  planId: string;
  planName: string;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  couponCode: string | null;
}
interface CheckoutConfig {
  provider: 'razorpay' | 'sandbox';
  keyId?: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}
type CheckoutResponse = { free: true; payment: PaymentView; membershipId: string } | { free: false; payment: PaymentView; checkout: CheckoutConfig };
interface VerifyResponse {
  payment: PaymentView;
  alreadyProcessed: boolean;
  pending?: boolean;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'sandbox'; checkout: CheckoutConfig }
  | { kind: 'verifying' }
  | { kind: 'pending'; payment: PaymentView }
  | { kind: 'success'; payment: PaymentView }
  | { kind: 'failed'; message: string };

const MEMBERSHIPS_KEY = ['member', 'memberships'] as const;

export default function CheckoutPage() {
  const { planId = '' } = useParams();
  const [params] = useSearchParams();
  const mode: 'auto' | 'upgrade' = params.get('mode') === 'upgrade' ? 'upgrade' : 'auto';
  const { site } = useSite();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const provider = site?.payments.provider;

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Quote | null>(null);
  const settled = useRef(false);

  const plans = useQuery({ queryKey: ['public', 'plans'], queryFn: () => api.get<Plan[]>('/plans') });
  const plan = plans.data?.find((p) => p.id === planId || p._id === planId);
  const memberships = useQuery({ queryKey: MEMBERSHIPS_KEY, queryFn: () => api.get<{ active: MembershipView | null; history: MembershipView[] }>('/memberships/me') });
  const baseQuote = useQuery({ queryKey: ['member', 'quote', planId], queryFn: () => api.post<Quote>('/payments/quote', { planId }), enabled: Boolean(planId), retry: false });
  const quote = applied ?? baseQuote.data;

  const current = memberships.data?.history.filter((m) => m.status === 'active' || m.status === 'upcoming').sort((a, b) => +new Date(b.endDate) - +new Date(a.endDate))[0];
  const startsLabel = !current ? 'Starts immediately after payment' : mode === 'upgrade' ? 'Starts immediately — replaces your current plan' : `Queued — starts ${fmtDate(current.endDate)} when your current plan ends`;

  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.post<Quote>('/payments/quote', { planId, couponCode: code }),
    onSuccess: (q) => {
      setApplied(q);
      setCouponError(null);
      toast.success(`Coupon ${q.couponCode} applied`, `You save ${money(q.discountMinor)}.`);
    },
    onError: (err) => {
      setApplied(null);
      setCouponError(err instanceof ApiError ? (err.fieldErrors.couponCode ?? err.message) : errorMessage(err));
    },
  });

  const finishSuccess = useCallback(
    (payment: PaymentView) => {
      settled.current = true;
      setPhase({ kind: 'success', payment });
      void qc.invalidateQueries({ queryKey: ['member'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    [qc],
  );

  const verify = useCallback(
    async (orderId: string, paymentId: string, signature: string) => {
      settled.current = true;
      setPhase({ kind: 'verifying' });
      try {
        const r = await api.post<VerifyResponse>('/payments/verify', { orderId, paymentId, signature });
        if (r.pending) setPhase({ kind: 'pending', payment: r.payment });
        else finishSuccess(r.payment);
      } catch (err) {
        setPhase({ kind: 'failed', message: errorMessage(err) });
        void qc.invalidateQueries({ queryKey: ['member', 'payments'] });
      }
    },
    [finishSuccess, qc],
  );

  const recordFailure = useCallback((orderId: string, reason: string) => {
    void api.post('/payments/failed', { orderId, reason }).catch(() => undefined);
  }, []);

  const openRazorpay = useCallback(
    async (c: CheckoutConfig) => {
      const Razorpay = await loadRazorpay();
      let lastError: string | null = null;
      settled.current = false;
      const rzp = new Razorpay({
        key: c.keyId ?? site?.payments.keyId ?? '',
        order_id: c.orderId,
        amount: c.amountMinor,
        currency: c.currency,
        name: c.name,
        description: c.description,
        prefill: c.prefill,
        theme: { color: site?.theme.colors.primary },
        // The browser callback is NOT proof of payment: the server verifies the signature and confirms with Razorpay.
        handler: (r) => void verify(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature),
        modal: {
          ondismiss: () => {
            if (settled.current) return;
            recordFailure(c.orderId, lastError ?? 'Checkout closed');
            setPhase(lastError ? { kind: 'failed', message: lastError } : { kind: 'idle' });
            if (!lastError) toast.info('Payment cancelled', 'No money was taken. You can try again whenever you’re ready.');
          },
        },
      });
      rzp.on('payment.failed', (r) => {
        lastError = r.error?.description || 'The payment was declined.';
        recordFailure(c.orderId, lastError);
      });
      rzp.open();
    },
    [site, verify, recordFailure, toast],
  );

  const pay = useMutation({
    mutationFn: () => api.post<CheckoutResponse>('/payments/checkout', { planId, couponCode: applied?.couponCode ?? undefined, mode }),
    onSuccess: async (r) => {
      if (r.free) return finishSuccess(r.payment);
      if (r.checkout.provider === 'sandbox') return setPhase({ kind: 'sandbox', checkout: r.checkout });
      try {
        await openRazorpay(r.checkout);
      } catch (err) {
        recordFailure(r.checkout.orderId, 'Gateway failed to load');
        setPhase({ kind: 'failed', message: errorMessage(err) });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.couponCode) {
        setApplied(null);
        setCouponError(err.fieldErrors.couponCode);
      }
      toast.error(err);
    },
  });

  const sandbox = useMutation({
    mutationFn: async ({ orderId, outcome }: { orderId: string; outcome: 'success' | 'failure' }) => {
      const r = await api.post<{ orderId: string; paymentId: string; signature: string }>('/payments/sandbox/complete', { orderId, outcome });
      await verify(r.orderId, r.paymentId, r.signature);
    },
    onError: (err) => setPhase({ kind: 'failed', message: errorMessage(err) }),
  });

  const closeSandbox = () => {
    if (phase.kind !== 'sandbox' || sandbox.isPending) return;
    recordFailure(phase.checkout.orderId, 'Checkout closed');
    setPhase({ kind: 'idle' });
    toast.info('Payment cancelled', 'No money was taken.');
  };

  /* Pending: poll a few times for the webhook to confirm. */
  useEffect(() => {
    if (phase.kind !== 'pending') return;
    let tries = 0;
    const id = window.setInterval(async () => {
      tries++;
      try {
        const [ms, pays] = await Promise.all([api.get<{ history: MembershipView[] }>('/memberships/me'), api.get<PaymentView[]>('/payments/me')]);
        const p = pays.find((x) => x.id === phase.payment.id);
        if (ms.history.some((m) => m.payment === phase.payment.id) || p?.status === 'captured') return finishSuccess(p ?? phase.payment);
        if (p?.status === 'failed') {
          window.clearInterval(id);
          setPhase({ kind: 'failed', message: p.failureReason ?? 'The payment failed.' });
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 8) window.clearInterval(id);
    }, 5000);
    return () => window.clearInterval(id);
  }, [phase, finishSuccess]);

  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => plans.refetch()} />;
  if (plans.isLoading) return <CheckoutSkeleton />;
  if (!plan)
    return (
      <ErrorState
        title="This plan isn’t available"
        error={new Error('It may have been retired. Pick another plan to continue.')}
        className="mx-auto max-w-lg"
        onRetry={() => navigate('/member/membership#plans')}
      />
    );

  if (phase.kind === 'success') return <SuccessScreen payment={phase.payment} />;

  const busy = pay.isPending || phase.kind === 'verifying' || phase.kind === 'pending' || phase.kind === 'sandbox';

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/member/membership" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to membership
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{mode === 'upgrade' ? 'Upgrade' : current ? 'Renew' : 'Checkout'}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{plan.name}</h1>
        </div>
        {site?.payments.testMode && (
          <Badge tone="warning">
            <FlaskConical className="h-3.5 w-3.5" /> Test mode — no real money
          </Badge>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(phase.kind === 'verifying' || phase.kind === 'pending' || phase.kind === 'failed') && (
          <motion.div key={phase.kind} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5">
            {phase.kind === 'verifying' && (
              <div role="status" className="card flex items-center gap-4 p-5">
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
                <div>
                  <p className="font-semibold">Verifying payment…</p>
                  <p className="text-sm text-muted">We’re confirming the payment with the gateway. Please don’t close or refresh this page.</p>
                </div>
              </div>
            )}
            {phase.kind === 'pending' && (
              <div role="status" className="card flex items-start gap-4 border-warning/40 p-5">
                <Clock className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">Payment received — awaiting confirmation</p>
                  <p className="text-sm text-muted">
                    Your bank hasn’t confirmed the payment yet. This usually takes under a minute; we’re checking automatically. If it doesn’t confirm, your membership activates as soon as it does, and you’ll get a notification. You won’t be charged twice.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink to="/member/payments" variant="secondary" size="sm">
                      View payments
                    </ButtonLink>
                    <ButtonLink to="/member" variant="ghost" size="sm">
                      Go to dashboard
                    </ButtonLink>
                  </div>
                </div>
              </div>
            )}
            {phase.kind === 'failed' && (
              <div role="alert" className="card flex items-start gap-4 border-danger/40 p-5">
                <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Payment not completed</p>
                  <p className="text-sm text-muted">{phase.message}</p>
                  <p className="mt-1 text-xs text-muted">If money was deducted, it will be reconciled automatically — contact support with your bank reference if you don’t see it within 24 hours.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => (setPhase({ kind: 'idle' }), pay.mutate())} loading={pay.isPending}>
                      Try again
                    </Button>
                    <ButtonLink to="/member/support" variant="ghost" size="sm">
                      Contact support
                    </ButtonLink>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* Plan summary */}
        <Card className="overflow-hidden">
          <div className="relative p-6">
            <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                {plan.highlight && <Badge tone="primary">Most popular</Badge>}
                {plan.promoLabel && <Badge tone="warning">{plan.promoLabel}</Badge>}
                {plan.isTrial && <Badge tone="info">Trial</Badge>}
              </div>
              <p className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight">
                {money(plan.priceMinor)}
                <span className="ml-2 text-base font-normal text-muted">/ {plan.durationDays} days</span>
              </p>
              {plan.compareAtMinor ? <p className="text-sm text-muted line-through">{money(plan.compareAtMinor)}</p> : null}
              {plan.tagline && <p className="mt-2 text-muted">{plan.tagline}</p>}
            </div>
          </div>
          <CardBody className="border-t border-line/70">
            {plan.benefits.length > 0 && (
              <ul className="space-y-2.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { k: 'Classes / week', v: plan.limits.classesPerWeek ?? 'Unlimited' },
                { k: 'PT sessions', v: plan.limits.ptSessions },
                { k: 'Guest passes', v: plan.limits.guestPasses },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-fg/[0.03] px-2 py-3">
                  <dd className="font-display text-lg font-semibold">{x.v}</dd>
                  <dt className="text-[0.68rem] uppercase tracking-wider text-muted">{x.k}</dt>
                </div>
              ))}
            </dl>
            {plan.cancellationPolicy && (
              <p className="mt-5 text-xs text-muted">
                <span className="font-medium text-fg/80">Cancellation policy: </span>
                {plan.cancellationPolicy}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Order summary */}
        <Card className="h-fit lg:sticky lg:top-24">
          <CardBody className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-fg/[0.03] p-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{startsLabel}</p>
                {mode === 'upgrade' && current && <p className="mt-0.5 text-xs text-muted">Upgrades aren’t prorated: your current plan ({current.planName}) ends today and any remaining days aren’t credited.</p>}
                {!memberships.isLoading && <p className="mt-0.5 text-xs text-muted">Duration: {plural(plan.durationDays, 'day')}</p>}
              </div>
            </div>

            {!plan.isTrial && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = couponInput.trim().toUpperCase();
                  if (!code) return setCouponError('Enter a coupon code');
                  applyCoupon.mutate(code);
                }}
              >
                <label htmlFor="coupon" className="label">
                  Coupon code
                </label>
                {applied?.couponCode ? (
                  <div className="flex items-center justify-between gap-3 rounded-theme-sm border border-success/40 bg-success/5 px-3.5 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-success">
                      <Tag className="h-4 w-4" /> {applied.couponCode} — {money(applied.discountMinor)} off
                    </span>
                    <button type="button" className="rounded p-1 text-muted hover:text-fg" aria-label="Remove coupon" onClick={() => (setApplied(null), setCouponInput(''))}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      wrapClassName="flex-1"
                      value={couponInput}
                      onChange={(e) => (setCouponInput(e.target.value.toUpperCase()), setCouponError(null))}
                      placeholder="e.g. APEX20"
                      autoComplete="off"
                      maxLength={30}
                      error={couponError ?? undefined}
                      disabled={busy}
                    />
                    <Button type="submit" variant="secondary" loading={applyCoupon.isPending} disabled={busy} icon={<BadgePercent className="h-4 w-4" />}>
                      Apply
                    </Button>
                  </div>
                )}
              </form>
            )}

            <div className="space-y-2 border-t border-line/70 pt-4 text-sm">
              {baseQuote.isError ? (
                <Alert tone="danger" title="Can’t price this plan">
                  {errorMessage(baseQuote.error)}
                </Alert>
              ) : !quote ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-7 w-1/2" />
                </>
              ) : (
                <>
                  <Row label={`${quote.planName} membership`} value={money(quote.baseAmountMinor)} />
                  {quote.discountMinor > 0 && <Row label={`Discount${quote.couponCode ? ` (${quote.couponCode})` : ''}`} value={`− ${money(quote.discountMinor)}`} className="text-success" />}
                  <div className="flex items-baseline justify-between border-t border-line/70 pt-3">
                    <span className="font-semibold">Total payable</span>
                    <span className="font-display text-2xl font-semibold tabular-nums">{money(quote.amountMinor)}</span>
                  </div>
                  <p className="text-xs text-muted">Price calculated securely on our server, inclusive of applicable taxes.</p>
                </>
              )}
            </div>

            {provider === 'disabled' ? (
              <Alert tone="warning" title="Online payments aren’t available right now">
                Please pay at the front desk — our team will activate your membership straight away.
                {site?.settings.contact.phone ? ` Questions? Call ${site.settings.contact.phone}.` : ''}
                <span className="mt-2 flex items-center gap-1.5 text-xs">
                  <Building2 className="h-3.5 w-3.5" /> Cash, UPI and cards accepted in person.
                </span>
              </Alert>
            ) : (
              <Button size="lg" className="w-full" disabled={!quote || baseQuote.isError || busy} loading={pay.isPending || phase.kind === 'verifying'} icon={<Lock className="h-4 w-4" />} onClick={() => pay.mutate()}>
                {quote ? (quote.amountMinor === 0 ? 'Activate now — free' : `Pay ${money(quote.amountMinor)}`) : 'Pay'}
              </Button>
            )}
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5" /> {provider === 'razorpay' ? 'Secured by Razorpay. We never see your card details.' : 'Your membership activates only after the payment is verified.'}
            </p>
            {user && !user.emailVerified && <p className="text-center text-xs text-warning">Tip: verify your email so receipts reach your inbox.</p>}
          </CardBody>
        </Card>
      </div>

      {/* Sandbox gateway (local development) */}
      <Modal
        open={phase.kind === 'sandbox'}
        onClose={closeSandbox}
        size="sm"
        title="Simulated payment gateway"
        description="This stands in for Razorpay during local development."
        footer={
          phase.kind === 'sandbox' ? (
            <>
              <Button variant="danger" loading={sandbox.isPending && sandbox.variables?.outcome === 'failure'} disabled={sandbox.isPending} icon={<XCircle className="h-4 w-4" />} onClick={() => sandbox.mutate({ orderId: phase.checkout.orderId, outcome: 'failure' })}>
                Simulate failure
              </Button>
              <Button loading={sandbox.isPending && sandbox.variables?.outcome === 'success'} disabled={sandbox.isPending} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => sandbox.mutate({ orderId: phase.checkout.orderId, outcome: 'success' })}>
                Simulate success
              </Button>
            </>
          ) : null
        }
      >
        {phase.kind === 'sandbox' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-warning/60 bg-warning/10 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" /> TEST MODE — simulated payment gateway (no real money)
            </div>
            <div className="rounded-2xl bg-fg/[0.04] p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted">{phase.checkout.name}</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{money(phase.checkout.amountMinor)}</p>
              <p className="text-sm text-muted">{phase.checkout.description}</p>
            </div>
            <dl className="space-y-1 text-xs text-muted">
              <div className="flex justify-between gap-3">
                <dt>Order</dt>
                <dd className="truncate font-mono">{phase.checkout.orderId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Billed to</dt>
                <dd className="truncate">{phase.checkout.prefill.email}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">Either outcome goes through the same server-side signature verification as a real payment.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${className ?? ''}`}>
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function SuccessScreen({ payment }: { payment: PaymentView }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const ms = useQuery({ queryKey: MEMBERSHIPS_KEY, queryFn: () => api.get<{ active: MembershipView | null; history: MembershipView[] }>('/memberships/me') });
  const m = ms.data?.history.find((x) => x.id === payment.membership || x.payment === payment.id);
  const getReceipt = async () => {
    setDownloading(true);
    try {
      await download(`/payments/${payment.id}/receipt`, undefined, `${payment.receiptNumber ?? 'receipt'}.pdf`);
    } catch (err) {
      toast.error(err);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg">
      <div className="card relative overflow-hidden p-7 text-center md:p-9">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.08]" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }} className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-on-primary shadow-glow">
          <Check className="h-10 w-10" strokeWidth={3} />
        </motion.div>
        <h1 className="relative mt-5 font-display text-2xl font-semibold md:text-3xl">{payment.amountMinor > 0 ? 'Payment confirmed' : 'Membership activated'}</h1>
        <p className="relative mt-1 text-muted">Welcome aboard — your {payment.planName} membership is locked in.</p>
        <div className="relative mt-6 space-y-2 rounded-2xl bg-fg/[0.04] p-4 text-left text-sm">
          {m ? (
            <>
              <Row label="Status" value={m.status === 'upcoming' ? 'Queued (starts later)' : 'Active'} />
              <Row label="Starts" value={fmtDate(m.startDate)} />
              <Row label="Ends" value={fmtDate(m.endDate)} />
            </>
          ) : ms.isLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : null}
          <Row label="Amount paid" value={money(payment.amountMinor)} />
          {payment.discountMinor > 0 && <Row label="You saved" value={money(payment.discountMinor)} />}
          {payment.receiptNumber && <Row label="Receipt" value={payment.receiptNumber} />}
        </div>
        <div className="relative mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {payment.receiptNumber && (
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={downloading} onClick={getReceipt}>
              Download receipt
            </Button>
          )}
          <ButtonLink to="/member">Go to dashboard</ButtonLink>
        </div>
        <p className="relative mt-4 text-xs text-muted">
          Next: <Link to="/member/book" className="text-primary hover:underline">book your first class</Link> or grab your <Link to="/member/attendance" className="text-primary hover:underline">check-in QR</Link>.
        </p>
      </div>
    </motion.div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-5xl">
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
