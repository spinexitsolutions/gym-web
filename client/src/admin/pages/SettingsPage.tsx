import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { siteSettingsSchema, type SiteSettings } from '@apex/shared';
import { CheckCircle2, CircleAlert, CircleDashed, Lock, RotateCcw, Save } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, ErrorState, Input, KeyValue, PageHeader, Select, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime, titleCase } from '@/lib/format';
import { ImageUploadField } from '../components/ImageUploadField';
import type { SystemStatus } from '../components/types';
import { applyApiErrors } from '../components/utils';

type FormIn = z.input<typeof siteSettingsSchema>;
type TabKey = 'brand' | 'contact' | 'hours' | 'social' | 'business' | 'seo' | 'notifications' | 'privacy' | 'bookings' | 'loyalty' | 'system';

const TABS: { value: TabKey; label: string; fields: (keyof SiteSettings)[] }[] = [
  { value: 'brand', label: 'Gym info', fields: ['brand', 'announcement'] },
  { value: 'contact', label: 'Contact & location', fields: ['contact', 'location'] },
  { value: 'hours', label: 'Business hours', fields: ['hours'] },
  { value: 'social', label: 'Social links', fields: ['social'] },
  { value: 'business', label: 'Business', fields: ['business'] },
  { value: 'seo', label: 'SEO defaults', fields: ['seo'] },
  { value: 'notifications', label: 'Notifications', fields: ['notifications'] },
  { value: 'privacy', label: 'Privacy & consent', fields: ['privacy'] },
  { value: 'bookings', label: 'Bookings policy', fields: ['bookings'] },
  { value: 'loyalty', label: 'Loyalty', fields: ['loyalty'] },
  { value: 'system', label: 'System status', fields: [] },
];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<(typeof DAYS)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

/** Ensures all 7 days exist (in order) so the hours editor is complete. */
function normalize(s: SiteSettings): FormIn {
  const hours = DAYS.map((d) => s.hours.find((h) => h.day === d) ?? { day: d, open: '06:00', close: '22:00', closed: false });
  return { ...s, hours };
}

const nullableNumber = { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v)) };
const num = { valueAsNumber: true } as const;

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

function get(errors: FieldErrors<FormIn>, path: string): string | undefined {
  let cur: unknown = errors;
  for (const p of path.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
  return cur && typeof cur === 'object' && 'message' in cur ? String((cur as { message?: string }).message ?? '') || undefined : undefined;
}

function TimezoneField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      return [];
    }
  }, []);
  if (!zones.length) return <Input label="Timezone" value={value} onChange={(e) => onChange(e.target.value)} error={error} hint="IANA name, e.g. Asia/Kolkata" />;
  return <Select label="Timezone" value={value} onChange={(e) => onChange(e.target.value)} options={(zones.includes(value) ? zones : [value, ...zones]).map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))} error={error} hint="Used for reports, check-in days and reminders." />;
}

function ReminderDaysField({ value, onChange, error }: { value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);
  return (
    <Input
      label="Expiry reminders (days before)"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = Array.from(new Set(text.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n > 0)))
          .sort((a, b) => b - a)
          .slice(0, 5);
        onChange(parsed);
        setText(parsed.join(', '));
      }}
      error={error}
      hint="Up to 5 values between 1 and 60, e.g. 7, 3, 1"
    />
  );
}

function StatusRow({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail: ReactNode }) {
  const Icon = ok ? CheckCircle2 : warn ? CircleAlert : CircleDashed;
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ok ? 'text-success' : warn ? 'text-warning' : 'text-muted')} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}

function SystemStatusPanel() {
  const q = useQuery({ queryKey: ['admin', 'system-status'], queryFn: () => api.get<SystemStatus>('/settings/system-status'), refetchInterval: 60_000 });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-96" />;
  const s = q.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Integrations" description={`Environment: ${s.environment}. Secrets are never shown here — configure them in the server environment.`} />
        <ul className="divide-y divide-line/70">
          <StatusRow
            ok={s.payments.configured && !s.payments.testMode && s.payments.webhookConfigured}
            warn={s.payments.configured}
            label={`Payments · ${titleCase(s.payments.provider)}`}
            detail={!s.payments.configured ? 'Not configured — only offline payments can be recorded.' : `${s.payments.testMode ? 'Test mode (no real money)' : 'Live mode'} · webhook ${s.payments.webhookConfigured ? 'configured' : 'NOT configured'}`}
          />
          <StatusRow ok={s.email.configured} label="Email" detail={s.email.configured ? `Sending as “${s.email.from}”` : 'Not configured — emails are logged on the server instead of sent.'} />
          <StatusRow ok={s.whatsapp.configured} label={`WhatsApp · ${titleCase(s.whatsapp.provider)}`} detail={s.whatsapp.configured ? 'Configured' : 'Not configured — WhatsApp messages are skipped.'} />
          <StatusRow ok label={`Storage · ${titleCase(s.storage.driver)}`} detail={`Max image ${s.storage.maxImageMb} MB · max 3D model ${s.storage.maxModelMb} MB`} />
          <StatusRow ok={s.emailVerificationRequired} warn={!s.emailVerificationRequired} label="Email verification" detail={s.emailVerificationRequired ? 'Required for new member accounts.' : 'Not required — members can sign in without verifying their email.'} />
        </ul>
      </Card>
      <Card>
        <CardHeader title="Scheduled jobs" description={s.jobsEnabled ? 'Background jobs are enabled.' : 'Background jobs are DISABLED on this server.'} />
        {s.jobs.length === 0 ? (
          <p className="p-5 text-sm text-muted">No job has run yet.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {s.jobs.map((j) => (
              <li key={j._id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                {j.lastStatus === 'ok' ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /> : j.lastStatus === 'error' ? <CircleAlert className="mt-0.5 h-5 w-5 text-danger" /> : <CircleDashed className="mt-0.5 h-5 w-5 text-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{titleCase(j.name.replace(/([A-Z])/g, ' $1'))}</p>
                  <p className="text-xs text-muted" title={fmtDateTime(j.lastFinishedAt ?? j.lastStartedAt)}>
                    Last run {j.lastFinishedAt || j.lastStartedAt ? relativeTime((j.lastFinishedAt ?? j.lastStartedAt)!) : 'never'}
                    {j.lastResult && typeof j.lastResult === 'object' ? ` · ${Object.entries(j.lastResult as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}` : ''}
                  </p>
                  {j.lastError && <p className="mt-1 break-words text-xs text-danger">{j.lastError}</p>}
                </div>
                <Badge tone={j.lastStatus === 'ok' ? 'success' : j.lastStatus === 'error' ? 'danger' : 'neutral'}>{j.lastStatus ?? 'unknown'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <CardBody>
          <KeyValue
            className="sm:grid-cols-3"
            items={[
              { label: 'Environment', value: s.environment },
              { label: 'Jobs', value: s.jobsEnabled ? 'Enabled' : 'Disabled' },
              { label: 'Last checked', value: fmtDateTime(new Date()) },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('brand');
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<SiteSettings>('/settings') });
  const { register, control, handleSubmit, reset, setError, formState } = useForm<FormIn, unknown, SiteSettings>({ resolver: zodResolver(siteSettingsSchema) as unknown as Resolver<FormIn, unknown, SiteSettings> });
  useEffect(() => {
    if (q.data) reset(normalize(q.data));
  }, [q.data, reset]);
  const errors = formState.errors;
  const tabHasError = (t: (typeof TABS)[number]) => t.fields.some((f) => Boolean((errors as Record<string, unknown>)[f]));

  const save = useMutation({
    mutationFn: (s: SiteSettings) => api.put<SiteSettings>('/settings', s),
    onSuccess: (s) => {
      toast.success('Settings saved', 'The website picks up changes immediately.');
      qc.setQueryData(['admin', 'settings'], s);
      void qc.invalidateQueries({ queryKey: ['site'] });
      reset(normalize(s));
    },
    onError: (err) => {
      if (applyApiErrors(err, setError)) toast.error('Some fields need attention', 'Check the tabs marked with a dot.');
      else toast.error(err);
    },
  });
  const onInvalid = (errs: FieldErrors<FormIn>) => {
    const first = TABS.find((t) => t.fields.some((f) => Boolean((errs as Record<string, unknown>)[f])));
    if (first) setTab(first.value);
    toast.error('Some fields need attention', first ? `See “${first.label}”.` : undefined);
  };

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = (p: string) => get(errors, p);
  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" description="Gym details, policies and notifications used across the website and dashboards." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-current={tab === t.value ? 'page' : undefined}
              onClick={() => setTab(t.value)}
              className={cn('flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-theme-sm px-3 py-2 text-left text-sm transition', tab === t.value ? 'bg-primary/12 font-medium text-primary' : 'text-muted hover:bg-fg/[0.04] hover:text-fg')}
            >
              {t.label}
              {tabHasError(t) && <span className="h-2 w-2 rounded-full bg-danger" aria-label="has errors" />}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'system' ? (
            <SystemStatusPanel />
          ) : !q.data ? (
            <Skeleton className="h-96" />
          ) : (
            <form onSubmit={handleSubmit((s) => save.mutate(s), onInvalid)} noValidate>
              {tab === 'brand' && (
                <>
                  <Section title="Brand" description="Shown in the header, emails, receipts and browser tabs.">
                    <Input label="Gym name" required error={e('brand.name')} {...register('brand.name')} />
                    <Input label="Short name" maxLength={20} error={e('brand.shortName')} hint="Used where space is tight." {...register('brand.shortName')} />
                    <Controller control={control} name="brand.logoUrl" render={({ field }) => <ImageUploadField label="Logo" folder="brand" aspect="logo" value={field.value ?? ''} onChange={field.onChange} error={e('brand.logoUrl')} />} />
                    <Controller control={control} name="brand.faviconUrl" render={({ field }) => <ImageUploadField label="Favicon" folder="brand" value={field.value ?? ''} onChange={field.onChange} error={e('brand.faviconUrl')} hint="Square PNG/ICO, at least 64×64." />} />
                    <Input label="Logo alt text" wrapClassName="sm:col-span-2" error={e('brand.logoAlt')} {...register('brand.logoAlt')} />
                  </Section>
                  <Section title="Announcement bar" description="A thin banner at the top of the website.">
                    <div className="sm:col-span-2">
                      <Controller control={control} name="announcement.enabled" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Show announcement" />} />
                    </div>
                    <Input label="Text" maxLength={160} error={e('announcement.text')} {...register('announcement.text')} />
                    <Input label="Link" placeholder="/memberships" error={e('announcement.href')} {...register('announcement.href')} />
                  </Section>
                </>
              )}
              {tab === 'contact' && (
                <>
                  <Section title="Contact">
                    <Input label="Email" type="email" error={e('contact.email')} {...register('contact.email')} />
                    <Input label="Phone" type="tel" error={e('contact.phone')} {...register('contact.phone')} />
                    <Input label="WhatsApp number" type="tel" error={e('contact.whatsapp')} {...register('contact.whatsapp')} />
                    <Input label="Address line" error={e('contact.addressLine')} {...register('contact.addressLine')} />
                    <Input label="City" error={e('contact.city')} {...register('contact.city')} />
                    <Input label="State / region" error={e('contact.region')} {...register('contact.region')} />
                    <Input label="Postal code" error={e('contact.postalCode')} {...register('contact.postalCode')} />
                    <Input label="Country code" maxLength={2} error={e('contact.country')} hint="ISO 3166, e.g. IN" {...register('contact.country')} />
                  </Section>
                  <Section title="Location" description="Used for the map on the contact page and local SEO.">
                    <Input label="Latitude" type="number" step="any" error={e('location.lat')} {...register('location.lat', nullableNumber)} />
                    <Input label="Longitude" type="number" step="any" error={e('location.lng')} {...register('location.lng', nullableNumber)} />
                    <Input label="Google Maps embed URL" wrapClassName="sm:col-span-2" placeholder="https://www.google.com/maps/embed?pb=…" error={e('location.mapEmbedUrl')} hint="Google Maps → Share → Embed a map → copy the src URL." {...register('location.mapEmbedUrl')} />
                    <Input label="Directions link" wrapClassName="sm:col-span-2" placeholder="https://maps.app.goo.gl/…" error={e('location.directionsUrl')} {...register('location.directionsUrl')} />
                  </Section>
                </>
              )}
              {tab === 'hours' && (
                <Card className="mb-4">
                  <CardHeader title="Business hours" description="Shown on the website and used in structured data." />
                  <ul className="divide-y divide-line/70">
                    {DAYS.map((d, i) => (
                      <Controller
                        key={d}
                        control={control}
                        name={`hours.${i}`}
                        render={({ field }) => {
                          const v = field.value ?? { day: d, open: '06:00', close: '22:00', closed: false };
                          return (
                            <li className="flex flex-wrap items-center gap-3 px-5 py-3">
                              <span className="w-28 text-sm font-medium">{DAY_LABEL[d]}</span>
                              <label className="sr-only" htmlFor={`h-open-${d}`}>
                                Opens
                              </label>
                              <input id={`h-open-${d}`} type="time" className="input w-32 py-2" disabled={v.closed} value={v.open} onChange={(ev) => field.onChange({ ...v, open: ev.target.value })} />
                              <span className="text-xs text-muted">to</span>
                              <label className="sr-only" htmlFor={`h-close-${d}`}>
                                Closes
                              </label>
                              <input id={`h-close-${d}`} type="time" className="input w-32 py-2" disabled={v.closed} value={v.close} onChange={(ev) => field.onChange({ ...v, close: ev.target.value })} />
                              <Checkbox label="Closed" checked={Boolean(v.closed)} onChange={(ev) => field.onChange({ ...v, closed: ev.target.checked })} />
                              {get(errors, `hours.${i}.open`) || get(errors, `hours.${i}.close`) ? <span className="text-xs text-danger">Use HH:MM</span> : null}
                            </li>
                          );
                        }}
                      />
                    ))}
                  </ul>
                </Card>
              )}
              {tab === 'social' && (
                <Section title="Social links" description="Full URLs to your profiles. Leave empty to hide.">
                  {(['instagram', 'facebook', 'youtube', 'x', 'linkedin'] as const).map((k) => (
                    <Input key={k} label={k === 'x' ? 'X (Twitter)' : titleCase(k)} placeholder="https://…" error={e(`social.${k}`)} {...register(`social.${k}`)} />
                  ))}
                </Section>
              )}
              {tab === 'business' && (
                <Section title="Business details" description="Printed on receipts and used for tax records.">
                  <Input label="Legal name" error={e('business.legalName')} {...register('business.legalName')} />
                  <Input label="GSTIN" maxLength={20} className="font-mono uppercase" error={e('business.gstin')} {...register('business.gstin')} />
                  <Input label="Currency" value="INR (₹)" disabled readOnly hint="All prices and payments are in Indian rupees." />
                  <Controller control={control} name="business.timezone" render={({ field }) => <TimezoneField value={field.value ?? 'Asia/Kolkata'} onChange={field.onChange} error={e('business.timezone')} />} />
                  <Input label="Founded year" type="number" min={1900} max={2100} error={e('business.foundedYear')} {...register('business.foundedYear', nullableNumber)} />
                </Section>
              )}
              {tab === 'seo' && (
                <Section title="SEO defaults" description="Fallbacks for pages that don’t set their own.">
                  <Input label="Site URL" placeholder="https://apexathletics.in" error={e('seo.siteUrl')} hint="Canonical domain, used in the sitemap." {...register('seo.siteUrl')} />
                  <Input label="Title template" error={e('seo.titleTemplate')} hint="%s is replaced with the page title." {...register('seo.titleTemplate')} />
                  <Input label="Default title" maxLength={70} wrapClassName="sm:col-span-2" error={e('seo.title')} {...register('seo.title')} />
                  <Textarea label="Default description" rows={3} maxLength={170} wrapClassName="sm:col-span-2" error={e('seo.description')} {...register('seo.description')} />
                  <Controller control={control} name="seo.image" render={({ field }) => <ImageUploadField label="Default share image" folder="seo" aspect="wide" value={field.value ?? ''} onChange={field.onChange} error={e('seo.image')} hint="1200×630 recommended." />} />
                  <div className="self-end">
                    <Controller control={control} name="seo.noIndex" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Hide site from search engines" description="Adds noindex. Use only for staging." />} />
                  </div>
                </Section>
              )}
              {tab === 'notifications' && (
                <Section title="Notifications" description="Automatic member reminders and staff alerts.">
                  <Controller control={control} name="notifications.emailEnabled" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Email notifications" description="Receipts, reminders and booking updates by email." />} />
                  <Controller control={control} name="notifications.whatsappEnabled" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="WhatsApp notifications" description="Requires a WhatsApp provider on the server." />} />
                  <Controller control={control} name="notifications.expiryReminderDays" render={({ field }) => <ReminderDaysField value={field.value ?? []} onChange={field.onChange} error={e('notifications.expiryReminderDays')} />} />
                  <Input label="Class reminder (hours before)" type="number" min={1} max={48} error={e('notifications.classReminderHours')} {...register('notifications.classReminderHours', num)} />
                  <Input label="Admin alert email" type="email" wrapClassName="sm:col-span-2" error={e('notifications.adminAlertEmail')} hint="Receives trial requests, cancellation requests and support tickets." {...register('notifications.adminAlertEmail')} />
                </Section>
              )}
              {tab === 'privacy' && (
                <Section title="Privacy & consent">
                  <div className="flex items-start gap-3 rounded-theme-sm border border-line bg-fg/[0.03] p-4 sm:col-span-2">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <p className="text-sm text-muted">
                      <span className="font-medium text-fg">Consent required for transformation photos</span> — always on. Before/after stories can only be published with a recorded member consent.
                    </p>
                  </div>
                  <Controller control={control} name="privacy.cookieBanner" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Cookie banner" description="Asks visitors for consent to non-essential cookies." />} />
                  <div />
                  <Input label="Privacy policy URL" error={e('privacy.privacyPolicyUrl')} {...register('privacy.privacyPolicyUrl')} />
                  <Input label="Terms URL" error={e('privacy.termsUrl')} {...register('privacy.termsUrl')} />
                  <Textarea label="Data retention note" rows={3} maxLength={500} wrapClassName="sm:col-span-2" error={e('privacy.dataRetentionNote')} {...register('privacy.dataRetentionNote')} />
                </Section>
              )}
              {tab === 'bookings' && (
                <Section title="Booking policy" description="Applies to class and personal-training bookings made by members.">
                  <Input label="Cancellation window (hours)" type="number" min={0} max={72} error={e('bookings.cancellationWindowHours')} hint="Members can cancel up to this many hours before the start." {...register('bookings.cancellationWindowHours', num)} />
                  <Input label="Reschedule window (hours)" type="number" min={0} max={72} error={e('bookings.rescheduleWindowHours')} {...register('bookings.rescheduleWindowHours', num)} />
                  <Input label="Max active bookings per member" type="number" min={1} max={50} error={e('bookings.maxActiveBookingsPerMember')} {...register('bookings.maxActiveBookingsPerMember', num)} />
                  <div className="self-end">
                    <Controller control={control} name="bookings.allowWaitlist" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Allow waitlist" description="Full classes accept a waitlist; spots are offered automatically." />} />
                  </div>
                </Section>
              )}
              {tab === 'loyalty' && (
                <Section title="Loyalty & referrals">
                  <div className="sm:col-span-2">
                    <Controller control={control} name="loyalty.enabled" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Loyalty programme" description="Members earn points for visits and referrals." />} />
                  </div>
                  <Input label="Points per check-in" type="number" min={0} max={100} error={e('loyalty.pointsPerCheckIn')} {...register('loyalty.pointsPerCheckIn', num)} />
                  <Input label="Referral reward (points)" type="number" min={0} max={10000} error={e('loyalty.referralRewardPoints')} {...register('loyalty.referralRewardPoints', num)} />
                </Section>
              )}

              <div className={cn('sticky bottom-3 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-theme border border-line bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur transition', formState.isDirty ? 'opacity-100' : 'opacity-90')}>
                <p className="text-sm text-muted">{formState.isDirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} disabled={!formState.isDirty || save.isPending} onClick={() => q.data && reset(normalize(q.data))}>
                    Discard
                  </Button>
                  <Button type="submit" icon={<Save className="h-4 w-4" />} loading={save.isPending} disabled={!formState.isDirty}>
                    Save settings
                  </Button>
                </div>
              </div>
              {Object.keys(errors).length > 0 && (
                <Alert tone="danger" className="mt-3">
                  Some fields are invalid: {TABS.filter(tabHasError).map((t) => t.label).join(', ')}.
                </Alert>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
