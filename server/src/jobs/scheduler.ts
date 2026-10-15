import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getSiteSettings } from '../services/settings.service';
import { runJob } from './runner';
import { tasks } from './tasks';

const schedule: { name: keyof typeof tasks; cron: string; leaseMs: number }[] = [
  { name: 'membershipStatus', cron: '*/10 * * * *', leaseMs: 5 * 60000 },
  { name: 'expireOrders', cron: '*/15 * * * *', leaseMs: 5 * 60000 },
  { name: 'classReminders', cron: '*/15 * * * *', leaseMs: 10 * 60000 },
  { name: 'expiryReminders', cron: '0 10 * * *', leaseMs: 30 * 60000 },
  { name: 'trainerFollowUps', cron: '0 8 * * *', leaseMs: 10 * 60000 },
  { name: 'closePastBookings', cron: '30 2 * * *', leaseMs: 10 * 60000 },
  { name: 'failedPaymentsDigest', cron: '0 19 * * *', leaseMs: 10 * 60000 },
];

export async function startScheduler() {
  if (!env.JOBS_ENABLED) {
    logger.info('Scheduled jobs disabled (JOBS_ENABLED=false)');
    return [];
  }
  const tz = (await getSiteSettings()).business.timezone;
  const handles = schedule.map((s) =>
    cron.schedule(s.cron, () => void runJob(s.name, s.leaseMs, tasks[s.name]), { timezone: tz, name: s.name }),
  );
  // Catch up on status changes that happened while the server was down.
  void runJob('membershipStatus', 5 * 60000, tasks.membershipStatus);
  logger.info({ jobs: schedule.map((s) => s.name), tz }, 'Scheduler started');
  return handles;
}
