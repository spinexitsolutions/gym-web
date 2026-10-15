import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { homeForRole, useAuth } from '@/app/AuthProvider';
import { Alert, Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { AuthShell, safeNext } from './AuthShell';
import { useState } from 'react';

const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={next ?? homeForRole(user.role)} replace />;

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      const u = await login(v.email, v.password);
      navigate(next ?? homeForRole(u.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your membership, bookings and progress."
      footer={
        <>
          New here?{' '}
          <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
