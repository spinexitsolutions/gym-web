import { z } from 'zod';

/** Procedural models that ship with the client (see client/src/3d/models). */
export const BUILTIN_MODELS = [
  { id: 'hero-stack', name: 'Hero composition (barbell, plates & dumbbells)', kind: 'procedural' },
  { id: 'dumbbell', name: 'Hex dumbbell', kind: 'procedural' },
  { id: 'barbell', name: 'Olympic barbell', kind: 'procedural' },
  { id: 'kettlebell', name: 'Competition kettlebell', kind: 'procedural' },
  { id: 'weight-plate', name: 'Bumper weight plate', kind: 'procedural' },
  { id: 'bench', name: 'Adjustable bench', kind: 'procedural' },
] as const;
export type BuiltinModelId = (typeof BUILTIN_MODELS)[number]['id'];

export const vec3 = z.tuple([z.number().min(-50).max(50), z.number().min(-50).max(50), z.number().min(-50).max(50)]);

export const sceneConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** A builtin model id or `asset:<mediaAssetId>` for an approved uploaded GLB. */
  modelId: z
    .string()
    .regex(/^([a-z0-9-]+|asset:[a-f0-9]{24})$/)
    .default('hero-stack'),
  scale: z.number().min(0.1).max(5).default(1),
  /** Degrees. */
  rotation: vec3.default([0, 0, 0]),
  position: vec3.default([0, 0, 0]),
  cameraPosition: vec3.default([0, 0.6, 6]),
  fov: z.number().min(20).max(75).default(35),
  autoRotate: z.boolean().default(true),
  animationSpeed: z.number().min(0).max(3).default(1),
  interactive: z.boolean().default(true),
  environment: z.enum(['studio', 'night', 'warm']).default('studio'),
  scrollAnimation: z.boolean().default(true),
});
export type SceneConfig = z.infer<typeof sceneConfigSchema>;

export const defaultScene = (overrides: Partial<SceneConfig> = {}): SceneConfig =>
  sceneConfigSchema.parse(overrides);
