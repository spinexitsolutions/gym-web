import { Booking, ClassSchedule, Trainer, Membership } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { gymDay, gymLocalToUtc, dayOfWeek, minutesOf, hhmmOf, addDays } from '../utils/dates.js';
import { currentMembership } from './membership.service.js';
import { notify } from './notification.service.js';

const MIN_LEAD_MS = 60 * 60 * 1000; // PT sessions must be booked at least 1 hour ahead

export async function requireActiveMembership(userId) {
  const m = await currentMembership(userId);
  if (!m) throw ApiError.forbidden('An active membership is required to book sessions');
  return m;
}

const overlapQuery = (start, end) => ({ startAt: { $lt: end }, endAt: { $gt: start } });

// Free personal-training slots for a trainer on a gym-local day (YYYY-MM-DD).
export async function trainerSlots(trainer, day, { excludeBookingId } = {}) {
  const dow = dayOfWeek(day);
  const windows = trainer.availability.filter((a) => a.dayOfWeek === dow);
  if (!windows.length) return [];
  const duration = trainer.sessionDurationMin || 60;
  const candidates = [];
  for (const w of windows) {
    for (let m = minutesOf(w.start); m + duration <= minutesOf(w.end); m += duration) {
      const startAt = gymLocalToUtc(day, hhmmOf(m));
      candidates.push({ startAt, endAt: new Date(startAt.getTime() + duration * 60000), time: hhmmOf(m) });
    }
  }
  if (!candidates.length) return [];
  const dayStart = candidates[0].startAt;
  const dayEnd = candidates.at(-1).endAt;
  const [bookings, classes] = await Promise.all([
    Booking.find({ trainer: trainer._id, status: 'booked', ...overlapQuery(dayStart, dayEnd), ...(excludeBookingId && { _id: { $ne: excludeBookingId } }) }).select('startAt endAt').lean(),
    ClassSchedule.find({ trainer: trainer._id, status: 'scheduled', ...overlapQuery(dayStart, dayEnd) }).select('startAt endAt').lean(),
  ]);
  const busy = [...bookings, ...classes];
  const earliest = Date.now() + MIN_LEAD_MS;
  return candidates.map((c) => ({
    ...c,
    available: c.startAt.getTime() >= earliest && !busy.some((b) => b.startAt < c.endAt && b.endAt > c.startAt),
  }));
}

async function assertNoMemberOverlap(memberId, startAt, endAt, excludeId) {
  const clash = await Booking.exists({ member: memberId, status: 'booked', ...overlapQuery(startAt, endAt), ...(excludeId && { _id: { $ne: excludeId } }) });
  if (clash) throw ApiError.conflict('You already have a session booked at this time');
}

async function ptCountThisMonth(memberId, startAt) {
  const month = gymDay(startAt).slice(0, 7);
  const from = gymLocalToUtc(`${month}-01`, '00:00');
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const to = gymLocalToUtc(next, '00:00');
  return Booking.countDocuments({ member: memberId, type: 'personal_training', status: { $in: ['booked', 'completed', 'no_show'] }, startAt: { $gte: from, $lt: to } });
}

async function loadSlot(trainerId, startAt, excludeBookingId) {
  const trainer = await Trainer.findOne({ _id: trainerId, isActive: true });
  if (!trainer) throw ApiError.notFound('Trainer not found');
  const slots = await trainerSlots(trainer, gymDay(startAt), { excludeBookingId });
  const slot = slots.find((s) => s.startAt.getTime() === new Date(startAt).getTime());
  if (!slot) throw ApiError.badRequest('This time is outside the trainer’s availability');
  if (!slot.available) throw ApiError.conflict('This slot is no longer available. Please choose another time.');
  return { trainer, slot };
}

const dup = (err) => err?.code === 11000;

export async function bookPersonalTraining(user, { trainerId, startAt, notes }) {
  const membership = await requireActiveMembership(user._id);
  const { trainer, slot } = await loadSlot(trainerId, startAt);
  await assertNoMemberOverlap(user._id, slot.startAt, slot.endAt);
  const limit = membership.plan?.limits?.ptSessionsPerMonth || 0;
  if (limit === 0) throw ApiError.forbidden('Your plan does not include personal training sessions. Upgrade your plan or contact the front desk.');
  if ((await ptCountThisMonth(user._id, slot.startAt)) >= limit) throw ApiError.forbidden(`You have used all ${limit} personal training sessions included this month`);

  let booking;
  try {
    booking = await Booking.create({ member: user._id, type: 'personal_training', trainer: trainer._id, startAt: slot.startAt, endAt: slot.endAt, notes });
  } catch (err) {
    if (dup(err)) throw ApiError.conflict('Someone just booked this slot. Please choose another time.');
    throw err;
  }
  if (trainer.user) await notify(trainer.user, { type: 'booking', title: 'New personal training booking', body: `${user.name} booked ${slot.time} on ${gymDay(slot.startAt)}.`, link: '/trainer/schedule' });
  await notify(user._id, { type: 'booking', title: 'Session booked', body: `Personal training with ${trainer.name} on ${gymDay(slot.startAt)} at ${slot.time}.`, link: '/dashboard/bookings' });
  return booking;
}

export async function reschedulePersonalTraining(user, booking, newStartAt) {
  if (booking.type !== 'personal_training' || booking.status !== 'booked') throw ApiError.badRequest('Only upcoming personal training sessions can be rescheduled');
  if (booking.startAt.getTime() - Date.now() < MIN_LEAD_MS) throw ApiError.badRequest('Sessions can be rescheduled up to 1 hour before they start');
  const { trainer, slot } = await loadSlot(booking.trainer, newStartAt, booking._id);
  await assertNoMemberOverlap(booking.member, slot.startAt, slot.endAt, booking._id);
  // Cancel first so the unique (trainer, startAt) index cannot block a same-trainer move.
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = user._id;
  booking.cancelReason = 'Rescheduled';
  await booking.save();
  try {
    const next = await Booking.create({ member: booking.member, type: 'personal_training', trainer: trainer._id, startAt: slot.startAt, endAt: slot.endAt, notes: booking.notes, rescheduledFrom: booking._id });
    if (trainer.user) await notify(trainer.user, { type: 'booking', title: 'Session rescheduled', body: `A session moved to ${gymDay(slot.startAt)} at ${slot.time}.`, link: '/trainer/schedule' });
    return next;
  } catch (err) {
    booking.status = 'booked'; // roll back
    booking.cancelledAt = undefined;
    booking.cancelReason = undefined;
    await booking.save();
    if (dup(err)) throw ApiError.conflict('Someone just booked this slot. Please choose another time.');
    throw err;
  }
}

function weekBounds(date) {
  const day = gymDay(date);
  const dow = (dayOfWeek(day) + 6) % 7; // Monday = 0
  const monday = gymDay(addDays(new Date(`${day}T12:00:00Z`), -dow));
  const nextMonday = gymDay(addDays(new Date(`${monday}T12:00:00Z`), 7));
  return [gymLocalToUtc(monday, '00:00'), gymLocalToUtc(nextMonday, '00:00')];
}

export async function bookClass(user, classId) {
  const membership = await requireActiveMembership(user._id);
  const cls = await ClassSchedule.findById(classId);
  if (!cls || cls.status !== 'scheduled') throw ApiError.notFound('Class not found');
  if (cls.startAt <= new Date()) throw ApiError.badRequest('This class has already started');
  if (cls.eligiblePlans?.length && !cls.eligiblePlans.some((p) => String(p) === String(membership.plan._id))) {
    throw ApiError.forbidden('This class is not included in your plan');
  }
  const existing = await Booking.findOne({ member: user._id, classSchedule: cls._id, status: { $in: ['booked', 'waitlisted'] } });
  if (existing) throw ApiError.conflict(existing.status === 'waitlisted' ? 'You are already on the waitlist' : 'You have already booked this class');
  await assertNoMemberOverlap(user._id, cls.startAt, cls.endAt);
  const weekly = membership.plan?.limits?.classesPerWeek || 0;
  if (weekly > 0) {
    const [from, to] = weekBounds(cls.startAt);
    const used = await Booking.countDocuments({ member: user._id, type: 'class', status: { $in: ['booked', 'completed'] }, startAt: { $gte: from, $lt: to } });
    if (used >= weekly) throw ApiError.forbidden(`Your plan includes ${weekly} classes per week and you have booked them all`);
  }

  // Atomic seat reservation: only succeeds while bookedCount < capacity.
  const seat = await ClassSchedule.findOneAndUpdate(
    { _id: cls._id, status: 'scheduled', $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } },
    { new: true },
  );
  const base = { member: user._id, type: 'class', classSchedule: cls._id, trainer: cls.trainer, startAt: cls.startAt, endAt: cls.endAt };
  if (seat) {
    try {
      const b = await Booking.create({ ...base, status: 'booked' });
      await notify(user._id, { type: 'booking', title: 'Class booked', body: `${cls.title} on ${gymDay(cls.startAt)}.`, link: '/dashboard/bookings' });
      return b;
    } catch (err) {
      await ClassSchedule.updateOne({ _id: cls._id }, { $inc: { bookedCount: -1 } });
      if (dup(err)) throw ApiError.conflict('You have already booked this class');
      throw err;
    }
  }
  const waiting = await Booking.countDocuments({ classSchedule: cls._id, status: 'waitlisted' });
  if (waiting >= cls.waitlistLimit) throw ApiError.conflict('This class and its waitlist are full');
  try {
    const b = await Booking.create({ ...base, status: 'waitlisted', waitlistedAt: new Date() });
    await notify(user._id, { type: 'booking', title: 'Added to waitlist', body: `${cls.title} is full — you are #${waiting + 1} on the waitlist. We will notify you if a spot opens.`, link: '/dashboard/bookings' });
    return b;
  } catch (err) {
    if (dup(err)) throw ApiError.conflict('You are already on the waitlist');
    throw err;
  }
}

// Fill freed seats from the waitlist in order. Safe under concurrency (atomic updates on both documents).
export async function promoteWaitlist(classId) {
  const cls = await ClassSchedule.findById(classId);
  if (!cls || cls.status !== 'scheduled' || cls.startAt <= new Date()) return;
  for (;;) {
    const seat = await ClassSchedule.findOneAndUpdate(
      { _id: classId, $expr: { $lt: ['$bookedCount', '$capacity'] } }, { $inc: { bookedCount: 1 } }, { new: true },
    );
    if (!seat) return;
    const next = await Booking.findOneAndUpdate(
      { classSchedule: classId, status: 'waitlisted' }, { status: 'booked', $unset: { waitlistedAt: 1 } }, { sort: { waitlistedAt: 1 }, new: true },
    );
    if (!next) { await ClassSchedule.updateOne({ _id: classId }, { $inc: { bookedCount: -1 } }); return; }
    await notify(next.member, { type: 'booking', title: 'You’re in! Spot confirmed', email: true, body: `A spot opened in ${cls.title} on ${gymDay(cls.startAt)} and your booking is confirmed.`, link: '/dashboard/bookings' });
  }
}

export async function cancelBooking(booking, byUser, reason) {
  if (!['booked', 'waitlisted'].includes(booking.status)) throw ApiError.badRequest('This booking cannot be cancelled');
  const wasBooked = booking.status === 'booked';
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = byUser._id;
  booking.cancelReason = reason;
  await booking.save();
  if (booking.type === 'class' && wasBooked) {
    await ClassSchedule.updateOne({ _id: booking.classSchedule, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    await promoteWaitlist(booking.classSchedule);
  }
  const byStaff = String(byUser._id) !== String(booking.member);
  if (byStaff) await notify(booking.member, { type: 'booking', title: 'Booking cancelled', email: true, body: reason || 'Your booking was cancelled by the club.', link: '/dashboard/bookings' });
  if (booking.type === 'personal_training') {
    const trainer = await Trainer.findById(booking.trainer).select('user');
    if (trainer?.user && String(trainer.user) !== String(byUser._id)) {
      await notify(trainer.user, { type: 'booking', title: 'Session cancelled', body: `A session on ${gymDay(booking.startAt)} was cancelled.`, link: '/trainer/schedule' });
    }
  }
  return booking;
}

export async function cancelClass(cls, byUser, reason) {
  cls.status = 'cancelled';
  await cls.save();
  const bookings = await Booking.find({ classSchedule: cls._id, status: { $in: ['booked', 'waitlisted'] } });
  await Booking.updateMany({ _id: { $in: bookings.map((b) => b._id) } }, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: byUser._id, cancelReason: reason || 'Class cancelled' });
  await notify(bookings.map((b) => b.member), { type: 'booking', email: true, title: `${cls.title} cancelled`, body: `The class on ${gymDay(cls.startAt)} has been cancelled. ${reason || ''}`.trim(), link: '/dashboard/bookings' });
  return bookings.length;
}

export async function rescheduleClass(cls, { startAt, endAt }) {
  const affected = await Booking.find({ classSchedule: cls._id, status: { $in: ['booked', 'waitlisted'] } }).select('member');
  await Booking.updateMany({ classSchedule: cls._id, status: { $in: ['booked', 'waitlisted'] } }, { startAt, endAt });
  await notify(affected.map((b) => b.member), { type: 'booking', email: true, title: `${cls.title} time changed`, body: `The class has moved to ${gymDay(startAt)}. Please check the new time in your bookings.`, link: '/dashboard/bookings' });
}

export const activeMembershipFor = (userId) => Membership.exists({ user: userId, status: 'active', endDate: { $gte: new Date() } });
