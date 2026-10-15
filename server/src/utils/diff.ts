const SENSITIVE = /password|secret|token|signature|hash/i;

/** Shallow diff for audit logs; sensitive keys are masked. */
export function shallowDiff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before?.[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[key] = SENSITIVE.test(key) ? { from: '[redacted]', to: '[redacted]' } : { from: truncate(a), to: truncate(b) };
    }
  }
  return out;
}

function truncate(v: unknown): unknown {
  const s = JSON.stringify(v);
  if (s && s.length > 500) return s.slice(0, 500) + '…';
  return v;
}
