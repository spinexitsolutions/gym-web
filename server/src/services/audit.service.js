import { AuditLog } from '../models/index.js';

const REDACT = /pass|token|secret|signature|otp|card/i;

function redact(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) return obj.slice(0, 50).map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = REDACT.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}

// Never throws: an audit failure must not break the admin action, but it is reported.
export async function audit(req, { action, entity, entityId, summary, changes }) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      actorRole: req.user?.role,
      action,
      entity,
      entityId: entityId?.toString(),
      summary,
      changes: changes ? redact(changes) : undefined,
      ip: req.ip,
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}
