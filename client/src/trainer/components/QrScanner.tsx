import { useEffect, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/** True when the browser has the native BarcodeDetector API and a camera API. */
export const qrScanSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);

/** Live camera QR scanner using the native BarcodeDetector. Calls onResult once per distinct code. */
export function QrScanner({ onResult, paused }: { onResult: (value: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ v: string; t: number } | null>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = new Detector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          if (!pausedRef.current && v.readyState >= 2) {
            try {
              const codes = await detector.detect(v);
              const raw = codes[0]?.rawValue;
              if (raw && (last.current?.v !== raw || Date.now() - last.current.t > 4000)) {
                last.current = { v: raw, t: Date.now() };
                cb.current(raw);
              }
            } catch {
              /* frame not ready */
            }
          }
          timer = window.setTimeout(tick, 300);
        };
        void tick();
      } catch (e) {
        setError((e as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, or type/paste the code instead.' : 'Couldn’t start the camera. Use the manual options instead.');
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error)
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        <CameraOff className="h-6 w-6" />
        {error}
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} className="aspect-square w-full object-cover sm:aspect-video" muted playsInline aria-label="Camera preview for QR scanning" />
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-48 w-48 rounded-3xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">{paused ? 'Processing…' : 'Point the camera at the member’s QR code'}</p>
    </div>
  );
}
