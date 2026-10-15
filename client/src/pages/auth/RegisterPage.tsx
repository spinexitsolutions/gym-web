import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { homeForRole, useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { Alert, Button, Checkbox, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { AuthShell, safeNext } from './AuthShell';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, 'Enter a valid phone number').optional(),
    password: z.string().min(10, 'Use at least 10 characters').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
    confirm: z.string(),
    referralCode: z.string().trim().max(12).optional(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the terms to continue'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: signUp, user } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState<string | null>(null);
  const [verify, setVerify] = useState(false);
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { referralCode: params.get('ref') ?? '', acceptTerms: false } });

  if (user) return <Navigate to={next ?? homeForRole(user.role)} replace />;

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      const res = await signUp({ name: v.name, email: v.email, password: v.password, phone: v.phone || undefined, referralCode: v.referralCode || undefined, acceptTerms: true });
      if (res.verificationRequired) setVerify(true);
      else navigate(next ?? '/member', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        Object.entries(fe).forEach(([k, m]) => setError(k as keyof Values, { message: m }));
        if (!Object.keys(fe).length) setFormError(err.message);
      } else setFormError('Could not create your account. Please try again.');
    }
  };

  if (verify)
    return (
      <AuthShell title="Check your inbox" subtitle="We sent you a link to verify your email address. Open it to activate your account.">
        <Link to="/login" className="btn btn-primary">
          Go to sign in
        </Link>
      </AuthShell>
    );

  const privacy = site?.settings.privacy;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join to book classes, track progress and manage your membership."
      footer={
        <>
          Already a member?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Full name" autoComplete="name" error={formState.errors.name?.message} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
          <Input label="Phone (optional)" type="tel" autoComplete="tel" error={formState.errors.phone?.message} {...register('phone')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Password" type="password" autoComplete="new-password" hint="10+ characters with letters and numbers" error={formState.errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        </div>
        <Input label="Referral code (optional)" autoCapitalize="characters" error={formState.errors.referralCode?.message} {...register('referralCode')} />
        <Checkbox
          label={
            <>
              I agree to the{' '}
              <a href={privacy?.termsUrl || '/terms'} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                terms
              </a>{' '}
              and{' '}
              <a href={privacy?.privacyPolicyUrl || '/privacy'} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                privacy policy
              </a>
              .
            </>
          }
          error={formState.errors.acceptTerms?.message}
          {...register('acceptTerms')}
        />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
