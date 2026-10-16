import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, HeartPulse, Info, Star, UserRound } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Alert, Avatar, Button, Card, CardBody, CardHeader, ErrorState, Input, PageHeader, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { MeResponse } from '../components/types';
import { applyFieldErrors, optNum, toDateInput, zr } from '../components/utils';

const phoneRe = /^[+\d\s()-]*$/;
const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().max(30).regex(phoneRe, 'Use digits, spaces, + ( ) -'),
  dateOfBirth: z
    .string()
    .optional()
    .refine((v) => !v || v < toDateInput(new Date()), 'Date of birth must be in the past'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not']),
  heightCm: z.preprocess(optNum, z.number({ invalid_type_error: 'Enter a number' }).min(50, 'Height must be 50–260 cm').max(260, 'Height must be 50–260 cm').optional()),
  address: z.string().trim().max(300),
  ecName: z.string().trim().max(100),
  ecPhone: z.string().trim().max(30).regex(phoneRe, 'Use digits, spaces, + ( ) -'),
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  healthNotes: z.string().trim().max(2000),
});
type Form = z.output<typeof schema>;

export default function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const me = useQuery({ queryKey: ['member', 'me'], queryFn: () => api.get<MeResponse>('/members/me') });
  const form = useForm<Form>({ resolver: zr<Form>(schema) });
  const { register, handleSubmit, reset, setError, formState, watch } = form;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!me.data) return;
    const { user, profile } = me.data;
    reset({
      name: user.name,
      phone: user.phone ?? '',
      dateOfBirth: toDateInput(profile.dateOfBirth),
      gender: profile.gender ?? 'prefer_not',
      heightCm: profile.heightCm ?? undefined,
      address: profile.address ?? '',
      ecName: profile.emergencyContact?.name ?? '',
      ecPhone: profile.emergencyContact?.phone ?? '',
      fitnessLevel: profile.fitnessLevel ?? 'beginner',
      healthNotes: profile.healthNotes ?? '',
    });
  }, [me.data, reset]);

  const save = useMutation({
    mutationFn: (v: Form) =>
      api.patch<MeResponse>('/members/me', {
        name: v.name,
        phone: v.phone,
        profile: {
          dateOfBirth: v.dateOfBirth ? new Date(`${v.dateOfBirth}T00:00:00Z`).toISOString() : null,
          gender: v.gender,
          heightCm: v.heightCm ?? null,
          address: v.address,
          emergencyContact: { name: v.ecName, phone: v.ecPhone },
          fitnessLevel: v.fitnessLevel,
          healthNotes: v.healthNotes,
        },
      }),
    onSuccess: (d) => {
      qc.setQueryData(['member', 'me'], d);
      void qc.invalidateQueries({ queryKey: ['member', 'dashboard'] });
      void refresh();
      toast.success('Profile saved');
    },
    onError: (err) =>
      !applyFieldErrors(err, setError, {
        'profile.dateOfBirth': 'dateOfBirth',
        'profile.heightCm': 'heightCm',
        'profile.address': 'address',
        'profile.emergencyContact.name': 'ecName',
        'profile.emergencyContact.phone': 'ecPhone',
        'profile.healthNotes': 'healthNotes',
      }) && toast.error(err),
  });

  const avatar = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload<{ avatarUrl: string }>('/members/me/avatar', fd);
    },
    onSuccess: () => {
      toast.success('Photo updated');
      void qc.invalidateQueries({ queryKey: ['member', 'me'] });
      void refresh();
    },
    onError: (err) => toast.error(err),
  });

  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  const e = formState.errors;
  const trainer = me.data?.profile.assignedTrainer;
  const notesLen = watch('healthNotes')?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow="Account" title="Profile" description="Keep your details current so coaches can tailor your training and we can reach you in an emergency." />

      <Card>
        <CardBody className="flex flex-col items-center gap-4 sm:flex-row">
          {me.data ? <Avatar name={me.data.user.name} src={me.data.user.avatarUrl || undefined} size={88} /> : <Skeleton className="h-[88px] w-[88px] rounded-full" />}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-display text-xl font-semibold">{me.data?.user.name}</p>
            <p className="text-sm text-muted">{me.data?.user.email}</p>
            {me.data?.user.createdAt && <p className="text-xs text-muted">Member since {fmtDate(me.data.user.createdAt, { month: 'long', year: 'numeric' })}</p>}
            {trainer && <p className="mt-1 text-xs text-primary">Coach: {trainer.name}</p>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload profile photo"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = '';
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) return toast.error('Image must be under 10 MB');
              avatar.mutate(f);
            }}
          />
          <Button variant="secondary" icon={<Camera className="h-4 w-4" />} loading={avatar.isPending} onClick={() => fileRef.current?.click()}>
            Change photo
          </Button>
        </CardBody>
      </Card>

      {!me.data ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-5">
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Personal details</span>} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" required autoComplete="name" {...register('name')} error={e.name?.message} />
              <Input label="Phone" type="tel" autoComplete="tel" {...register('phone')} error={e.phone?.message} />
              <Input label="Date of birth" type="date" max={toDateInput(new Date())} {...register('dateOfBirth')} error={e.dateOfBirth?.message} />
              <Select
                label="Gender"
                {...register('gender')}
                options={[
                  { value: 'prefer_not', label: 'Prefer not to say' },
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Input label="Height (cm)" type="number" inputMode="decimal" step="0.5" {...register('heightCm')} error={e.heightCm?.message} hint="Used to calculate BMI on your progress page." />
              <Select
                label="Fitness level"
                {...register('fitnessLevel')}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
              <Textarea label="Address" rows={2} wrapClassName="sm:col-span-2" maxLength={300} autoComplete="street-address" {...register('address')} error={e.address?.message} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Emergency contact" description="Only used by staff if something happens while you’re training." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" {...register('ecName')} error={e.ecName?.message} />
              <Input label="Phone" type="tel" {...register('ecPhone')} error={e.ecPhone?.message} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> Health notes</span>} />
            <CardBody className="space-y-3">
              <Alert tone="info">
                <span className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Visible only to you, {trainer ? `your assigned coach (${trainer.name})` : 'your assigned coach (once you have one)'} and gym managers — never to other members. Share injuries, conditions or medications that affect training. This isn’t a medical record; for anything serious, consult a doctor.
                  </span>
                </span>
              </Alert>
              <Textarea aria-label="Health notes" rows={4} maxLength={2000} {...register('healthNotes')} error={e.healthNotes?.message} placeholder="e.g. Old left-knee ACL repair (2021) — avoid deep loaded flexion." hint={`${notesLen}/2000`} />
            </CardBody>
          </Card>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button type="submit" size="lg" loading={save.isPending} disabled={!formState.isDirty} className="shadow-2xl">
              Save changes
            </Button>
          </div>
        </form>
      )}

      <ReviewCard />
    </div>
  );
}

function ReviewCard() {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: () => api.post('/members/me/reviews', { rating, title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setDone(true);
      toast.success('Thanks for your review!', 'It will appear on the website once approved.');
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast.error(err);
    },
  });
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Write a review</span>} description="Tell others about your experience. Reviews are moderated before they’re published, showing your first name only." />
      <CardBody>
        {done ? (
          <p className="text-sm text-success">Review received — thank you for helping others find us.</p>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              const errs: Record<string, string> = {};
              if (!rating) errs.rating = 'Choose a star rating';
              if (body.trim().length < 10) errs.body = 'Write at least 10 characters';
              setErrors(errs);
              if (!Object.keys(errs).length) submit.mutate();
            }}
          >
            <div>
              <p className="label" id="rating-label">
                Rating
              </p>
              <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="rounded p-0.5">
                    <Star className={cn('h-7 w-7 transition', (hover || rating) >= n ? 'fill-primary text-primary' : 'text-muted/50')} />
                  </button>
                ))}
              </div>
              {errors.rating && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {errors.rating}
                </p>
              )}
            </div>
            <Input label="Headline (optional)" maxLength={120} value={title} onChange={(ev) => setTitle(ev.target.value)} error={errors.title} />
            <Textarea label="Your review" rows={4} maxLength={2000} value={body} onChange={(ev) => setBody(ev.target.value)} error={errors.body} />
            <Button type="submit" loading={submit.isPending}>
              Submit review
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
