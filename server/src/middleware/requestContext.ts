import type { Request } from 'express';

/** Coarse client IP for audit logs (last octet / suffix removed for privacy). */
export function clientIp(req: Request): string {
  const ip = req.ip ?? '';
  if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.') + '.x';
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::';
  return ip;
}
