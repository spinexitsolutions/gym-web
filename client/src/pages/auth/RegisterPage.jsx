import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthHeading } from '../../layouts/AuthLayout.jsx';
import { TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { PasswordField } from '../../forms/PasswordField.jsx';
import { registerSchema } from '../../forms/schemas.js';
import { Button } from '../../components/ui/Button.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { usePlans } from '../../components/sections/Pricing.jsx';
import { formatPaise, PERIODS } from '../../utils/format.js';

function SelectedPlan({ slug, period }) {
  const { data: plans } = usePlans();
  const plan = plans?.find((p) => p.slug === slug);
  const option = plan?.pricing.find((o) => o.period === period) || plan?.pricing[0];
  if (!plan || !option) return null;
  return (
    <div className="mb-6 rounded-brand border border-gold/40 bg-gold/5 p-4 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted">Selected plan</p>
      <p className="mt-1 font-semibold">{plan.name} · {PERIODS[option.period].label} — {formatPaise(option.pricePaise)}</p>
      <p className="mt-1 text-xs text-muted">Create your account, verify your email, then pay securely to activate it.</p>
    </div>
  );
}

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { referralCode: params.get('ref') || '', acceptTerms: false },
  });

  const onSubmit = async ({ confirmPassword: _c, ...values }) => {
    setFormError('');
    try {
      await signUp(values);
      const plan = params.get('plan');
      navigate(plan ? `/dashboard/membership?plan=${encodeURIComponent(plan)}&period=${encodeURIComponent(params.get('period') || '')}` : '/dashboard/profile?welcome=1', { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  };

  return (
    <>
      <Seo title="Create account" noindex />
      <AuthHeading title="Join the club" lead="Create your member account in under a minute." />
      {params.get('plan') && <SelectedPlan slug={params.get('plan')} period={params.get('period')} />}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormAlert>{error}</FormAlert>
        <TextField label="Full name" name="name" autoComplete="name" register={register} errors={errors} required />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Email" name="email" type="email" autoComplete="email" register={register} errors={errors} required />
          <TextField label="Phone" name="phone" type="tel" autoComplete="tel" register={register} errors={errors} />
        </div>
        <PasswordField name="password" register={register} errors={errors} autoComplete="new-password" hint="8+ characters with upper- and lowercase letters and a number." />
        <PasswordField label="Confirm password" name="confirmPassword" register={register} errors={errors} autoComplete="new-password" />
        <TextField label="Referral code" name="referralCode" register={register} errors={errors} hint="Optional — from a friend who's already a member." />
        <div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" aria-invalid={errors.acceptTerms ? 'true' : undefined} {...register('acceptTerms')} />
            <span>I agree to the <Link to="/memberships#policies" className="text-gold hover:underline">membership terms, cancellation and refund policies</Link>.</span>
          </label>
          {errors.acceptTerms && <p className="mt-1 text-xs text-danger" role="alert">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">Create account</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">Already a member? <Link to="/login" className="text-gold hover:underline">Log in</Link></p>
    </>
  );
}
