import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Alert, Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().email('Enter a valid email') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we’ll send a reset link." footer={<Link to="/login" className="text-primary hover:underline">Back to sign in</Link>}>
      {sent ? (
        <Alert tone="success" title="Check your email">
          If an account exists for that address, a reset link is on its way. It expires in 60 minutes.
        </Alert>
      ) : (
        <form
          noValidate
          className="space-y-5"
          onSubmit={handleSubmit(async (v) => {
            setErr(null);
            try {
              await api.post('/auth/forgot-password', v);
              setSent(true);
            } catch (e) {
              setErr(errorMessage(e));
            }
          })}
        >
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
