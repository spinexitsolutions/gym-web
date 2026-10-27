import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

// Camera QR scanner: native BarcodeDetector where available (Chrome/Android), jsQR fallback elsewhere.
export function QrScanner({ onScan, paused }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const last = useRef({ value: '', at: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) return undefined;
    let stream;
    let raf;
    let stopped = false;
    let detector;
    let jsQR;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.current.srcObject = stream;
        await video.current.play();
        if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        else jsQR = (await import('jsqr')).default;
        const tick = async () => {
          if (stopped) return;
          const v = video.current;
          if (!pausedRef.current && v?.readyState >= 2) {
            let value = null;
            if (detector) {
              const codes = await detector.detect(v).catch(() => []);
              value = codes[0]?.rawValue;
            } else if (jsQR) {
              const c = canvas.current;
              c.width = v.videoWidth; c.height = v.videoHeight;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0);
              value = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' })?.data;
            }
            // Ignore the same code read repeatedly within 4 seconds.
            if (value && (value !== last.current.value || Date.now() - last.current.at > 4000)) {
              last.current = { value, at: Date.now() };
              onScan(value);
            }
          }
          raf = setTimeout(tick, 250);
        };
        tick();
      } catch (err) {
        setError(err.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access or use manual check-in.' : 'No camera available. Use manual check-in below.');
        setActive(false);
      }
    })();
    return () => { stopped = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [active, onScan]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-brand border border-line/10 bg-black">
        <video ref={video} className={active ? 'h-full w-full object-cover' : 'hidden'} muted playsInline aria-label="Camera preview" />
        <canvas ref={canvas} className="hidden" />
        {!active && <div className="grid h-full place-items-center text-sm text-white/60">Camera off</div>}
        {active && <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-gold/80" aria-hidden />}
      </div>
      <Button size="sm" variant={active ? 'outline' : 'primary'} onClick={() => { setError(''); setActive((a) => !a); }}>
        {active ? <><CameraOff className="h-4 w-4" aria-hidden />Stop camera</> : <><Camera className="h-4 w-4" aria-hidden />Start scanner</>}
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
