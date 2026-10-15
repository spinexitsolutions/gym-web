import { useId } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { BUILTIN_MODELS, sceneConfigSchema, type SceneConfig } from '@apex/shared';
import { Select, Switch } from '@/components/ui';
import { useSite } from '@/app/SiteProvider';
import { FieldError, RangeField } from './bits';
import { isRecord } from './utils';

const SCENE_DEFAULTS: SceneConfig = sceneConfigSchema.parse({});

export function normaliseScene(v: unknown, fallback: Partial<SceneConfig> = {}): SceneConfig {
  const raw = isRecord(v) ? v : {};
  const merged = { ...SCENE_DEFAULTS, ...fallback, ...raw } as SceneConfig;
  return merged;
}

/** Built-in procedural + approved uploaded models (from /cms/site). */
export function useModelOptions(current?: string) {
  const { site } = useSite();
  const models = site?.models ?? BUILTIN_MODELS.map((m) => ({ id: m.id, name: m.name, kind: m.kind, url: null }));
  const options = models.map((m) => ({ value: m.id, label: `${m.name}${m.kind === 'gltf' ? ' (uploaded)' : ''}` }));
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: `${current} (unavailable — not approved)` });
  return options;
}

function Vec3Field({ label, value, onChange, step = 0.1, errors }: { label: string; value: [number, number, number]; onChange: (v: [number, number, number]) => void; step?: number; errors?: Record<string, string> }) {
  const id = useId();
  const err = errors && Object.values(errors)[0];
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <label key={axis} htmlFor={`${id}-${axis}`} className="flex items-center gap-1.5 rounded-theme-sm border border-line bg-bg/60 pl-2.5 text-xs text-muted focus-within:border-primary/70">
            {axis}
            <input
              id={`${id}-${axis}`}
              type="number"
              step={step}
              min={-50}
              max={50}
              value={Number.isFinite(value[i]) ? value[i] : 0}
              onChange={(e) => {
                const next = [...value] as [number, number, number];
                next[i] = e.target.value === '' ? 0 : Number(e.target.value);
                onChange(next);
              }}
              className="w-full min-w-0 bg-transparent py-2 pr-2 text-sm text-fg outline-none"
            />
          </label>
        ))}
      </div>
      <FieldError>{err}</FieldError>
    </fieldset>
  );
}

/** Full SceneConfig editor (model, transform, camera, animation, environment). */
export function SceneEditor({ value, onChange, errors, fallback }: { value: unknown; onChange: (v: SceneConfig) => void; errors: Record<string, string>; fallback?: Partial<SceneConfig> }) {
  const scene = normaliseScene(value, fallback);
  const set = <K extends keyof SceneConfig>(k: K, v: SceneConfig[K]) => onChange({ ...scene, [k]: v });
  const modelOptions = useModelOptions(scene.modelId);
  const sub = (prefix: string) => Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(prefix)));

  return (
    <div className="space-y-5 rounded-theme-sm border border-line bg-bg/30 p-4">
      <Switch label="Show 3D scene" description="When off (or on low-power devices) the fallback image is shown." checked={scene.enabled} onChange={(v) => set('enabled', v)} />
      <div className={scene.enabled ? 'space-y-5' : 'pointer-events-none space-y-5 opacity-50'} aria-disabled={!scene.enabled}>
        <div>
          <Select label="Model" value={scene.modelId} onChange={(e) => set('modelId', e.target.value)} options={modelOptions} error={errors.modelId} />
          <p className="mt-1.5 text-xs text-muted">
            Upload and approve custom .glb models under{' '}
            <Link to="/admin/website/models" className="text-primary hover:underline">
              3D models
            </Link>
            .
          </p>
        </div>
        <RangeField label="Scale" min={0.1} max={5} step={0.05} value={scene.scale} onChange={(v) => set('scale', v)} format={(v) => `${v.toFixed(2)}×`} error={errors.scale} />
        <fieldset className="space-y-3">
          <legend className="label">Rotation (degrees)</legend>
          {(['X', 'Y', 'Z'] as const).map((axis, i) => (
            <RangeField
              key={axis}
              label={`Rotate ${axis}`}
              min={-180}
              max={180}
              step={1}
              value={scene.rotation[i] ?? 0}
              format={(v) => `${v}°`}
              onChange={(v) => {
                const r = [...scene.rotation] as [number, number, number];
                r[i] = v;
                set('rotation', r);
              }}
              error={errors[`rotation.${i}`]}
            />
          ))}
        </fieldset>
        <Vec3Field label="Position" value={scene.position} onChange={(v) => set('position', v)} errors={sub('position')} />
        <Vec3Field label="Camera position" value={scene.cameraPosition} onChange={(v) => set('cameraPosition', v)} errors={sub('cameraPosition')} />
        <RangeField label="Field of view" min={20} max={75} value={scene.fov} onChange={(v) => set('fov', v)} format={(v) => `${v}°`} error={errors.fov} />
        <RangeField label="Animation speed" min={0} max={3} step={0.1} value={scene.animationSpeed} onChange={(v) => set('animationSpeed', v)} format={(v) => `${v.toFixed(1)}×`} error={errors.animationSpeed} />
        <Select
          label="Lighting environment"
          value={scene.environment}
          onChange={(e) => set('environment', e.target.value as SceneConfig['environment'])}
          options={[
            { value: 'studio', label: 'Studio (neutral)' },
            { value: 'night', label: 'Night (cool, moody)' },
            { value: 'warm', label: 'Warm (golden)' },
          ]}
        />
        <div className="space-y-3">
          <Switch label="Auto-rotate" checked={scene.autoRotate} onChange={(v) => set('autoRotate', v)} />
          <Switch label="Interactive" description="Visitors can drag to rotate the model." checked={scene.interactive} onChange={(v) => set('interactive', v)} />
          <Switch label="Scroll animation" description="Model moves subtly as the visitor scrolls." checked={scene.scrollAnimation} onChange={(v) => set('scrollAnimation', v)} />
        </div>
      </div>
      <div className="flex justify-end border-t border-line/60 pt-3">
        <button type="button" onClick={() => onChange({ ...SCENE_DEFAULTS, ...fallback, modelId: scene.modelId, enabled: scene.enabled })} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
          <RotateCcw className="h-3.5 w-3.5" /> Reset transform & camera
        </button>
      </div>
    </div>
  );
}
