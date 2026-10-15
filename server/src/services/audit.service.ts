import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { logger } from '../config/logger';
import { clientIp } from '../middleware/requestContext';
import { AuditLogModel } from '../models';

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | { toString(): string };
  summary?: string;
  changes?: unknown;
}

/** Records a sensitive admin/staff action. Never throws (auditing must not break the request). */
export async function audit(req: Request | null, input: AuditInput, session?: ClientSession) {
  try {
    await AuditLogModel.create(
      [
        {
          actor: req?.user?.id,
          actorName: req?.user?.name ?? 'system',
          actorRole: req?.user?.role ?? 'system',
          action: input.action,
          entity: input.entity,
          entityId: input.entityId?.toString(),
          summary: input.summary,
          changes: input.changes,
          ip: req ? clientIp(req) : undefined,
        },
      ],
      { session },
    );
  } catch (err) {
    logger.error({ err, action: input.action }, 'Failed to write audit log');
  }
}
