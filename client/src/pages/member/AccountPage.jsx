import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, MailWarning, ShieldCheck, LogOut, Trash2, BadgeCheck } from 'lucide-react';
import { PushToggle } from '../../components/dashboard/PushToggle.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Field, TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { PasswordField } from '../../forms/PasswordField.jsx';
import { TagInput } from '../../forms/TagInput.jsx';
import { passwordRule, phoneRule } from '../../forms/schemas.js';
import { formatDate } from '../../utils/format.js';

function Card({ title, description, children, id }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="rounded-brand border border-line/10 bg-surface p-6 md:p-8">
      <h2 id={`${id}-title`} className="font-sans text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const useStatus = () => {
  const [s, set] = useState({ tone: 'success', text: '' });
  return [s, (tone, text) => set({ tone, text })];
};

function AvatarUploader({ user, onUser }) {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const upload = async (file) => {
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Use a JPG, PNG or WebP image.');
    if (file.size > 8 * 1024 * 1024) return setError('Image must be 8 MB or smaller.');
    const form = new FormData();
    form.append('file', file);
    try {
      setProgress(0);
      const res = await api.post('/users/me/avatar', form, { onUploadProgress: setProgress });
      onUser(res.data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-gold/40 bg-elevated">
        {user.avatar?.url ? <Img image={user.avatar} alt={user.name} sizes="96px" className="h-full w-full" />
          : <span className="grid h-full w-full place-items-center font-display text-3xl text-gold">{user.name[0]}</span>}
        {progress !== null && (
          <div className="absolute inset-0 grid place-items-center bg-[#0B0B0C]/70 text-sm font-semibold text-[#F4F1EA]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>{progress}%</div>
        )}
      </div>
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={progress !== null}><Camera className="h-4 w-4" aria-hidden />{user.avatar?.url ? 'Change photo' : 'Upload photo'}</Button>
          {user.avatar?.url && <Button size="sm" variant="ghost" onClick={async () => onUser((await api.delete('/users/me/avatar')).data.user)}>Remove</Button>}
        </div>
        <p className="mt-2 text-xs text-muted">JPG, PNG or WebP, up to 8 MB.</p>
        {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}

const accountSchema = z.object({ name: z.string().trim().min(2, 'Enter your name').max(80), phone: phoneRule.optional() });

function AccountForm({ user, onUser }) {
  const [status, setStatus] = useStatus();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
    resolver: zodResolver(accountSchema), defaultValues: { name: user.name, phone: user.phone || '' },
  });
  const onSubmit = async (v) => {
    try {
      const res = await api.patch('/users/me', v);
      onUser(res.data.user);
      reset(v);
      setStatus('success', res.message);
    } catch (err) { setStatus('danger', applyServerErrors(err, setError)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert tone={status.tone}>{status.text}</FormAlert>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Full name" name="name" register={register} errors={errors} required autoComplete="name" />
        <TextField label="Phone" name="phone" type="tel" register={register} errors={errors} autoComplete="tel" />
      </div>
      <Field label="Email" hint="Contact the front desk to change your login email.">{(a) => <input {...a} className="input opacity-70" value={user.email} readOnly />}</Field>
      <Button type="submit" size="sm" loading={isSubmitting} disabled={!isDirty}>Save</Button>
    </form>
  );
}

const num = z.union([z.coerce.number(), z.literal('')]).optional();
const profileSchema = z.object({
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  heightCm: num.refine((v) => v === '' || v === undefined || (v >= 50 && v <= 260), 'Height must be 50–260 cm'),
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  fitnessGoals: z.array(z.string()).max(10),
  address: z.object({ line1: z.string().max(200), city: z.string().max(80), state: z.string().max(80), pincode: z.string().max(12) }),
  emergencyContact: z.object({ name: z.string().max(80), phone: phoneRule, relation: z.string().max(40) }),
  medicalNotes: z.string().max(1000),
  notificationPrefs: z.object({ email: z.boolean() }),
});

const toForm = (p = {}) => ({
  dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
  gender: p.gender || '',
  heightCm: p.heightCm ?? '',
  fitnessLevel: p.fitnessLevel || 'beginner',
  fitnessGoals: p.fitnessGoals || [],
  address: { line1: '', city: '', state: '', pincode: '', ...p.address },
  emergencyContact: { name: '', phone: '', relation: '', ...p.emergencyContact },
  medicalNotes: p.medicalNotes || '',
  notificationPrefs: { email: p.notificationPrefs?.email ?? true },
});

function ProfileForm({ profile, onProfile }) {
  const [status, setStatus] = useStatus();
  const { register, control, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm({ resolver: zodResolver(profileSchema), defaultValues: toForm(profile) });
  useEffect(() => { reset(toForm(profile)); }, [profile, reset]);
  const onSubmit = async (v) => {
    const body = { ...v, heightCm: v.heightCm === '' ? null : v.heightCm, dateOfBirth: v.dateOfBirth || null, gender: v.gender || undefined };
    try {
      const res = await api.patch('/users/me/profile', body);
      onProfile(res.data.profile);
      setStatus('success', res.message);
    } catch (err) { setStatus('danger', applyServerErrors(err, setError)); }
  };
  const e = (path) => path.split('.').reduce((o, k) => o?.[k], errors)?.message;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FormAlert tone={status.tone}>{status.text}</FormAlert>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="eyebrow mb-4">Personal details</legend>
        <TextField label="Date of birth" name="dateOfBirth" type="date" register={register} errors={errors} max={new Date().toISOString().slice(0, 10)} />
        <TextField label="Gender" name="gender" as="select" register={register} errors={errors}
          options={[{ value: '', label: 'Prefer not to say' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }]} />
        <TextField label="Height (cm)" name="heightCm" type="number" inputMode="numeric" register={register} errors={errors} />
        <TextField label="Fitness level" name="fitnessLevel" as="select" register={register} errors={errors}
          options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} />
        <Field label="Address" error={e('address.line1')} className="sm:col-span-2">{(a) => <input {...a} className="input" autoComplete="street-address" {...register('address.line1')} />}</Field>
        <Field label="City">{(a) => <input {...a} className="input" autoComplete="address-level2" {...register('address.city')} />}</Field>
        <div className="grid grid-cols-2 gap-5">
          <Field label="State">{(a) => <input {...a} className="input" autoComplete="address-level1" {...register('address.state')} />}</Field>
          <Field label="PIN code">{(a) => <input {...a} className="input" autoComplete="postal-code" inputMode="numeric" {...register('address.pincode')} />}</Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-4">Fitness goals</legend>
        <Field label="Your goals" hint="Press Enter to add. Up to 10." error={e('fitnessGoals')}>
          {(a) => (
            <Controller control={control} name="fitnessGoals" render={({ field }) => (
              <TagInput {...a} value={field.value} onChange={field.onChange} placeholder="e.g. Lose 5 kg"
                suggestions={['Lose weight', 'Build muscle', 'Get stronger', 'Improve flexibility', 'Run 10K', 'Better posture']} />
            )} />
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-3">
        <legend className="eyebrow mb-4">Emergency contact</legend>
        <Field label="Name" error={e('emergencyContact.name')}>{(a) => <input {...a} className="input" {...register('emergencyContact.name')} />}</Field>
        <Field label="Phone" error={e('emergencyContact.phone')}>{(a) => <input {...a} type="tel" className="input" {...register('emergencyContact.phone')} />}</Field>
        <Field label="Relationship" error={e('emergencyContact.relation')}>{(a) => <input {...a} className="input" {...register('emergencyContact.relation')} />}</Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">Health & preferences</legend>
        <TextField label="Medical notes for your coach" name="medicalNotes" as="textarea" register={register} errors={errors}
          hint="Injuries, conditions or medication your trainer should know about. Visible only to you and authorised staff." />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" {...register('notificationPrefs.email')} />Email me reminders and club updates</label>
      </fieldset>
      <Button type="submit" size="sm" loading={isSubmitting} disabled={!isDirty}>Save profile</Button>
    </form>
  );
}

const pwSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordRule, confirm: z.string() })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function PasswordForm() {
  const [status, setStatus] = useStatus();
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(pwSchema) });
  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      const res = await api.post('/users/me/password', { currentPassword, newPassword });
      reset();
      setStatus('success', res.message);
    } catch (err) { setStatus('danger', applyServerErrors(err, setError)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert tone={status.tone}>{status.text}</FormAlert>
      <PasswordField label="Current password" name="currentPassword" register={register} errors={errors} />
      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField label="New password" name="newPassword" register={register} errors={errors} autoComplete="new-password" />
        <PasswordField label="Confirm new password" name="confirm" register={register} errors={errors} autoComplete="new-password" />
      </div>
      <Button type="submit" size="sm" loading={isSubmitting}>Change password</Button>
    </form>
  );
}

function DeletionCard({ user, onUser }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useStatus();
  const pending = Boolean(user.deletionRequestedAt);
  const act = async () => {
    if (!pending && !window.confirm('Request permanent deletion of your account and personal data?')) return;
    setBusy(true);
    try {
      const res = pending ? await api.delete('/users/me/deletion-request') : await api.post('/users/me/deletion-request', { reason });
      onUser(res.data.user);
      setStatus('success', res.message);
    } catch (err) { setStatus('danger', err.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <FormAlert tone={status.tone}>{status.text}</FormAlert>
      {pending ? (
        <p className="text-sm text-muted">Deletion requested on {formatDate(user.deletionRequestedAt)}. Our team will process it within 7 days.</p>
      ) : (
        <Field label="Reason (optional)">{(a) => <textarea {...a} className="input min-h-[80px]" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      )}
      <Button size="sm" variant={pending ? 'outline' : 'danger'} loading={busy} onClick={act}>
        <Trash2 className="h-4 w-4" aria-hidden />{pending ? 'Cancel deletion request' : 'Request account deletion'}
      </Button>
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, setSession, logout } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [verifyMsg, setVerifyMsg] = useState('');
  const onUser = (u) => setSession({ user: u, profile });
  const onProfile = (p) => setSession({ user, profile: p });

  const resend = async () => {
    try { setVerifyMsg((await api.post('/auth/resend-verification')).message); } catch (err) { setVerifyMsg(err.message); }
  };

  return (
    <div className="max-w-5xl">
      <Seo title="My account" noindex />
      {params.get('welcome') && (
        <div className="mb-8 rounded-brand border border-gold/40 bg-gold/5 p-5">
          <p className="font-semibold">Welcome to the club, {user.name.split(' ')[0]}!</p>
          <p className="mt-1 text-sm text-muted">
            Complete your profile below so your coach can tailor your first session.
          </p>
        </div>
      )}

      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Profile & settings</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{user.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {user.email}
            {user.emailVerified ? <Badge tone="success"><BadgeCheck className="h-3 w-3" aria-hidden />Verified</Badge> : <Badge tone="danger">Not verified</Badge>}
            <Badge tone="gold" className="capitalize">{user.role}</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => logout()}><LogOut className="h-4 w-4" aria-hidden />Log out</Button>
      </div>

      {!user.emailVerified && (
        <div className="mb-8 flex flex-col gap-4 rounded-brand border border-danger/30 bg-danger/5 p-5 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="flex items-start gap-3 text-sm"><MailWarning className="h-5 w-5 shrink-0 text-danger" aria-hidden />Please verify your email to purchase memberships and receive receipts. {verifyMsg && <span className="text-muted">{verifyMsg}</span>}</p>
          <Button size="sm" variant="outline" onClick={resend}>Resend link</Button>
        </div>
      )}

      <div className="grid gap-6">
        <Card id="photo" title="Profile photo"><AvatarUploader user={user} onUser={onUser} /></Card>
        <Card id="account" title="Account details"><AccountForm user={user} onUser={onUser} /></Card>
        {user.role === 'member' && (
          <Card id="profile" title="Fitness profile" description="Helps your coaches plan safe, effective training.">
            <ProfileForm profile={profile} onProfile={onProfile} />
          </Card>
        )}
        {profile?.referralCode && (
          <Card id="referral" title="Refer a friend" description="Share your code — friends enter it when they sign up.">
            <p className="font-mono text-2xl tracking-widest text-gold">{profile.referralCode}</p>
          </Card>
        )}
        <Card id="push" title="Push notifications"><PushToggle /></Card>
        <Card id="security" title="Security" description="Changing your password signs you out of every other device.">
          <PasswordForm />
          <div className="mt-8 flex flex-col gap-3 border-t border-line/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted"><ShieldCheck className="h-4 w-4 text-gold" aria-hidden />Signed in on a device you don't recognise?</p>
            <Button size="sm" variant="outline" onClick={async () => { await logout({ everywhere: true }); qc.clear(); }}>Log out of all devices</Button>
          </div>
        </Card>
        <Card id="delete" title="Delete account" description="We'll remove your personal data, except records we must keep for tax and legal reasons.">
          <DeletionCard user={user} onUser={onUser} />
        </Card>
      </div>
    </div>
  );
}
