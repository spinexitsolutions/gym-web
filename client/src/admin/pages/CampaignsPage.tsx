import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Send, ShieldCheck, Users } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, Input, PageHeader, Select, StatCard, Switch, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { applyApiErrors } from '../components/utils';

const AUDIENCES = [
  { value: 'expiring_14', label: 'Expiring within 14 days', hint: 'Active members whose membership ends in the next 2 weeks — the classic renewal nudge.' },
  { value: 'expired_30', label: 'Expired in the last 30 days', hint: 'Lapsed members without a current or upcoming membership — win-back offers.' },
  { value: 'active', label: 'All active members', hint: 'Everyone with an active membership — events, new classes, announcements.' },
  { value: 'no_membership', label: 'Registered, never purchased', hint: 'Accounts that never bought a plan — trial or first-month offers.' },
] as const;

const schema = z.object({
    key: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, '3–40 lowercase letters, numbers and hyphens'),
    audience: z.enum(['expiring_14', 'expired_30', 'active', 'no_membership']),
    title: z.string().trim().min(3, 'At least 3 characters').max(140),
    body: z.string().trim().min(3, 'At least 3 characters').max(1000),
    link: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(v), 'Use a relative path (/memberships) or a full https:// link'),
    email: z.boolean(),
    whatsapp: z.boolean(),
  });
type Form = z.infer<typeof schema>;
interface Result {
  audience: number;
  optedIn: number;
  sent: number;
}

export default function CampaignsPage() {
  const toast = useToast();
  const [confirm, setConfirm] = useState<Form | null>(null);
  const [history, setHistory] = useState<(Result & { key: string; at: Date; title: string })[]>([]);
  const { register, control, handleSubmit, watch, setError, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { key: `renewal-${new Date().toISOString().slice(0, 7)}`, audience: 'expiring_14', title: 'Your membership is ending soon', body: 'Renew now to keep your streak going — your coaches are ready for your next block.', link: '/memberships', email: true, whatsapp: false },
  });
  const audience = watch('audience');
  const send = useMutation({
    mutationFn: (f: Form) => api.post<Result>('/notifications/campaigns', { ...f, link: f.link || '/memberships' }),
    onSuccess: (r, f) => {
      setConfirm(null);
      setHistory((h) => [{ ...r, key: f.key, title: f.title, at: new Date() }, ...h]);
      if (r.sent) toast.success(`Campaign sent to ${r.sent} member${r.sent === 1 ? '' : 's'}`, r.optedIn > r.sent ? `${r.optedIn - r.sent} had already received “${f.key}”.` : undefined);
      else toast.info('No new recipients', r.optedIn ? `Everyone eligible already received “${f.key}”.` : 'Nobody in this audience has opted into marketing messages.');
    },
    onError: (err) => {
      setConfirm(null);
      if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  const last = history[0];
  return (
    <div>
      <PageHeader eyebrow="Revenue" title="Campaigns" description="Send a one-off message to a member segment by in-app notification, email and optionally WhatsApp." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="New campaign" />
          <CardBody>
            <form id="campaign-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => setConfirm(f))} noValidate>
              <Select label="Audience" required wrapClassName="sm:col-span-2" options={AUDIENCES.map((a) => ({ value: a.value, label: a.label }))} hint={AUDIENCES.find((a) => a.value === audience)?.hint} {...register('audience')} />
              <Input label="Campaign key" required className="font-mono" error={e.key?.message} hint="Each member receives a given key only once — reuse it to safely re-send to newcomers; change it for a new message." {...register('key')} />
              <Input label="Link" placeholder="/memberships" error={e.link?.message} hint="Where the notification button leads." {...register('link')} />
              <Input label="Title" required wrapClassName="sm:col-span-2" maxLength={140} error={e.title?.message} {...register('title')} />
              <Textarea label="Message" required rows={5} wrapClassName="sm:col-span-2" maxLength={1000} error={e.body?.message} hint={`${watch('body')?.length ?? 0}/1000`} {...register('body')} />
              <div className="grid gap-4 rounded-theme-sm border border-line p-4 sm:col-span-2 sm:grid-cols-2">
                <Controller control={control} name="email" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Email" description="Also send by email." />} />
                <Controller control={control} name="whatsapp" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="WhatsApp" description="Only if a WhatsApp provider is configured." />} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" icon={<Send className="h-4 w-4" />}>
                  Review & send
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Alert tone="info" title="Who receives it">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Only active accounts that <strong>opted into marketing</strong> messages in their settings.</li>
              <li>Each campaign key is delivered <strong>once per member</strong> — re-sending never duplicates.</li>
              <li>Every send is recorded in the audit log.</li>
            </ul>
          </Alert>
          {last ? (
            <Card>
              <CardHeader title="Last send" description={`${last.key} · ${fmtDateTime(last.at)}`} />
              <CardBody className="grid grid-cols-3 gap-2">
                <StatCard className="p-3" label="Audience" value={last.audience} />
                <StatCard className="p-3" label="Opted in" value={last.optedIn} />
                <StatCard className="p-3" label="Sent" value={last.sent} tone="primary" />
              </CardBody>
              {history.length > 1 && (
                <ul className="divide-y divide-line/70 border-t border-line/70 text-sm">
                  {history.slice(1).map((h, i) => (
                    <li key={i} className="flex justify-between gap-2 px-5 py-2.5">
                      <code className="truncate text-xs">{h.key}</code>
                      <span className="shrink-0 text-xs text-muted">
                        {h.sent}/{h.optedIn} sent
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card className="p-6 text-center text-sm text-muted">
              <Megaphone className="mx-auto mb-2 h-6 w-6 opacity-60" />
              Results from campaigns sent in this session appear here. Past sends are in the audit log.
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && send.mutate(confirm)}
        loading={send.isPending}
        title="Send this campaign?"
        description={confirm ? `“${confirm.title}” to ${AUDIENCES.find((a) => a.value === confirm.audience)?.label.toLowerCase()}, via in-app${confirm.email ? ', email' : ''}${confirm.whatsapp ? ', WhatsApp' : ''}.` : undefined}
        confirmLabel="Send now"
      >
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Members who already received key <code className="text-fg">{confirm?.key}</code> are skipped automatically.
        </p>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted">
          <Users className="mt-0.5 h-4 w-4 shrink-0" /> Only members who opted into marketing messages are included.
        </p>
      </ConfirmDialog>
    </div>
  );
}
