/**
 * 3D model registry: maps SceneConfig.modelId → a renderable model.
 *
 * Built-in ids (see BUILTIN_MODELS in shared/src/scene.ts) map to procedural components below.
 * They are authored in real-world metres and auto-fitted to the stage by <Fit>.
 *
 * ── Adding a licensed .glb ────────────────────────────────────────────────────────────────
 * Option A — upload (recommended): Admin → Website → 3D models. The server validates the file,
 *   an admin approves it, and it then appears in `useSite().site.models` as
 *   `{ id: 'asset:<mediaId>', kind: 'gltf', url }`. Any SceneConfig whose modelId is `asset:<id>`
 *   is loaded here with drei's useGLTF (progress UI + error boundary → procedural dumbbell fallback).
 * Option B — bundle it: put the file in `client/public/models/<name>.glb` (served at
 *   `/models/<name>.glb`) and add an entry to BUNDLED_GLTF below, e.g.
 *     BUNDLED_GLTF['rower'] = { url: '/models/rower.glb', size: 2.6 };
 *   then add the id to BUILTIN_MODELS in shared/src/scene.ts so editors can pick it.
 * Use uncompressed or meshopt-compressed glTF (Draco is disabled to avoid fetching a decoder
 * from a third-party CDN). Keep files under ~3 MB and textures ≤ 2K. Only use assets you hold
 * a licence for (see docs/3d.md).
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
import { Component, Suspense, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ModelOption } from '@/types/api';
import { Barbell } from './Barbell';
import { Bench } from './Bench';
import { Dumbbell } from './Dumbbell';
import { HeroStack } from './HeroStack';
import { Kettlebell } from './Kettlebell';
import { WeightPlate } from './WeightPlate';

export interface ModelDef {
  component: ComponentType;
  /** Target largest dimension on stage, in world units. */
  size: number;
  /** `spin` = continuous turntable, `sway` = gentle oscillation that keeps a hero angle. */
  motion: 'spin' | 'sway';
  /** Resting yaw/pitch (radians) that shows the model at its best. */
  baseRotation: [number, number, number];
}

const LoadedBarbell = () => <Barbell plates={[{ variant: 'bumper' }, { variant: 'bumper', accent: true }, { variant: 'steel', radius: 0.16, thickness: 0.032 }]} />;
const StandingPlate = () => <WeightPlate accent rotation={[Math.PI / 2, 0, 0]} />;
const ShowDumbbell = () => <Dumbbell accent />;

export const MODEL_REGISTRY: Record<string, ModelDef> = {
  'hero-stack': { component: HeroStack, size: 2.9, motion: 'sway', baseRotation: [0.18, -0.78, 0] },
  dumbbell: { component: ShowDumbbell, size: 2.3, motion: 'spin', baseRotation: [0.18, -0.6, 0] },
  barbell: { component: LoadedBarbell, size: 3.6, motion: 'sway', baseRotation: [0.1, -0.55, 0] },
  kettlebell: { component: Kettlebell, size: 1.9, motion: 'spin', baseRotation: [0.12, 0.5, 0] },
  'weight-plate': { component: StandingPlate, size: 2.1, motion: 'spin', baseRotation: [0.05, -0.5, 0] },
  bench: { component: Bench, size: 2.9, motion: 'sway', baseRotation: [0.16, -0.7, 0] },
};

/** Licensed .glb files bundled under client/public/models (none ship by default). */
export const BUNDLED_GLTF: Record<string, { url: string; size: number }> = {};

export const FALLBACK_MODEL_ID = 'dumbbell';

export type ResolvedModel = { kind: 'procedural'; def: ModelDef } | { kind: 'gltf'; url: string; def: ModelDef };

export function resolveModel(modelId: string, models: ModelOption[] | undefined): ResolvedModel {
  const proc = MODEL_REGISTRY[modelId];
  if (proc) return { kind: 'procedural', def: proc };
  const bundled = BUNDLED_GLTF[modelId];
  if (bundled) return { kind: 'gltf', url: bundled.url, def: { component: () => null, size: bundled.size, motion: 'spin', baseRotation: [0.1, -0.5, 0] } };
  if (modelId.startsWith('asset:')) {
    const asset = models?.find((m) => m.id === modelId && m.kind === 'gltf' && m.url);
    if (asset?.url) return { kind: 'gltf', url: asset.url, def: { component: () => null, size: 2.6, motion: 'spin', baseRotation: [0.1, -0.5, 0] } };
  }
  return { kind: 'procedural', def: MODEL_REGISTRY[FALLBACK_MODEL_ID] };
}

/* ------------------------------------------------------------------ fitting */

/** Bounding box of `root`'s meshes expressed in `root`'s local space. */
function localBox(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld));
    box.union(tmp);
  });
  return box;
}

/**
 * Centres its children on the origin and scales them so their largest dimension equals `size`.
 * Reports the fitted height so the floor shadow can sit exactly under the model.
 */
export interface FitInfo {
  width: number;
  height: number;
  depth: number;
}

export function Fit({ size, children, onFit }: { size: number; children: ReactNode; onFit?: (info: FitInfo) => void }) {
  const inner = useRef<THREE.Group>(null);
  const [fit, setFit] = useState<{ s: number; offset: [number, number, number] } | null>(null);
  useLayoutEffect(() => {
    if (!inner.current) return;
    const box = localBox(inner.current);
    if (box.isEmpty()) return;
    const dim = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = size / Math.max(dim.x, dim.y, dim.z, 1e-6);
    setFit({ s, offset: [-c.x, -c.y, -c.z] });
    onFit?.({ width: dim.x * s, height: dim.y * s, depth: dim.z * s });
  }, [size, onFit]);
  return (
    <group scale={fit?.s ?? 1} visible={Boolean(fit)}>
      <group ref={inner} position={fit?.offset}>
        {children}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- glTF */

function GltfScene({ url }: { url: string }) {
  // Draco disabled on purpose (no third-party decoder download); meshopt is supported.
  const { scene } = useGLTF(url, false, true);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if ('envMapIntensity' in mat) (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.1;
        });
      }
    });
    return c;
  }, [scene]);
  return <primitive object={clone} />;
}

class GltfBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.warn('[3d] model failed to load, using procedural fallback:', err);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Renders a resolved model; glTF errors fall back to the procedural dumbbell. */
export function ModelView({ model, onFit }: { model: ResolvedModel; onFit?: (info: FitInfo) => void }) {
  const fallbackDef = MODEL_REGISTRY[FALLBACK_MODEL_ID];
  const Fallback = fallbackDef.component;
  if (model.kind === 'gltf') {
    const fb = (
      <Fit size={fallbackDef.size} onFit={onFit}>
        <Fallback />
      </Fit>
    );
    return (
      <GltfBoundary fallback={fb}>
        <Suspense fallback={null}>
          <Fit size={model.def.size} onFit={onFit}>
            <GltfScene url={model.url} />
          </Fit>
        </Suspense>
      </GltfBoundary>
    );
  }
  const C = model.def.component;
  return (
    <Fit size={model.def.size} onFit={onFit}>
      <C />
    </Fit>
  );
}
