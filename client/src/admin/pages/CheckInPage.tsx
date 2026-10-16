import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Clock, LogOut, QrCode, ScanLine, Search, UserX, XCircle } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, Skeleton, Spinner, StatusBadge, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/format';
import type { AttendanceRecord, MemberRow } from '../components/types';
import { useDebounced } from '../components/utils';

interface CheckInResult {
  record: { _id: string; checkInAt: string; method: string };
  member: { id: string; name: string; avatarUrl: string };
  membership: { planName: string; endDate: string };
}
type Outcome = { kind: 'success'; data: CheckInResult } | { kind: 'error'; title: string; message: string; tone: 'warning' | 'danger'; memberId?: string };

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
const getDetector = (): BarcodeDetectorCtor | null => (typeof window !== 'undefined' && 'BarcodeDetector' in window ? (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector : null);
const hasCamera = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

function describeError(err: unknown): Omit<Extract<Outcome, { kind: 'error' }>, 'kind'> {
  if (err instanceof ApiError) {
    if (err.code === 'MEMBERSHIP_REQUIRED') return { title: 'No active membership', message: err.message, tone: 'warning' };
    if (err.status === 409 && /already checked in/i.test(err.message)) return { title: 'Already checked in today', message: err.message, tone: 'warning' };
    if (err.status === 409) return { title: 'Check-in blocked', message: err.message, tone: 'danger' };
    if (err.status === 404) return { title: 'Member not found', message: 'This QR code isn’t recognised. The member may have rotated their code — ask them to refresh it in the app, or search by name.', tone: 'danger' };
    if (err.status === 403) return { title: 'Not allowed', message: err.message, tone: 'danger' };
  }
  return { title: 'Check-in failed', message: err instanceof Error ? err.message : 'Something went wrong', tone: 'danger' };
}

function CameraScanner({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    const Detector = getDetector();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let last = 0;
    setError(null);
    setReady(false);
    const detector = new Detector({ formats: ['qr_code'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        const tick = async (t: number) => {
          if (stopped) return;
          if (t - last > 250 && v.readyState >= 2) {
            last = t;
            try {
              const codes = await detector.detect(v);
              const hit = codes.find((c) => c.rawValue);
              if (hit) {
                stopped = true;
                onScan(hit.rawValue);
                return;
              }
            } catch {
              /* frame not ready */
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setError((err as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser and try again.' : 'Could not start the camera on this device.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onScan]);
  return (
    <Modal open={open} onClose={onClose} title="Scan member QR" description="Hold the member’s QR code (from their app) in front of the camera." size="md">
      {error ? (
        <Alert tone="danger" title="Camera unavailable">
          {error}
        </Alert>
      ) : (
        <div className="relative overflow-hidden rounded-theme bg-black">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline aria-label="Camera preview" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-white/80">
              <Spinner className="h-7 w-7" label="Starting camera" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" aria-hidden />
        </div>
      )}
    </Modal>
  );
}

function OutcomeCard({ outcome, onDismiss }: { outcome: Outcome; onDismiss: () => void }) {
  if (outcome.kind === 'success') {
    const { member, membership, record } = outcome.data;
    const days = Math.ceil((new Date(membership.endDate).getTime() - Date.now()) / 86400000);
    return (
      <div role="status" className="relative overflow-hidden rounded-theme border border-success/40 bg-success/[0.07] p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={member.name} src={member.avatarUrl || undefined} size={64} />
            <CheckCircle2 className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-surface text-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success">Checked in · {fmtTime(record.checkInAt)}</p>
            <p className="truncate font-display text-2xl font-semibold">{member.name}</p>
            <p className="text-sm text-muted">
              {membership.planName} · valid to {fmtDate(membership.endDate)}
              {days <= 7 && <Badge tone="warning" className="ml-2">{days <= 0 ? 'ends today' : `${days} days left`}</Badge>}
            </p>
          </div>
          <div className="hidden flex-col gap-2 sm:flex">
            <Link to={`/admin/members/${member.id}`} className="text-sm text-primary hover:underline">
              Profile
            </Link>
            <button type="button" className="text-sm text-muted hover:text-fg" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
  const Icon = outcome.tone === 'warning' ? AlertTriangle : XCircle;
  return (
    <div role="alert" className={cn('rounded-theme border p-5', outcome.tone === 'warning' ? 'border-warning/40 bg-warning/[0.07]' : 'border-danger/40 bg-danger/[0.07]')}>
      <div className="flex items-start gap-4">
        <Icon className={cn('mt-0.5 h-8 w-8 shrink-0', outcome.tone === 'warning' ? 'text-warning' : 'text-danger')} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold">{outcome.title}</p>
          <p className="mt-0.5 text-sm text-fg/80">{outcome.message}</p>
          {outcome.title === 'No active membership' && outcome.memberId && (
            <Link to={`/admin/members/${outcome.memberId}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              Open profile to record a payment →
            </Link>
          )}
        </div>
        <button type="button" className="text-sm text-muted hover:text-fg" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const cameraSupported = Boolean(getDetector()) && hasCamera();
  const isQr = /^APEX:/i.test(text.trim());
  const dq = useDebounced(text.trim(), 250);
  const search = useQuery({
    queryKey: ['admin', 'members', 'search', dq],
    queryFn: () => api.get<MemberRow[]>('/members', { q: dq, limit: 6 }),
    enabled: dq.length >= 2 && !/^APEX:/i.test(dq),
  });
  const results = dq.length >= 2 && !isQr ? search.data ?? [] : [];
  useEffect(() => setHi(0), [dq]);

  const today = useQuery({ queryKey: ['admin', 'attendance', 'today'], queryFn: () => api.getPaged<AttendanceRecord[]>('/attendance', { limit: 100 }), refetchInterval: 30_000 });

  const refocus = () => setTimeout(() => input.current?.focus(), 50);
  const checkIn = useMutation({
    mutationFn: (body: { qr?: string; memberId?: string }) => api.post<CheckInResult>('/attendance/check-in', body),
    onSuccess: (data) => {
      setOutcome({ kind: 'success', data });
      setText('');
      void qc.invalidateQueries({ queryKey: ['admin', 'attendance'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
      refocus();
    },
    onError: (err, vars) => {
      setOutcome({ kind: 'error', ...describeError(err), memberId: vars.memberId });
      setText('');
      refocus();
    },
  });
  const checkOut = useMutation({
    mutationFn: (id: string) => api.post(`/attendance/${id}/check-out`),
    onSuccess: () => {
      toast.success('Checked out');
      void qc.invalidateQueries({ queryKey: ['admin', 'attendance'] });
    },
    onError: (err) => toast.error(err),
  });

  const submit = () => {
    const v = text.trim();
    if (!v || checkIn.isPending) return;
    if (/^APEX:/i.test(v)) return checkIn.mutate({ qr: `APEX:${v.slice(5)}` });
    if (results[hi]) return checkIn.mutate({ memberId: results[hi].id });
  };
  const onScan = useCallback(
    (raw: string) => {
      setCameraOpen(false);
      const v = raw.trim();
      if (!/^APEX:/i.test(v)) {
        setOutcome({ kind: 'error', title: 'Not a member code', message: 'That QR code isn’t an Apex member pass.', tone: 'danger' });
        return;
      }
      checkIn.mutate({ qr: v });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Clear success card after a while so the desk is ready for the next member.
  useEffect(() => {
    if (outcome?.kind !== 'success') return;
    const t = setTimeout(() => setOutcome(null), 12000);
    return () => clearTimeout(t);
  }, [outcome]);

  const records = today.data?.data ?? [];
  const inside = records.filter((r) => !r.checkOutAt).length;
  return (
    <div>
      <PageHeader eyebrow="Front desk" title="Check-in" description="Scan a member’s QR pass or search by name. One check-in per member per day; an active membership is required." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <label htmlFor="checkin-input" className="label">
              Scan QR or search member
            </label>
            <div className="relative">
              {isQr ? <QrCode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" /> : <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />}
              <input
                id="checkin-input"
                ref={input}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="input h-14 pl-12 pr-28 text-lg"
                placeholder="APEX:… or name, email, phone"
                value={text}
                onChange={(e) => setText(e.target.value)}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="checkin-results"
                aria-activedescendant={results[hi] ? `checkin-opt-${hi}` : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHi((h) => Math.min(h + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHi((h) => Math.max(h - 1, 0));
                  } else if (e.key === 'Escape') setText('');
                }}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {checkIn.isPending && <Spinner className="h-5 w-5 text-primary" />}
                {isQr && (
                  <Button size="sm" onClick={submit} disabled={checkIn.isPending}>
                    Check in
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {cameraSupported ? (
                <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => setCameraOpen(true)}>
                  Scan with camera
                </Button>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <CameraOff className="h-3.5 w-3.5" />
                  Camera scanning isn’t supported in this browser (needs the BarcodeDetector API, e.g. Chrome on Android). Use a USB/Bluetooth scanner or search instead.
                </p>
              )}
              <p className="text-xs text-muted">USB scanners work out of the box — keep this field focused.</p>
            </div>

            {dq.length >= 2 && !isQr && (
              <ul id="checkin-results" role="listbox" aria-label="Matching members" className="mt-4 divide-y divide-line/70 rounded-theme-sm border border-line">
                {search.isFetching && !search.data && (
                  <li className="p-3">
                    <Skeleton className="h-10" />
                  </li>
                )}
                {search.isError && <li className="p-4 text-sm text-danger">Search failed. Try again.</li>}
                {search.data && results.length === 0 && <li className="p-4 text-sm text-muted">No members match “{dq}”.</li>}
                {results.map((m, i) => {
                  const ok = m.status === 'active' && m.membership?.status === 'active';
                  return (
                    <li key={m.id} id={`checkin-opt-${i}`} role="option" aria-selected={i === hi} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', i === hi && 'bg-fg/[0.04]')} onMouseEnter={() => setHi(i)}>
                      <Avatar name={m.name} src={m.avatarUrl || undefined} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted">
                          {m.membership ? `${m.membership.planName} · ${m.membership.status} · to ${fmtDate(m.membership.endDate)}` : 'No membership'}
                        </p>
                      </div>
                      {m.status !== 'active' ? (
                        <StatusBadge status={m.status} />
                      ) : !ok ? (
                        <Badge tone="warning">no active plan</Badge>
                      ) : null}
                      <Button size="sm" variant={ok ? 'primary' : 'secondary'} disabled={checkIn.isPending} onClick={() => checkIn.mutate({ memberId: m.id })}>
                        Check in
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <AnimatePresence mode="wait">
            {outcome && (
              <motion.div key={outcome.kind === 'success' ? outcome.data.record._id : outcome.title + outcome.message} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}>
                <OutcomeCard
                  outcome={outcome}
                  onDismiss={() => {
                    setOutcome(null);
                    refocus();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {!outcome && (
            <div className="hidden rounded-theme border border-dashed border-line p-8 text-center text-muted xl:block">
              <ScanLine className="mx-auto mb-2 h-8 w-8 opacity-60" />
              <p className="text-sm">Ready for the next member.</p>
            </div>
          )}
        </div>

        <Card>
          <CardHeader title="Today’s attendance" description={today.data ? `${today.data.meta?.total ?? records.length} check-ins · ${inside} currently in` : 'Live — refreshes every 30 seconds'} />
          {today.error ? (
            <ErrorState className="m-5" error={today.error} onRetry={() => today.refetch()} />
          ) : today.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState className="m-5" icon={<UserX className="h-5 w-5" />} title="No check-ins yet today" description="Members appear here as they arrive." />
          ) : (
            <ul className="scrollbar-thin max-h-[640px] divide-y divide-line/70 overflow-y-auto">
              {records.map((r) => {
                const u = typeof r.user === 'object' ? r.user : null;
                return (
                  <li key={r._id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={u?.name ?? '?'} src={u?.avatarUrl || undefined} size={34} />
                    <div className="min-w-0 flex-1">
                      {u ? (
                        <Link to={`/admin/members/${u._id}`} className="block truncate text-sm font-medium hover:text-primary">
                          {u.name}
                        </Link>
                      ) : (
                        <p className="text-sm">Unknown member</p>
                      )}
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <Clock className="h-3 w-3" />
                        {fmtTime(r.checkInAt)}
                        {r.checkOutAt ? ` – ${fmtTime(r.checkOutAt)}` : ''}
                        <span>· {r.method === 'qr' ? 'QR' : r.method}</span>
                        {r.gymClass && typeof r.gymClass === 'object' && <span>· {r.gymClass.title}</span>}
                      </p>
                    </div>
                    {r.checkOutAt ? (
                      <Badge>left</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<LogOut className="h-3.5 w-3.5" />} loading={checkOut.isPending && checkOut.variables === r._id} onClick={() => checkOut.mutate(r._id)}>
                        Check out
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      {cameraSupported && <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={onScan} />}
    </div>
  );
}
