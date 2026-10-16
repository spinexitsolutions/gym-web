import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Clock, Eye, Instagram } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, PageHeader, Skeleton, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { Availability, TrainerProfileFull } from '@/member/components/types';
import { WEEKDAYS } from '@/member/components/utils';
import { AvailabilityEditor, availabilityErrors } from '../components/AvailabilityEditor';

interface Form {
  displayName: string;
  title: string;
  bio: string;
  specializations: string;
  certifications: string;
  instagram: string;
  ptSessionMinutes: string;
  photoUrl: string;
  availability: Availability[];
}
const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function TrainerProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const q = useQuery({ queryKey: ['trainer', 'profile'], queryFn: () => api.get<TrainerProfileFull>('/trainers/me') });
  const [f, setF] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availErr, setAvailErr] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.data && !f)
      setF({
        displayName: q.data.displayName,
        title: q.data.title ?? '',
        bio: q.data.bio ?? '',
        specializations: q.data.specializations.join(', '),
        certifications: q.data.certifications.join(', '),
        instagram: q.data.instagram ?? '',
        ptSessionMinutes: String(q.data.ptSessionMinutes ?? 60),
        photoUrl: q.data.photoUrl ?? '',
        availability: [...q.data.availability].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
      });
  }, [q.data, f]);

  const save = useMutation({
    mutationFn: (v: Form) =>
      api.patch<TrainerProfileFull>('/trainers/me', {
        displayName: v.displayName.trim(),
        title: v.title.trim(),
        bio: v.bio.trim(),
        specializations: splitList(v.specializations),
        certifications: splitList(v.certifications),
        instagram: v.instagram.trim(),
        ptSessionMinutes: Number(v.ptSessionMinutes),
        photoUrl: v.photoUrl,
        availability: v.availability,
      }),
    onSuccess: (p) => {
      qc.setQueryData(['trainer', 'profile'], p);
      toast.success('Profile saved', 'Your public profile is updated.');
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      toast.error(e);
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload<{ avatarUrl: string }>('/members/me/avatar', fd);
    },
    onSuccess: (r) => {
      setF((x) => (x ? { ...x, photoUrl: r.avatarUrl } : x));
      void refresh();
      toast.success('Photo uploaded', 'Save to use it on your public profile.');
    },
    onError: (e) => toast.error(e),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!f)
    return (
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-[600px]" />
      </div>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.displayName.trim().length < 2) errs.displayName = 'At least 2 characters';
    const m = Number(f.ptSessionMinutes);
    if (!Number.isInteger(m) || m < 15 || m > 240) errs.ptSessionMinutes = '15–240 minutes';
    if (splitList(f.specializations).length > 12) errs.specializations = 'Up to 12';
    if (splitList(f.certifications).length > 12) errs.certifications = 'Up to 12';
    if (splitList(f.specializations).some((s) => s.length > 40)) errs.specializations = 'Each up to 40 characters';
    const ae = availabilityErrors(f.availability);
    setErrors(errs);
    setAvailErr(ae);
    if (Object.keys(errs).length || Object.keys(ae).length) return toast.error('Please fix the highlighted fields');
    save.mutate(f);
  };

  const set = (patch: Partial<Form>) => setF({ ...f, ...patch });
  const byDay = WEEKDAYS.map((d, i) => ({ d, rows: f.availability.filter((a) => a.day === i) })).filter((x) => x.rows.length);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Account" title="Profile & availability" description="This is how members see you on the website and when booking personal training." />
      <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Public profile" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar name={f.displayName} src={f.photoUrl || undefined} size={72} />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Upload profile photo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) upload.mutate(file);
                  }}
                />
                <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                  Upload photo
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Display name" required maxLength={100} value={f.displayName} onChange={(e) => set({ displayName: e.target.value })} error={errors.displayName} />
                <Input label="Title" maxLength={100} value={f.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} placeholder="e.g. Head of Strength" />
              </div>
              <Textarea label="Bio" rows={5} maxLength={3000} value={f.bio} onChange={(e) => set({ bio: e.target.value })} error={errors.bio} hint={`${f.bio.length}/3000`} />
              <Input label="Specialisations" value={f.specializations} onChange={(e) => set({ specializations: e.target.value })} error={errors.specializations} hint="Comma-separated, e.g. Powerlifting, Mobility" />
              <Input label="Certifications" value={f.certifications} onChange={(e) => set({ certifications: e.target.value })} error={errors.certifications} hint="Comma-separated, e.g. NSCA-CSCS, ACE" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Instagram" maxLength={300} value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} error={errors.instagram} placeholder="https://instagram.com/…" />
                <Input label="PT session length (min)" type="number" min={15} max={240} step={15} value={f.ptSessionMinutes} onChange={(e) => set({ ptSessionMinutes: e.target.value })} error={errors.ptSessionMinutes} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Weekly availability</span>} description="Members can book 1:1 sessions inside these windows (gym local time). Classes you teach are blocked automatically." />
            <CardBody>
              <AvailabilityEditor rows={f.availability} onChange={(availability) => (set({ availability }), setAvailErr({}))} errors={availErr} />
            </CardBody>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={save.isPending}>
              Save profile
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Eye className="h-3.5 w-3.5" /> Preview
          </p>
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-fg/[0.04]">
              {f.photoUrl ? <img src={f.photoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Avatar name={f.displayName} size={96} /></div>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12 text-white">
                <p className="font-display text-xl font-semibold">{f.displayName || 'Your name'}</p>
                {f.title && <p className="text-sm opacity-80">{f.title}</p>}
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {splitList(f.specializations).map((s) => (
                  <Badge key={s} tone="primary">
                    {s}
                  </Badge>
                ))}
              </div>
              {f.bio && <p className="line-clamp-5 text-sm text-muted">{f.bio}</p>}
              {splitList(f.certifications).length > 0 && <p className="text-xs text-muted">Certified: {splitList(f.certifications).join(' · ')}</p>}
              {f.instagram && (
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Instagram className="h-3.5 w-3.5" /> {f.instagram.replace(/^https?:\/\/(www\.)?/, '')}
                </p>
              )}
              <div className="border-t border-line/60 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{f.ptSessionMinutes}-min 1:1 sessions</p>
                {byDay.length ? (
                  <ul className="space-y-1 text-xs">
                    {byDay.map((x) => (
                      <li key={x.d} className="flex justify-between gap-2">
                        <span className="text-muted">{x.d}</span>
                        <span className="tabular-nums">{x.rows.map((r) => `${r.start}–${r.end}`).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">Not currently taking 1:1 bookings.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
