import { describe, expect, it } from 'vitest';
import { JobStateModel, NotificationModel, BookingModel, GymClassModel } from '../src/models';
import { runJob } from '../src/jobs/runner';
import { closePastBookings, sendExpiryReminders } from '../src/jobs/tasks';
import { grantMembership } from '../src/services/membership.service';
import { sentEmails } from '../src/services/email.service';
import { createPlan, createUser } from './helpers';

describe('scheduled jobs', () => {
  it('sends each expiry reminder once, even when the job runs repeatedly', async () => {
    const user = await createUser('member');
    const plan = await createPlan({ durationDays: 30 });
    // Ends in ~2.5 days → inside the 3-day reminder window.
    await grantMembership({ userId: user._id, planId: plan._id, mode: 'new', source: 'admin', startDate: new Date(Date.now() - 27.5 * 86400000) });
    const first = await sendExpiryReminders();
    const second = await sendExpiryReminders();
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(await NotificationModel.countDocuments({ user: user._id, type: 'membership' })).toBe(1);
    expect(sentEmails.filter((e) => e.to === user.email)).toHaveLength(1);
  });

  it('skips the reminder when a renewal is already queued', async () => {
    const user = await createUser('member');
    const plan = await createPlan({ durationDays: 30 });
    await grantMembership({ userId: user._id, planId: plan._id, mode: 'new', source: 'admin', startDate: new Date(Date.now() - 27.5 * 86400000) });
    await grantMembership({ userId: user._id, planId: plan._id, mode: 'renewal', source: 'admin' });
    expect((await sendExpiryReminders()).sent).toBe(0);
  });

  it('only one instance runs a job at a time (lease lock) and failures are recorded', async () => {
    let calls = 0;
    const slow = () => new Promise((r) => setTimeout(() => r(++calls), 150));
    const [a, b] = await Promise.all([runJob('lock-test', 60_000, slow), runJob('lock-test', 60_000, slow)]);
    expect([a.ran, b.ran].filter(Boolean)).toHaveLength(1);
    expect(calls).toBe(1);
    const failed = await runJob('boom', 60_000, async () => {
      throw new Error('kaput');
    });
    expect(failed.error).toBe('kaput');
    expect(await JobStateModel.findOne({ name: 'boom' }).lean()).toMatchObject({ lastStatus: 'error', lastError: 'kaput' });
  });

  it('closes stale bookings as no-show / cancelled waitlist', async () => {
    const user = await createUser('member');
    const startsAt = new Date(Date.now() - 2 * 86400000);
    const cls = await GymClassModel.create({ title: 'Old', startsAt, endsAt: new Date(startsAt.getTime() + 3600000), capacity: 5 });
    await BookingModel.create({ type: 'class', user: user._id, gymClass: cls._id, startsAt, endsAt: cls.endsAt, status: 'confirmed', active: true });
    const r = await closePastBookings();
    expect(r.closed).toBe(1);
    expect(await BookingModel.findOne({ user: user._id }).lean()).toMatchObject({ status: 'no_show', active: false });
  });
});
