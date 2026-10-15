/**
 * The actual WebGL scene. Lazy-loaded by SceneCanvas so three.js, @react-three/fiber and drei
 * live in separate chunks that are only fetched when a scene is about to be on screen.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, PerformanceMonitor, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneConfig } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { QualityContext } from './context';
import { Lighting } from './Lighting';
import { MaterialsProvider, useThemeColor } from './materials';
import { ModelView, resolveModel, type ResolvedModel } from './models/registry';
import type { QualitySettings } from './quality';
import { Rig } from './Rig';

export interface SceneRootProps {
  config: SceneConfig;
  quality: QualitySettings;
  /** False when off-screen or the tab is hidden: rendering stops entirely. */
  active: boolean;
  onReady: () => void;
  onContextLost: () => void;
  scrollTarget?: RefObject<HTMLElement>;
  className?: string;
}

/** Keeps the camera in sync with SceneConfig (the builder can change it live). */
function CameraSync({ position, fov }: { position: SceneConfig['cameraPosition']; fov: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.fov = fov;
    camera.near = 0.1;
    camera.far = 60;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, position, fov, invalidate]);
  return null;
}

/** Signals readiness after the first couple of real frames (so the poster cross-fades cleanly). */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const n = useRef(0);
  const done = useRef(false);
  useFrame((s) => {
    if (done.current) return;
    n.current += 1;
    if (n.current >= 3) {
      done.current = true;
      onReady();
    } else s.invalidate();
  });
  return null;
}

function Stage({ model, quality, modelKey }: { model: ResolvedModel; quality: QualitySettings; modelKey: string }) {
  const [fit, setFit] = useState<{ key: string; h: number } | null>(null);
  const height = fit && fit.key === modelKey ? fit.h : null;
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const onFit = useCallback(
    (h: number) => {
      setFit({ key: modelKey, h });
      invalidate();
    },
    [invalidate, modelKey],
  );
  useEffect(() => {
    if (!quality.shadows || height === null) return;
    group.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [quality.shadows, height]);
  const size = model.def.size;
  return (
    <group ref={group}>
      <ModelView key={modelKey} model={model} onFit={onFit} />
      {quality.contactShadows && height !== null && (
        <ContactShadows
          key={`${modelKey}-${height.toFixed(3)}`}
          position={[0, -height / 2 - 0.004, 0]}
          scale={size * 1.7}
          far={Math.max(0.6, height)}
          blur={2.6}
          opacity={0.7}
          resolution={quality.contactShadowResolution}
          frames={1}
          color="#000000"
        />
      )}
    </group>
  );
}

function LoadingIndicator({ show }: { show: boolean }) {
  const { active, progress } = useProgress();
  if (!show || !active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto flex w-48 flex-col items-center gap-2" role="status" aria-live="polite">
      <div className="h-px w-full overflow-hidden bg-fg/10">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">Loading model {Math.round(progress)}%</span>
    </div>
  );
}

export default function SceneRoot({ config, quality, active, onReady, onContextLost, scrollTarget, className }: SceneRootProps) {
  const { site } = useSite();
  const model = useMemo(() => resolveModel(config.modelId, site?.models), [config.modelId, site?.models]);
  const [dpr, setDpr] = useState(quality.maxDpr);
  const bg = useThemeColor('--c-background', '#08090b');
  const reduced = quality.reducedMotion;
  const animating = config.autoRotate && !reduced && config.animationSpeed > 0;
  const frameloop = !active ? 'never' : animating ? 'always' : 'demand';
  const modelKey = model.kind === 'gltf' ? model.url : config.modelId;

  return (
    <div className={cn('absolute inset-0', className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, dpr]}
        shadows={quality.shadows ? 'soft' : false}
        gl={{ antialias: quality.antialias, alpha: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: config.cameraPosition, fov: config.fov, near: 0.1, far: 60 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onContextLost();
          });
        }}
        aria-hidden
      >
        <QualityContext.Provider value={quality}>
          <MaterialsProvider quality={quality}>
            <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, Math.round((d - 0.25) * 100) / 100))} />
            <fog attach="fog" args={[bg, 9, 20]} />
            <CameraSync position={config.cameraPosition} fov={config.fov} />
            <Lighting environment={config.environment} quality={quality} />
            <Rig config={config} motion={model.def.motion} baseRotation={model.def.baseRotation} reducedMotion={reduced} scrollTarget={scrollTarget}>
              <Stage model={model} quality={quality} modelKey={modelKey} />
            </Rig>
            <FirstFrames onReady={onReady} />
          </MaterialsProvider>
        </QualityContext.Provider>
      </Canvas>
      <LoadingIndicator show={model.kind === 'gltf'} />
    </div>
  );
}
