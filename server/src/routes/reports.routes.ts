import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../services/audit.service';
import * as reports from '../services/report.service';
import { sendCsv } from '../utils/csv';
import { addDays } from '../utils/dates';
import { asyncHandler, ok } from '../utils/http';

const r = Router();
r.use(requireAuth, requirePermission('reports:read'));

const range = z.object({
  from: z.coerce.date().default(() => addDays(new Date(), -90)),
  to: z.coerce.date().default(() => new Date()),
  interval: z.enum(['day', 'week', 'month']).default('day'),
  format: z.enum(['json', 'csv']).default('json'),
});

r.get('/overview', asyncHandler(async (_req, res) => ok(res, await reports.overview())));

r.get(
  '/registrations',
  validate({ query: range }),
  asyncHandler(async (req, res) => {
    const { from, to, interval, format } = res.locals.query as z.infer<typeof range>;
    const rows = await reports.registrations(from, to, interval);
    if (format === 'csv') {
      await audit(req, { action: 'report.export', entity: 'Report', summary: 'registrations' });
      return sendCsv(res, 'registrations.csv', ['period', 'registrations'], rows.map((x) => [x.period, x.count]));
    }
    ok(res, rows);
  }),
);

r.get(
  '/revenue',
  validate({ query: range }),
  asyncHandler(async (req, res) => {
    const { from, to, interval, format } = res.locals.query as z.infer<typeof range>;
    const rows = await reports.revenue(from, to, interval);
    if (format === 'csv') {
      await audit(req, { action: 'report.export', entity: 'Report', summary: 'revenue' });
      return sendCsv(res, 'revenue.csv', ['period', 'gross_inr', 'refunds_inr', 'net_inr', 'online_inr', 'offline_inr', 'payments'], rows.map((x) => [x.period, x.grossMinor / 100, x.refundsMinor / 100, x.netMinor / 100, x.onlineMinor / 100, x.offlineMinor / 100, x.payments]));
    }
    ok(res, rows);
  }),
);

r.get(
  '/plans',
  validate({ query: range }),
  asyncHandler(async (req, res) => {
    const { from, to, format } = res.locals.query as z.infer<typeof range>;
    const rows = await reports.planPerformance(from, to);
    if (format === 'csv') {
      await audit(req, { action: 'report.export', entity: 'Report', summary: 'plans' });
      return sendCsv(res, 'plan-performance.csv', ['plan', 'sales', 'revenue_inr', 'active_memberships'], rows.map((x) => [x.planName, x.sales, x.revenueMinor / 100, x.activeMemberships]));
    }
    ok(res, rows);
  }),
);

r.get('/memberships', asyncHandler(async (_req, res) => ok(res, await reports.membershipBreakdown())));

r.get(
  '/bookings',
  validate({ query: range }),
  asyncHandler(async (req, res) => {
    const { from, to, interval, format } = res.locals.query as z.infer<typeof range>;
    const data = await reports.bookingSummary(from, to, interval);
    if (format === 'csv') {
      await audit(req, { action: 'report.export', entity: 'Report', summary: 'attendance' });
      return sendCsv(res, 'attendance.csv', ['period', 'check_ins'], data.attendance.map((x) => [x.period, x.count]));
    }
    ok(res, data);
  }),
);

export default r;
