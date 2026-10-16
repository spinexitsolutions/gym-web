import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, KeyRound, MailWarning } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Button, Card, CardBody, CardHeader, Input, PageHeader, Switch, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/types/api';
import { applyFieldErrors, zr } from '../components/utils';

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(128)
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });
type PwForm = z.output<typeof pwSchema>;

type Prefs = User['notificationPrefs'];

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const current = prefs ?? user?.notificationPrefs ?? { email: true, whatsapp: false, marketing: false };

  const pw = useForm<PwForm>({ resolver: zr<PwForm>(pwSchema) });
  const changePw = useMutation({
    mutationFn: (v: PwForm) => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => {
      pw.reset({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed', 'Other devices may need to sign in again.');
    },
    onError: (err) => !applyFieldErrors(err, pw.setError) && toast.error(err),
  });

  const savePrefs = useMutation({
    mutationFn: (p: Partial<Prefs>) => api.patch('/members/me', { notificationPrefs: p }),
    onSuccess: () => {
      toast.success('Preferences saved');
      void refresh();
      void qc.invalidateQueries({ queryKey: ['member', 'me'] });
    },
    onError: (err) => {
      setPrefs(null);
      toast.error(err);
    },
  });
  const toggle = (k: keyof Prefs, v: boolean) => {
    setPrefs({ ...current, [k]: v });
    savePrefs.mutate({ [k]: v });
  };

  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification'),
    onSuccess: () => toast.success('Verification email sent', `Check ${user?.email} (and your spam folder).`),
    onError: (err) => toast.error(err),
  });

  const pe = pw.formState.errors;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader eyebrow="Account" title="Settings" description="Security and how we keep in touch." />

      <Card>
        <CardHeader title="Email" />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {user?.emailVerified ? <CheckCircle2 className="h-5 w-5 text-success" /> : <MailWarning className="h-5 w-5 text-warning" />}
            <div>
              <p className="font-medium">{user?.email}</p>
              <p className="text-xs text-muted">{user?.emailVerified ? 'Verified — receipts and reminders will reach you.' : 'Not verified yet — verify to receive receipts and reminders.'}</p>
            </div>
          </div>
          {!user?.emailVerified && (
            <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
              Resend verification
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /> Notifications</span>} description="In-app notifications are always on. Payment receipts and security emails are always sent." />
        <CardBody className="space-y-5">
          <Switch checked={current.email} disabled={savePrefs.isPending} onChange={(v) => toggle('email', v)} label="Email updates" description="Booking confirmations, class changes and membership reminders." />
          <Switch checked={current.whatsapp} disabled={savePrefs.isPending} onChange={(v) => toggle('whatsapp', v)} label="WhatsApp messages" description="Time-sensitive alerts like waitlist promotions, to your phone number." />
          <Switch checked={current.marketing} disabled={savePrefs.isPending} onChange={(v) => toggle('marketing', v)} label="Offers & news" description="Occasional promotions, events and new programmes. Unsubscribe any time." />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Change password</span>} />
        <CardBody>
          <form noValidate className="space-y-4" onSubmit={pw.handleSubmit((v) => changePw.mutate(v))}>
            <Input label="Current password" type="password" autoComplete="current-password" {...pw.register('currentPassword')} error={pe.currentPassword?.message} />
            <Input label="New password" type="password" autoComplete="new-password" {...pw.register('newPassword')} error={pe.newPassword?.message} hint="At least 10 characters, including a letter and a number." />
            <Input label="Confirm new password" type="password" autoComplete="new-password" {...pw.register('confirm')} error={pe.confirm?.message} />
            <Button type="submit" loading={changePw.isPending}>
              Update password
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
