import cron from 'node-cron';
import env from '../config/env.js';
import { SystemState } from '../models/index.js';
import * as tasks from './tasks.js';

// A DB lease makes each job run on one instance at a time even with several API servers.
async function runLocked(name, fn, leaseMs = 10 * 60 * 1000) {
  const now = new Date();
  const lock = await SystemState.findOneAndUpdate(
    { key: `job:${name}`, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + leaseMs) } },
    { upsert: false, new: true },
  ).catch(() => null) || await SystemState.create({ key: `job:${name}`, lockedUntil: new Date(now.getTime() + leaseMs) }).catch(() => null);
  if (!lock) return null; // another instance holds the lease
  try {
    const result = await fn();
    await SystemState.updateOne({ _id: lock._id }, { lastRunAt: new Date(), lastResult: result, lastError: null, lockedUntil: null });
    return result;
  } catch (err) {
    console.error(`Job ${name} failed:`, err.message);
    await SystemState.updateOne({ _id: lock._id }, { lastRunAt: new Date(), lastError: err.message.slice(0, 500), lockedUntil: null });
    return null;
  }
}

export const JOBS = {
  'activate-memberships': { schedule: '*/15 * * * *', fn: tasks.activateScheduledMemberships },
  'expire-memberships': { schedule: '5 * * * *', fn: tasks.expireMemberships },
  'expiry-reminders': { schedule: '0 10 * * *', fn: tasks.sendExpiryReminders }, // 10:00 gym time
  'complete-sessions': { schedule: '20 * * * *', fn: tasks.completePastSessions },
  'purge-unverified': { schedule: '30 3 * * *', fn: tasks.purgeUnverified },
};

export function startScheduler() {
  if (env.DISABLE_JOBS) {
    console.log('Scheduled jobs disabled on this instance (DISABLE_JOBS=true)');
    return;
  }
  for (const [name, job] of Object.entries(JOBS)) {
    cron.schedule(job.schedule, () => runLocked(name, job.fn), { timezone: env.GYM_TIMEZONE });
  }
  console.log(`Scheduled ${Object.keys(JOBS).length} background jobs (${env.GYM_TIMEZONE})`);
}

export { runLocked };
