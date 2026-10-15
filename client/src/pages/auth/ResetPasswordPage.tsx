import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { AuthShell } from './AuthShell';

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <AuthShell title="Choose a new password" subtitle="Signing in again will be required on all devices.">
      {!token ? (
        <Alert tone="danger" title="Invalid link">
          This reset link is incomplete. <Link to="/forgot-password" className="underline">Request a new one</Link>.
        </Alert>
      ) : done ? (
        <div className="space-y-5">
          <Alert tone="success" title="Password updated">You can now sign in with your new password.</Alert>
          <Link to="/login" className="btn btn-primary w-full">
            Sign in
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-5"
          onSubmit={handleSubmit(async (v) => {
            setErr(null);
            try {
              await api.post('/auth/reset-password', { token, password: v.password });
              setDone(true);
            } catch (e) {
              setErr(errorMessage(e));
            }
          })}
        >
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="New password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
