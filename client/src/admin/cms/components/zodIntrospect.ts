import type { z } from 'zod';
import { sectionPropsSchemas, type SectionType } from '@apex/shared';

/**
 * Light schema introspection used to show character counters / item limits in the builder.
 * Uses `_def.typeName` (not instanceof) so it works even if two zod copies are bundled.
 */
type AnyDef = { typeName?: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny; checks?: { kind: string; value: number }[]; maxLength?: { value: number } | null; minLength?: { value: number } | null };
const def = (s: z.ZodTypeAny | undefined) => (s?._def ?? {}) as AnyDef;

export function unwrap(schema: z.ZodTypeAny | undefined): z.ZodTypeAny | undefined {
  let s = schema;
  for (let i = 0; i < 10 && s; i++) {
    const d = def(s);
    if (d.typeName === 'ZodDefault' || d.typeName === 'ZodOptional' || d.typeName === 'ZodNullable') s = d.innerType;
    else if (d.typeName === 'ZodEffects') s = d.schema;
    else break;
  }
  return s;
}

export function propSchema(type: SectionType, key: string): z.ZodTypeAny | undefined {
  const obj = sectionPropsSchemas[type] as unknown as { shape: Record<string, z.ZodTypeAny> };
  return obj.shape[key];
}

/** Max length for string fields, max items for array fields. */
export function maxOf(schema: z.ZodTypeAny | undefined): number | undefined {
  const d = def(unwrap(schema));
  if (d.typeName === 'ZodString') return d.checks?.find((c) => c.kind === 'max')?.value;
  if (d.typeName === 'ZodArray') return d.maxLength?.value;
  return undefined;
}
export function minOf(schema: z.ZodTypeAny | undefined): number | undefined {
  const d = def(unwrap(schema));
  if (d.typeName === 'ZodString') return d.checks?.find((c) => c.kind === 'min')?.value;
  if (d.typeName === 'ZodArray') return d.minLength?.value;
  return undefined;
}
/** True if the field must be non-empty to publish. */
export function isRequired(schema: z.ZodTypeAny | undefined): boolean {
  const t = def(schema).typeName;
  if (!schema || t === 'ZodDefault' || t === 'ZodOptional') return false;
  const min = minOf(schema);
  return min !== undefined && min > 0;
}
