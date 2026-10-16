import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CheckCircle2, Keyboard, ScanLine, Users, XCircle } from 'lucide-react';
import { Avatar, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import type { AssignedMember, AttendanceRecord, Ref } from '@/member/components/types';
import { QrScanner, qrScanSupported } from '../components/QrScanner';

interface CheckInResult {
  record: AttendanceRecord;
  member: { id: string; name: string; avatarUrl: string };
  membership: { planName: string; endDate: string };
}
type Mode = 'camera' | 'code' | 'member';
type Outcome = { ok: true; r: CheckInResult } | { ok: false; message: string; code?: string };

export default function TrainerCheckInPage() {
  const qc = useQueryClient();
  const canScan = qrScanSupported();
  const [mode, setMode] = useState<Mode>(canScan ? 'camera' : 'code');
  const [code, setCode] = useState('');
  const [memberId, setMemberId] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const today = useQuery({ queryKey: ['trainer', 'attendance', 'today'], queryFn: () => api.getPaged<(Omit<AttendanceRecord, 'user'> & { user: Ref })[]>('/attendance', { limit: 100 }), refetchInterval: 60_000 });
  const members = useQuery({ queryKey: ['trainer', 'members'], queryFn: () => api.get<AssignedMember[]>('/trainers/me/members') });

  const check = useMutation({
    mutationFn: (body: { qr?: string; memberId?: string }) => api.post<CheckInResult>('/attendance/check-in', body),
    onSuccess: (r) => {
      setOutcome({ ok: true, r });
      setCode('');
      setMemberId('');
      void qc.invalidateQueries({ queryKey: ['trainer', 'attendance'] });
    },
    onError: (e) => setOutcome({ ok: false, message: errorMessage(e), code: e instanceof ApiError ? e.code : undefined }),
  });

  const tabs: { value: Mode; label: React.ReactNode }[] = [
    ...(canScan ? [{ value: 'camera' as const, label: <span className="inline-flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Scan</span> }] : []),
    { value: 'code', label: <span className="inline-flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" /> Enter code</span> },
    { value: 'member', label: <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Pick member</span> },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Coaching" title="Check-in" description="Check in members assigned to you. An active membership is required, and each member can check in once per day." />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardBody className="space-y-4">
            <Tabs<Mode> className="w-fit" value={mode} onChange={(m) => (setMode(m), setOutcome(null))} tabs={tabs} />
            {mode === 'camera' && <QrScanner paused={check.isPending} onResult={(v) => check.mutate({ qr: v.trim() })} />}
            {mode === 'code' && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim().length >= 10) check.mutate({ qr: code.trim() });
                  else setOutcome({ ok: false, message: 'That code looks too short. Codes start with APEX:' });
                }}
              >
                <Input label="Member QR code" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} placeholder="APEX:…" hint="Works with USB/Bluetooth barcode scanners too — they type the code and press Enter." />
                <Button type="submit" icon={<ScanLine className="h-4 w-4" />} loading={check.isPending}>
                  Check in
                </Button>
              </form>
            )}
            {mode === 'member' && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (memberId) check.mutate({ memberId });
                }}
              >
                <Select label="Member" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder={members.isLoading ? 'Loading…' : members.data?.length ? 'Choose a member' : 'No assigned members'} options={(members.data ?? []).map((m) => ({ value: m.user._id, label: `${m.user.name}${m.membership ? '' : ' (no active membership)'}` }))} />
                <Button type="submit" disabled={!memberId} loading={check.isPending} icon={<CheckCircle2 className="h-4 w-4" />}>
                  Check in
                </Button>
              </form>
            )}
            <AnimatePresence mode="wait">
              {outcome && (
                <motion.div key={outcome.ok ? outcome.r.record._id : outcome.message} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} role={outcome.ok ? 'status' : 'alert'} className={`flex items-center gap-3 rounded-2xl border p-4 ${outcome.ok ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`}>
                  {outcome.ok ? (
                    <>
                      <Avatar name={outcome.r.member.name} src={outcome.r.member.avatarUrl || undefined} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-semibold text-success">
                          <CheckCircle2 className="h-4 w-4" /> {outcome.r.member.name} checked in
                        </p>
                        <p className="text-sm text-muted">
                          {outcome.r.membership.planName} · valid until {fmtDate(outcome.r.membership.endDate)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 shrink-0 text-danger" />
                      <div>
                        <p className="font-semibold">Not checked in</p>
                        <p className="text-sm text-muted">{outcome.code === 'NOT_FOUND' ? 'No member matches this code — it may have been regenerated. Ask them to refresh their QR.' : outcome.message}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Today’s check-ins" description={today.data ? `${today.data.meta?.total ?? today.data.data.length} of your members` : undefined} />
          <CardBody>
            {today.isError ? (
              <ErrorState error={today.error} onRetry={() => today.refetch()} />
            ) : today.isLoading ? (
              <Skeleton className="h-40" />
            ) : !today.data?.data.length ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No check-ins yet today" className="py-8" />
            ) : (
              <ul className="space-y-2">
                {today.data.data.map((a) => (
                  <li key={a._id} className="flex items-center gap-3">
                    <Avatar name={a.user?.name ?? '?'} src={a.user?.avatarUrl || undefined} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.user?.name}</p>
                      <p className="text-xs text-muted">{a.gymClass && typeof a.gymClass === 'object' ? a.gymClass.title : a.method === 'qr' ? 'QR' : 'Manual'}</p>
                    </div>
                    <span className="text-xs tabular-nums text-muted">{fmtTime(a.checkInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
