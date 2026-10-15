import os from 'node:os';
import { logger } from '../config/logger';
import { JobStateModel } from '../models';

const instanceId = `${os.hostname()}:${process.pid}`;

/**
 * Runs a job under a MongoDB lease lock so only one server instance executes it at a time.
 * The lock expires automatically (crash-safe). Results/errors are persisted for the admin.
 */
export async function runJob(name: string, leaseMs: number, fn: () => Promise<unknown>): Promise<{ ran: boolean; result?: unknown; error?: string }> {
  const now = new Date();
  await JobStateModel.updateOne({ name }, { $setOnInsert: { name, lockedUntil: new Date(0) } }, { upsert: true }).catch(() => undefined);
  const lock = await JobStateModel.findOneAndUpdate(
    { name, lockedUntil: { $lte: now } },
    { $set: { lockedUntil: new Date(now.getTime() + leaseMs), lockedBy: instanceId, lastStartedAt: now } },
    { new: true },
  );
  if (!lock) return { ran: false };
  try {
    const result = await fn();
    await JobStateModel.updateOne({ name }, { $set: { lastFinishedAt: new Date(), lastStatus: 'ok', lastResult: result ?? null, lockedUntil: new Date() }, $unset: { lastError: 1 } });
    return { ran: true, result };
  } catch (err) {
    const message = (err as Error).message?.slice(0, 500) ?? 'error';
    logger.error({ job: name, err: message }, 'Scheduled job failed');
    await JobStateModel.updateOne({ name }, { $set: { lastFinishedAt: new Date(), lastStatus: 'error', lastError: message, lockedUntil: new Date() } });
    return { ran: true, error: message };
  }
}
