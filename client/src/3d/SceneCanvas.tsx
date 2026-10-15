/**
 * Public entry point of the 3D layer.
 *
 * This wrapper is tiny and three-free. It:
 *  - detects WebGL and shows a static poster (ScenePoster) when unavailable,
 *  - waits until the element is near the viewport before downloading the 3D chunk
 *    (`SceneRoot`, which pulls in three / @react-three/fiber / drei via React.lazy),
 *  - pauses rendering when off-screen or when the tab is hidden,
 *  - falls back to the poster if the 3D chunk or the WebGL context fails.
 */
import { Component, Suspense, lazy, useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { SceneConfig } from '@apex/shared';
import { cn } from '@/lib/cn';
import { hasWebGL, usePageVisible, useQualityTier, useViewport } from './quality';
import { ScenePoster } from './ScenePoster';

const SceneRoot = lazy(() => import('./SceneRoot'));

export interface SceneCanvasProps {
  config: SceneConfig;
  /** Accessible description of what the scene shows. */
  label: string;
  className?: string;
  /** Element whose scroll progress drives the scroll animation (usually the hero section). */
  scrollTarget?: RefObject<HTMLElement>;
  /** Optional still image used instead of the drawn poster when WebGL is unavailable. */
  fallbackImageUrl?: string;
  fallbackImageAlt?: string;
}

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.warn('[3d] scene disabled, using static fallback:', err);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneCanvas({ config, label, className, scrollTarget, fallbackImageUrl, fallbackImageAlt }: SceneCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const quality = useQualityTier();
  const [webgl] = useState(() => typeof document !== 'undefined' && hasWebGL());
  const { inView, near } = useViewport(ref);
  const pageVisible = usePageVisible();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  // Data-saver users get the static composition; nothing heavy is downloaded.
  const show3d = webgl && !failed && !quality.saveData && config.enabled;

  return (
    <div ref={ref} role="img" aria-label={label} className={cn('relative isolate', className)}>
      <ScenePoster
        modelId={config.modelId}
        imageUrl={show3d ? undefined : fallbackImageUrl}
        imageAlt={fallbackImageAlt}
        className={cn('transition-opacity duration-700', ready && show3d ? 'opacity-0' : 'opacity-100', !show3d || ready ? '' : 'animate-pulse [animation-duration:3s]')}
      />
      {show3d && near && (
        <SceneErrorBoundary onError={onFail}>
          <Suspense fallback={null}>
            <SceneRoot config={config} quality={quality} active={inView && pageVisible} onReady={onReady} onContextLost={onFail} scrollTarget={scrollTarget} className={cn('transition-opacity duration-700', ready ? 'opacity-100' : 'opacity-0')} />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  );
}

export default SceneCanvas;
