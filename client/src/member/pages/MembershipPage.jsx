import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, ShieldCheck, TicketPercent, FlaskConical } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../hooks/useSettings.js';
import { usePlans, PeriodToggle } from '../../components/sections/Pricing.jsx';
import { PageHeader, Card, StatusBadge, KeyValue } from '../../components/dashboard/Widgets.jsx';
import { Modal } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { Field, Textarea, FormAlert } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate, formatPaise, PERIODS } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import { payWithRazorpay } from '../checkout.js';

export const MEMBERSHIP_KEY = ['membership', 'me'];
export const useMyMembership = () => useQuery({ queryKey: MEMBERSHIP_KEY, queryFn: async () => (await api.get('/memberships/me')).data });

function SandboxModal({ order, onClose, onResult }) {
  const [busy, setBusy] = useState(false);
  const succeed = async () => {
    setBusy(true);
    try { onResult(await api.post('/payments/verify', { orderId: order.orderId })); } catch (err) { onResult(null, err); } finally { setBusy(false); }
  };
  const fail = async () => { await api.post(`/payments/${order.paymentId}/cancel`, { reason: 'Sandbox: simulated failure' }).catch(() => {}); onResult(null, new Error('Simulated payment failure. No membership was created.')); };
  return (
    <Modal open onClose={onClose} size="sm" title="Test payment (sandbox)"
      footer={<><Button variant="ghost" size="sm" onClick={fail}>Simulate failure</Button><Button size="sm" loading={busy} onClick={succeed}>Simulate success</Button></>}>
      <div className="flex gap-3 rounded-brand border border-gold/40 bg-gold/5 p-4 text-sm">
        <FlaskConical className="h-5 w-5 shrink-0 text-gold" aria-hidden />
        <p>This server has no Razorpay keys, so a <strong>test gateway</strong> is used. No money is charged. It is automatically disabled in production.</p>
      </div>
      <p className="mt-4 text-sm">Amount: <strong>{formatPaise(order.amountPaise)}</strong> for {order.quote.plan.name} ({PERIODS[order.quote.period].label}).</p>
    </Modal>
  );
}

function Checkout({ plans, initialPlan, initialPeriod, isRenewal }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const [planId, setPlanId] = useState(() => plans.find((p) => p.slug === initialPlan)?._id || plans.find((p) => p.isFeatured)?._id || plans[0]?._id);
  const plan = plans.find((p) => p._id === planId);
  const periods = plan?.pricing.map((o) => o.period) || [];
  const [period, setPeriod] = useState(initialPeriod || 'monthly');
  const activePeriod = periods.includes(period) ? period : periods[0];
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sandbox, setSandbox] = useState(null);
  const [done, setDone] = useState(null);

  const quote = useQuery({
    queryKey: ['quote', planId, activePeriod, applied],
    queryFn: async () => (await api.post('/payments/quote', { planId, period: activePeriod, couponCode: applied || undefined })).data,
    enabled: Boolean(planId && activePeriod),
    retry: false,
  });
  useEffect(() => { if (quote.error && applied) { setError(quote.error.fieldErrors?.().couponCode || quote.error.message); setApplied(''); } }, [quote.error, applied]);

  const finish = (res, err) => {
    setSandbox(null);
    setBusy(false);
    if (err) { if (!err.cancelled) setError(err.message); else toast.info('Payment cancelled — you have not been charged.'); return; }
    qc.invalidateQueries({ queryKey: MEMBERSHIP_KEY });
    qc.invalidateQueries({ queryKey: ['payments', 'me'] });
    if (res.data.status === 'pending') toast.info(res.message);
    setDone(res);
  };

  const pay = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/payments/order', { planId, period: activePeriod, couponCode: applied || undefined });
      const order = res.data;
      if (order.completed) return finish(res);
      if (order.provider === 'sandbox') return setSandbox(order);
      return finish(await payWithRazorpay(order, { brand: settings.brand.name, accent: settings.theme.accent }));
    } catch (err) { return finish(null, err); }
  };

  if (done) {
    return (
      <Card>
        <div className="py-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"><Check className="h-7 w-7" aria-hidden /></span>
          <h2 className="mt-4 font-sans text-xl font-semibold">{done.data.status === 'pending' ? 'Payment processing' : 'Welcome to the club!'}</h2>
          <p className="mt-2 text-sm text-muted">{done.message}</p>
          <div className="mt-6 flex justify-center gap-3"><Button to="/dashboard" size="sm">Go to dashboard</Button><Button to="/dashboard/payments" size="sm" variant="outline">View receipt</Button></div>
        </div>
      </Card>
    );
  }

  const q = quote.data;
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Choose a plan" className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => {
            const o = p.pricing.find((x) => x.period === 'monthly') || p.pricing[0];
            return (
              <button key={p._id} type="button" role="radio" aria-checked={planId === p._id} onClick={() => setPlanId(p._id)}
                className={cn('rounded-brand border p-4 text-left transition', planId === p._id ? 'border-gold bg-gold/10' : 'border-line/10 bg-surface hover:border-gold/40')}>
                <p className="flex items-center justify-between font-semibold">{p.name}{p.isFeatured && <Crown className="h-4 w-4 text-gold" aria-label="Most popular" />}</p>
                <p className="mt-1 text-sm text-muted">from {formatPaise(o.pricePaise / (PERIODS[o.period].months))}/mo</p>
              </button>
            );
          })}
        </div>
        {plan && (
          <Card title={`${plan.name} includes`}>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">{plan.benefits.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{b}</li>)}</ul>
          </Card>
        )}
      </div>
      <Card title={isRenewal ? 'Renew membership' : 'Checkout'}>
        {periods.length > 1 && <div className="-mt-2 mb-2 [&>div]:mb-6"><PeriodToggle periods={periods} value={activePeriod} onChange={setPeriod} /></div>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setError(''); setApplied(coupon.trim().toUpperCase()); }}>
          <label htmlFor="coupon" className="sr-only">Coupon code</label>
          <input id="coupon" className="input h-11 uppercase placeholder:normal-case" placeholder="Coupon or referral code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
          <Button type="submit" variant="outline" size="md" disabled={!coupon.trim()}><TicketPercent className="h-4 w-4" aria-hidden />Apply</Button>
        </form>
        <dl className="mt-6 space-y-2 text-sm">
          {quote.isLoading ? <Skeleton className="h-24" /> : q && (
            <>
              <div className="flex justify-between"><dt className="text-muted">{q.plan.name} · {PERIODS[q.period].label}</dt><dd>{formatPaise(q.basePaise)}</dd></div>
              {q.joiningFeePaise > 0 && <div className="flex justify-between"><dt className="text-muted">One-time joining fee</dt><dd>{formatPaise(q.joiningFeePaise)}</dd></div>}
              {q.discountPaise > 0 && <div className="flex justify-between text-success"><dt>Discount ({q.coupon?.code})</dt><dd>−{formatPaise(q.discountPaise)}</dd></div>}
              <div className="flex justify-between border-t border-line/10 pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatPaise(q.amountPaise)}</dd></div>
              {q.isRenewal && <p className="text-xs text-muted">Your new period starts the day your current membership ends — no days are lost.</p>}
            </>
          )}
        </dl>
        <FormAlert>{error}</FormAlert>
        {!user.emailVerified && <p className="mt-4 rounded-brand border border-danger/30 bg-danger/5 p-3 text-sm">Verify your email before purchasing. <Link to="/dashboard/profile" className="text-gold underline">Resend the link</Link></p>}
        <Button className="mt-6 w-full" size="lg" onClick={pay} loading={busy} disabled={!q || !user.emailVerified}>Pay {q ? formatPaise(q.amountPaise) : ''}</Button>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 text-gold" aria-hidden />UPI, cards & netbanking via Razorpay. We never see your card details.</p>
        <p className="mt-2 text-center text-xs text-muted">By paying you agree to the <Link to="/memberships#policies" className="underline">membership terms and refund policy</Link>.</p>
      </Card>
      {sandbox && <SandboxModal order={sandbox} onClose={() => finish(null, Object.assign(new Error('cancelled'), { cancelled: true }))} onResult={finish} />}
    </div>
  );
}

function CancelRequest({ membership, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (membership.cancellation?.status === 'requested') return <p className="text-sm text-muted">Cancellation requested on {formatDate(membership.cancellation.requestedAt)} — our team will contact you.</p>;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Request cancellation</Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="Request cancellation"
        footer={<><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Keep membership</Button><Button size="sm" variant="danger" loading={busy} disabled={reason.trim().length < 5}
          onClick={async () => { setBusy(true); try { toast.success((await api.post(`/memberships/${membership._id}/cancel-request`, { reason })).message); setOpen(false); onDone(); } catch (err) { toast.error(err); } finally { setBusy(false); } }}>Send request</Button></>}>
        <p className="text-sm text-muted">Requests are reviewed within 3 business days. See the <Link to="/memberships#policies" className="text-gold underline">cancellation & refund policy</Link>.</p>
        <Field label="Reason" className="mt-4" required>{(a) => <Textarea {...a} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Modal>
    </>
  );
}

export default function MembershipPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const mine = useMyMembership();
  const plans = usePlans();
  const [showCheckout, setShowCheckout] = useState(Boolean(params.get('plan')) || params.get('renew') === '1');
  const current = mine.data?.current;
  const history = useMemo(() => (mine.data?.history || []).filter((m) => m._id !== current?._id), [mine.data, current]);

  if (mine.isError || plans.isError) return <ErrorState message={(mine.error || plans.error).message} onRetry={() => { mine.refetch(); plans.refetch(); }} />;
  if (mine.isLoading || plans.isLoading) return <Skeleton className="h-96" />;
  return (
    <>
      <Seo title="Membership" noindex />
      <PageHeader title="Membership" description="Your plan, renewal and history." />
      {current ? (
        <Card className="mb-6 border-gold/40 bg-gradient-to-br from-gold/10 to-surface">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">Current plan</p>
              <h2 className="mt-2 text-3xl font-semibold">{current.plan.name}</h2>
              <p className="mt-1 text-sm text-muted">{PERIODS[current.period].label} · {formatDate(current.startDate)} – {formatDate(current.endDate)}</p>
            </div>
            <div className="text-left md:text-right">
              <p className={cn('font-display text-5xl font-semibold', mine.data.daysLeft <= 7 ? 'text-danger' : 'text-gold-metal')}>{mine.data.daysLeft}</p>
              <p className="text-xs uppercase tracking-wider text-muted">days left</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line/10 pt-5">
            {!showCheckout && <Button size="sm" onClick={() => setShowCheckout(true)}>{mine.data.upcoming.length ? 'Extend further' : 'Renew now'}</Button>}
            <CancelRequest membership={current} onDone={() => qc.invalidateQueries({ queryKey: ['membership', 'me'] })} />
          </div>
          {mine.data.upcoming.length > 0 && <p className="mt-4 text-sm text-success">Renewed — your next period starts {formatDate(mine.data.upcoming[0].startDate)}.</p>}
        </Card>
      ) : !showCheckout && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><h2 className="font-sans text-lg font-semibold">No active membership</h2><p className="text-sm text-muted">Choose a plan to unlock bookings, classes and QR check-in.</p></div>
            <Button size="sm" onClick={() => setShowCheckout(true)}>Choose a plan</Button>
          </div>
        </Card>
      )}
      {showCheckout && (plans.data.length ? <Checkout plans={plans.data} initialPlan={params.get('plan')} initialPeriod={params.get('period')} isRenewal={Boolean(current)} /> : <ErrorState title="No plans available" message="Please contact the front desk." />)}
      {current?.plan?.limits && (
        <Card title="Plan allowances" className="mt-6">
          <KeyValue items={[['Personal training', current.plan.limits.ptSessionsPerMonth ? `${current.plan.limits.ptSessionsPerMonth} sessions / month` : 'Not included'], ['Group classes', current.plan.limits.classesPerWeek ? `${current.plan.limits.classesPerWeek} per week` : 'Unlimited'], ['Guest passes', `${current.plan.limits.guestPassesPerMonth || 0} / month`]]} />
        </Card>
      )}
      {history.length > 0 && (
        <Card title="History" className="mt-6" padded={false}>
          <ul className="divide-y divide-line/5 text-sm">
            {history.map((m) => <li key={m._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><span>{m.plan?.name} · {PERIODS[m.period].label}</span><span className="text-muted">{formatDate(m.startDate)} – {formatDate(m.endDate)}</span><StatusBadge status={m.status} /></li>)}
          </ul>
        </Card>
      )}
    </>
  );
}
