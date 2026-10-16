import { useId, useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path, type UseFormRegisterReturn, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui';
import { usePrograms } from './queries';

/* ----------------------------------------------------------------- helpers */

/** Maps server field errors onto the form; returns a general message when none matched. */
function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: string[]): string | null {
  if (err instanceof ApiError) {
    const fe = err.fieldErrors;
    let matched = false;
    for (const [k, msg] of Object.entries(fe)) {
      if (fields.includes(k)) {
        setError(k as Path<T>, { type: 'server', message: msg });
        matched = true;
      }
    }
    if (err.status === 429) return 'Too many requests — please wait a minute and try again.';
    if (matched) return null;
  }
  return errorMessage(err);
}

/** Visually hidden honeypot field: humans never see or fill it. */
function Honeypot({ field }: { field: UseFormRegisterReturn }) {
  const id = useId();
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={id}>Leave this field empty</label>
      <input id={id} type="text" tabIndex={-1} autoComplete="off" {...field} />
    </div>
  );
}

export function FormSuccess({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start gap-4 py-6">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
      {children && <div className="max-w-md text-muted">{children}</div>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive" className="min-h-0">
      {message && (
        <p role="alert" className="rounded-theme-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-fg/90">
          {message}
        </p>
      )}
    </div>
  );
}

const phoneRe = /^[+\d\s()-]+$/;
const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const plusDaysIso = (n: number) => {
  const d = new Date(Date.now() + n * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/* --------------------------------------------------------------- trial form */

const trialSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(30).regex(phoneRe, 'Enter a valid phone number'),
  preferredDate: z
    .string()
    .min(1, 'Choose a date')
    .refine((v) => v >= todayIso() && v <= plusDaysIso(60), 'Choose a date within the next 60 days'),
  goal: z.string().trim().max(200).default(''),
  programInterest: z.string().trim().max(100).default(''),
  consent: z.boolean().refine((v) => v, 'Please agree to be contacted about your trial'),
  website: z.string().max(0).default(''),
});
type TrialValues = z.input<typeof trialSchema>;

const GOALS = ['Build strength', 'Lose body fat', 'Build muscle', 'Improve conditioning', 'Sport performance', 'Move better / rehab', 'Just exploring'];

export function TrialForm({ successMessage }: { successMessage?: string }) {
  const programs = usePrograms(24);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, reset } = useForm<TrialValues>({
    resolver: zodResolver(trialSchema),
    defaultValues: { name: '', email: '', phone: '', preferredDate: '', goal: '', programInterest: '', consent: false, website: '' },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/bookings/trial', { ...values, consent: true });
      setDone(true);
      reset();
    } catch (err) {
      setFormError(applyServerErrors(err, setError, Object.keys(trialSchema.shape)));
    }
  });

  if (done)
    return (
      <FormSuccess title="You're booked in (almost)">
        <p>{successMessage || 'Request received — our team will contact you shortly to confirm a time.'}</p>
        <button type="button" onClick={() => setDone(false)} className="mt-4 text-sm text-fg underline underline-offset-4 hover:text-primary">
          Book for someone else
        </button>
      </FormSuccess>
    );

  const programOptions = (programs.data ?? []).map((p) => ({ value: p.title, label: p.title }));
  return (
    <form onSubmit={onSubmit} noValidate className="relative grid gap-5 sm:grid-cols-2" aria-describedby="trial-privacy">
      <Honeypot field={register('website')} />
      <Input label="Full name" autoComplete="name" required error={e.name?.message} {...register('name')} />
      <Input label="Email" type="email" autoComplete="email" required error={e.email?.message} {...register('email')} />
      <Input label="Phone" type="tel" autoComplete="tel" inputMode="tel" required error={e.phone?.message} {...register('phone')} />
      <Input label="Preferred date" type="date" min={todayIso()} max={plusDaysIso(60)} required error={e.preferredDate?.message} {...register('preferredDate')} />
      <Select label="Main goal" placeholder="Select a goal (optional)" options={GOALS.map((g) => ({ value: g, label: g }))} error={e.goal?.message} {...register('goal')} />
      {programOptions.length > 0 ? (
        <Select label="Program of interest" placeholder="Not sure yet" options={programOptions} error={e.programInterest?.message} {...register('programInterest')} />
      ) : (
        <Input label="Program of interest" placeholder="Optional" error={e.programInterest?.message} {...register('programInterest')} />
      )}
      <Checkbox
        className="sm:col-span-2"
        label="I agree to be contacted by phone or email to arrange my trial session."
        error={e.consent?.message}
        {...register('consent')}
      />
      <div className="sm:col-span-2">
        <FormError message={formError} />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p id="trial-privacy" className="text-xs text-muted">
          We only use your details to arrange your trial. No spam.
        </p>
        <Button type="submit" size="lg" loading={formState.isSubmitting} className="group">
          Request my session <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- contact form */

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, 'Enter a valid phone number').default(''),
  subject: z.string().trim().max(140).default(''),
  message: z.string().trim().min(5, 'Please write a little more (at least 5 characters)').max(3000),
  website: z.string().max(0).default(''),
});
type ContactValues = z.input<typeof contactSchema>;

export function ContactForm() {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, reset } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', subject: '', message: '', website: '' },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/cms/contact', values);
      setDone(true);
      reset();
    } catch (err) {
      setFormError(applyServerErrors(err, setError, Object.keys(contactSchema.shape)));
    }
  });

  if (done)
    return (
      <FormSuccess title="Message received">
        <p>Thanks for reaching out — we reply within one business day.</p>
        <button type="button" onClick={() => setDone(false)} className="mt-4 text-sm text-fg underline underline-offset-4 hover:text-primary">
          Send another message
        </button>
      </FormSuccess>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="relative grid gap-5 sm:grid-cols-2">
      <Honeypot field={register('website')} />
      <Input label="Name" autoComplete="name" required error={e.name?.message} {...register('name')} />
      <Input label="Email" type="email" autoComplete="email" required error={e.email?.message} {...register('email')} />
      <Input label="Phone" type="tel" autoComplete="tel" hint="Optional" error={e.phone?.message} {...register('phone')} />
      <Input label="Subject" hint="Optional" error={e.subject?.message} {...register('subject')} />
      <Textarea wrapClassName="sm:col-span-2" label="Message" rows={5} required error={e.message?.message} {...register('message')} />
      <div className="sm:col-span-2">
        <FormError message={formError} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={formState.isSubmitting} className="group">
          Send message <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------- newsletter form */

const newsletterSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(254),
  consent: z.boolean().refine((v) => v, 'Please confirm you want to receive emails'),
  website: z.string().max(0).default(''),
});
type NewsletterValues = z.input<typeof newsletterSchema>;

export function NewsletterForm({ source = 'website', compact = false, className }: { source?: string; compact?: boolean; className?: string }) {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emailId = useId();
  const { register, handleSubmit, setError, formState, reset } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '', consent: false, website: '' },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/cms/newsletter', { ...values, consent: true, source });
      setDone(true);
      reset();
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['email', 'consent']));
    }
  });

  if (done)
    return (
      <p role="status" aria-live="polite" className={cn('flex items-center gap-2 text-sm text-fg', className)}>
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> You're on the list. Check your inbox for a confirmation.
      </p>
    );

  return (
    <form onSubmit={onSubmit} noValidate className={cn('relative', className)}>
      <Honeypot field={register('website')} />
      <label htmlFor={emailId} className={cn('label', compact && 'sr-only')}>
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={e.email ? true : undefined}
          aria-describedby={e.email ? `${emailId}-err` : undefined}
          className="input h-12 flex-1 rounded-btn px-5"
          {...register('email')}
        />
        <Button type="submit" loading={formState.isSubmitting} className="h-12 shrink-0" aria-label="Subscribe">
          {compact ? <ArrowRight className="h-4 w-4" aria-hidden /> : 'Subscribe'}
        </Button>
      </div>
      {e.email && (
        <p id={`${emailId}-err`} role="alert" className="mt-1.5 text-xs text-danger">
          {e.email.message}
        </p>
      )}
      <Checkbox className="mt-3 [&_label]:text-xs [&_label]:text-muted" label="Yes, send me training notes and club news. Unsubscribe any time." error={e.consent?.message} {...register('consent')} />
      <FormError message={formError} />
    </form>
  );
}
