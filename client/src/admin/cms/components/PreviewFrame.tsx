import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react';
import type { DraftSection, ThemeTokens } from '@apex/shared';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { IconButton, Segmented } from './bits';

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICE_WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export interface PreviewPayload {
  sections?: DraftSection[];
  theme?: ThemeTokens;
}

/**
 * Scaled live-preview iframe.
 * Protocol: the preview route posts `{type:'apex-preview-ready'}` to its parent when mounted;
 * we post `{type:'apex-preview', sections?, theme?}` (same origin only) on ready and whenever the payload changes.
 */
export function PreviewFrame({ src, payload, toolbarLeft, className, title = 'Live preview' }: { src: string; payload: PreviewPayload; toolbarLeft?: ReactNode; className?: string; title?: string }) {
  const [device, setDevice] = useState<Device>('desktop');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const latest = useRef(payload);
  latest.current = payload;

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const post = () => {
    frame.current?.contentWindow?.postMessage({ type: 'apex-preview', ...latest.current }, window.location.origin);
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === 'apex-preview-ready') {
        setReady(true);
        post();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Debounced push of the current unsaved state.
  useEffect(() => {
    const t = setTimeout(post, 200);
    return () => clearTimeout(t);
  }, [payload]);

  useEffect(() => {
    setReady(false);
    setLoaded(false);
  }, [src, reloadKey]);

  const deviceW = DEVICE_WIDTHS[device];
  const pad = 24;
  const scale = box.w ? Math.min(1, (box.w - pad) / deviceW) : 0.5;
  const frameH = box.h ? (box.h - pad) / scale : 800;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-3 py-2">
        {toolbarLeft}
        <div className="flex-1" />
        <Segmented
          label="Preview device"
          size="sm"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: <Monitor className="h-3.5 w-3.5" />, title: 'Desktop (1280px)' },
            { value: 'tablet', label: <Tablet className="h-3.5 w-3.5" />, title: 'Tablet (820px)' },
            { value: 'mobile', label: <Smartphone className="h-3.5 w-3.5" />, title: 'Mobile (390px)' },
          ]}
        />
        <span className="hidden w-14 text-right text-[0.7rem] tabular-nums text-muted sm:inline">{Math.round(scale * 100)}%</span>
        <IconButton label="Reload preview" onClick={() => setReloadKey((k) => k + 1)}>
          <RotateCw className="h-4 w-4" />
        </IconButton>
        <a href={src} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-fg/[0.07] hover:text-fg" aria-label="Open preview in a new tab" title="Open preview in a new tab (shows the last saved draft)">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgb(var(--c-text)/0.07)_1px,transparent_0)] [background-size:16px_16px]">
        <div className="absolute left-1/2 top-3 -translate-x-1/2 overflow-hidden rounded-xl shadow-2xl ring-1 ring-line" style={{ width: deviceW * scale, height: frameH * scale }}>
          <iframe
            key={reloadKey}
            ref={frame}
            src={src}
            title={title}
            onLoad={() => {
              setLoaded(true);
              post();
            }}
            className="origin-top-left border-0 bg-bg"
            style={{ width: deviceW, height: frameH, transform: `scale(${scale})` }}
          />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center bg-bg/80 text-primary">
              <Spinner label="Loading preview" />
            </div>
          )}
        </div>
        {loaded && !ready && <span className="sr-only">Preview loaded</span>}
      </div>
    </div>
  );
}
