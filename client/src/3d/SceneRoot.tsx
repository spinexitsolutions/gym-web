/**
 * The actual WebGL scene. Lazy-loaded by SceneCanvas so three.js, @react-three/fiber and drei
 * live in separate chunks that are only fetched when a scene is about to be on screen.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useProgress } from '@react-three/drei';
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { SceneConfig } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { QualityContext } from './context';
import { Lighting } from './Lighting';
import { MaterialsProvider, useThemeColor } from './materials';
import { ModelView, resolveModel, type FitInfo, type ResolvedModel } from './models/registry';
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
      if (import.meta.env.DEV) {
        let triangles = 0;
        let meshes = 0;
        s.scene.traverse((o) => {
          const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null;
          if (!g) return;
          meshes += 1;
          triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        });
        (window as unknown as { __apex3d?: unknown }).__apex3d = { triangles: Math.round(triangles), meshes, textures: s.gl.info.memory.textures, geometries: s.gl.info.memory.geometries };
      }
      onReady();
    } else s.invalidate();
  });
  return null;
}

/** Soft radial falloff used for the baked floor shadow. */
function useShadowTexture() {
  const tex = useMemo(() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Stage({ model, quality, modelKey }: { model: ResolvedModel; quality: QualitySettings; modelKey: string }) {
  const [fit, setFit] = useState<{ key: string; info: FitInfo } | null>(null);
  const info = fit && fit.key === modelKey ? fit.info : null;
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const shadowTex = useShadowTexture();
  const onFit = useCallback(
    (i: FitInfo) => {
      setFit({ key: modelKey, info: i });
      invalidate();
    },
    [invalidate, modelKey],
  );
  useEffect(() => {
    if (!quality.shadows || !info) return;
    group.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).userData.noShadow) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [quality.shadows, info]);
  const size = model.def.size;
  // Frame the model inside the canvas at any aspect ratio (narrow canvases shrink it).
  const viewport = useThree((st) => st.viewport);
  const frame = Math.min(1, (viewport.width * 0.7) / size, (viewport.height * 0.95) / (size * 0.75));
  return (
    <group ref={group} scale={frame}>
      <ModelView key={modelKey} model={model} onFit={onFit} />
      {info && (
        // Baked contact shadow: two stacked soft footprints (tight core + wide penumbra).
        <group position={[0, -info.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh scale={[info.width * 1.05, info.depth * 1.15 + 0.15, 1]} userData={{ noShadow: true }} renderOrder={-1}>
            <planeGeometry />
            <meshBasicMaterial map={shadowTex} transparent opacity={quality.contactShadows ? 0.75 : 0.55} depthWrite={false} fog={false} />
          </mesh>
          <mesh scale={[info.width * 1.6, info.depth * 1.9 + 0.5, 1]} userData={{ noShadow: true }} renderOrder={-2}>
            <planeGeometry />
            <meshBasicMaterial map={shadowTex} transparent opacity={0.35} depthWrite={false} fog={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Subtle post-processing on medium/high tiers: soft bloom on chrome highlights + SMAA. (The vignette is CSS so the canvas stays transparent.) */
function Effects({ quality }: { quality: QualitySettings }) {
  if (quality.tier === 'low' || quality.reducedMotion) return null;
  return (
    <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.15} intensity={0.45} radius={0.6} />
      {quality.tier === 'medium' ? <SMAA /> : <></>}
    </EffectComposer>
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
            <Effects quality={quality} />
            <FirstFrames onReady={onReady} />
          </MaterialsProvider>
        </QualityContext.Provider>
      </Canvas>
      <LoadingIndicator show={model.kind === 'gltf'} />
    </div>
  );
}
