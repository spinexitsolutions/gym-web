import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../ui/Button.jsx';

const b64ToUint8 = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
};

// Optional browser push. Nothing is requested until the member explicitly turns it on.
export function PushToggle() {
  const toast = useToast();
  const key = useQuery({ queryKey: ['push', 'key'], queryFn: async () => (await api.get('/notifications/push/key')).data });
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((s) => setSub(s || null)).catch(() => {});
  }, [supported]);

  if (!supported) return <p className="text-sm text-muted">This browser does not support push notifications.</p>;
  if (key.data && !key.data.enabled) return <p className="text-sm text-muted">Push notifications are not enabled by the club yet. You will still get in-app and email updates.</p>;

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission was not granted. You can change this in your browser settings.');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key.data.publicKey) });
      const json = s.toJSON();
      await api.post('/notifications/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
      setSub(s);
      toast.success('Push notifications enabled on this device');
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
      setSub(null);
      toast.success('Push notifications disabled on this device');
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-3 text-sm text-muted"><BellRing className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />Get booking confirmations, waitlist spots and renewal reminders on this device.</p>
      {sub ? <Button size="sm" variant="outline" loading={busy} onClick={disable}>Turn off</Button> : <Button size="sm" loading={busy} disabled={!key.data} onClick={enable}>Turn on</Button>}
    </div>
  );
}
