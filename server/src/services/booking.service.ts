import type { Types } from 'mongoose';
import { withTransaction } from '../config/db';
import { hasPermission, type AuthUser } from '../middleware/auth';
import { AttendanceModel, BookingModel, GymClassModel, LoyaltyTransactionModel, MemberProfileModel, MembershipPlanModel, TrainerProfileModel, UserModel } from '../models';
import { AppError } from '../utils/AppError';
import { addMinutes, dayKey, formatGymTime, hhmmToMinutes, zonedParts } from '../utils/dates';
import { getActiveMembership } from './membership.service';
import { notifyAdmins, notifyLater } from './notification.service';
import { getSiteSettings, gymTimeZone } from './settings.service';

const ACTIVE = ['pending', 'confirmed', 'waitlisted'];

async function assertMemberCanBook(userId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership) throw new AppError(403, 'MEMBERSHIP_REQUIRED', 'An active membership is required to book. View plans to get started.');
  const settings = await getSiteSettings();
  const activeCount = await BookingModel.countDocuments({ user: userId, active: true, startsAt: { $gt: new Date() } });
  if (activeCount >= settings.bookings.maxActiveBookingsPerMember) {
    throw AppError.conflict(`You can hold up to ${settings.bookings.maxActiveBookingsPerMember} upcoming bookings at a time.`);
  }
  return { membership, settings };
}

/** Enforces the plan's weekly class allowance (ISO week, Monday start). */
async function assertWeeklyAllowance(userId: string, planId: Types.ObjectId, classStart: Date) {
  const plan = await MembershipPlanModel.findById(planId).select('limits').lean();
  const limit = plan?.limits?.classesPerWeek;
  if (limit === null || limit === undefined) return;
  const d = new Date(classStart);
  const day = (d.getUTCDay() + 6) % 7;
  const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const used = await BookingModel.countDocuments({ user: userId, type: 'class', status: { $in: ['confirmed', 'attended'] }, startsAt: { $gte: weekStart, $lt: weekEnd } });
  if (used >= limit) throw AppError.conflict(`Your plan includes ${limit} classes per week. You've reached this week's allowance.`);
}

export async function bookClass(userId: string, classId: string) {
  const { membership, settings } = await assertMemberCanBook(userId);
  const gymClass = await GymClassModel.findById(classId);
  if (!gymClass || gymClass.status !== 'scheduled') throw AppError.notFound('Class');
  if (gymClass.startsAt <= new Date()) throw AppError.conflict('This class has already started');
  if (membership.endDate < gymClass.startsAt) throw AppError.conflict('Your membership ends before this class. Renew to book it.');
  await assertWeeklyAllowance(userId, membership.plan, gymClass.startsAt);

  return withTransaction(async (session) => {
    let booking;
    try {
      [booking] = await BookingModel.create(
        [{ type: 'class', user: userId, gymClass: gymClass._id, trainer: gymClass.trainer, startsAt: gymClass.startsAt, endsAt: gymClass.endsAt, status: 'pending', active: true }],
        { session },
      );
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw AppError.conflict('You have already booked this class');
      throw err;
    }
    // Atomic seat claim: succeeds only while bookedCount < capacity.
    const seat = await GymClassModel.findOneAndUpdate(
      { _id: gymClass._id, status: 'scheduled', $expr: { $lt: ['$bookedCount', '$capacity'] } },
      { $inc: { bookedCount: 1 } },
      { new: true, session },
    );
    if (seat) {
      booking.status = 'confirmed';
    } else if (settings.bookings.allowWaitlist) {
      await GymClassModel.updateOne({ _id: gymClass._id }, { $inc: { waitlistCount: 1 } }, { session });
      booking.status = 'waitlisted';
      booking.waitlistedAt = new Date();
    } else {
      await BookingModel.deleteOne({ _id: booking._id }, { session });
      throw AppError.conflict('This class is full');
    }
    await booking.save({ session });
    notifyLater({
      userId,
      type: 'booking',
      title: booking.status === 'confirmed' ? `Booked: ${gymClass.title}` : `Waitlisted: ${gymClass.title}`,
      body:
        booking.status === 'confirmed'
          ? `You're booked for ${gymClass.title} on ${formatGymTime(gymClass.startsAt, gymTimeZone())}.`
          : `The class is full. You're on the waitlist and will be notified if a spot opens.`,
      link: '/member/bookings',
      dedupeKey: `booking:${booking._id}:${booking.status}`,
    });
    return booking;
  });
}

/** Promotes the earliest waitlisted booking into a freed seat. */
async function promoteFromWaitlist(classId: Types.ObjectId) {
  const next = await BookingModel.findOne({ gymClass: classId, status: 'waitlisted', active: true }).sort({ waitlistedAt: 1 });
  if (!next) return null;
  const seat = await GymClassModel.findOneAndUpdate(
    { _id: classId, $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1, waitlistCount: -1 } },
    { new: true },
  );
  if (!seat) return null;
  const promoted = await BookingModel.findOneAndUpdate({ _id: next._id, status: 'waitlisted' }, { $set: { status: 'confirmed' } }, { new: true });
  if (!promoted) {
    await GymClassModel.updateOne({ _id: classId }, { $inc: { bookedCount: -1, waitlistCount: 1 } });
    return null;
  }
  notifyLater({
    userId: promoted.user!,
    type: 'booking',
    title: `A spot opened in ${seat.title}`,
    body: `You've been moved from the waitlist and are now booked for ${seat.title}.`,
    link: '/member/bookings',
    dedupeKey: `booking:${promoted._id}:promoted`,
    whatsapp: true,
  });
  return promoted;
}

export async function cancelBooking(viewer: AuthUser, bookingId: string, reason?: string) {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking');
  const isOwner = booking.user && String(booking.user) === viewer.id;
  const isTrainer = viewer.role === 'trainer' && booking.trainer && String(booking.trainer) === viewer.id;
  const isStaff = hasPermission(viewer, 'classes:write');
  if (!isOwner && !isTrainer && !isStaff) throw AppError.notFound('Booking');
  if (!booking.active) throw AppError.conflict('This booking is no longer active');
  if (isOwner && !isStaff && booking.status === 'confirmed') {
    const settings = await getSiteSettings();
    const cutoff = addMinutes(new Date(), settings.bookings.cancellationWindowHours * 60);
    if (booking.startsAt < cutoff) {
      throw AppError.conflict(`Bookings can be cancelled up to ${settings.bookings.cancellationWindowHours} hours before the start time.`);
    }
  }
  const prevStatus = booking.status;
  const updated = await BookingModel.findOneAndUpdate(
    { _id: booking._id, active: true },
    { $set: { status: 'cancelled', active: false, cancelledAt: new Date(), cancelReason: reason, cancelledBy: viewer.id } },
    { new: true },
  );
  if (!updated) throw AppError.conflict('This booking is no longer active');
  if (booking.type === 'class' && booking.gymClass) {
    if (prevStatus === 'confirmed') {
      await GymClassModel.updateOne({ _id: booking.gymClass, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
      await promoteFromWaitlist(booking.gymClass);
    } else if (prevStatus === 'waitlisted') {
      await GymClassModel.updateOne({ _id: booking.gymClass, waitlistCount: { $gt: 0 } }, { $inc: { waitlistCount: -1 } });
    }
  }
  if (!isOwner && booking.user) {
    notifyLater({ userId: booking.user, type: 'booking', title: 'Booking cancelled', body: `Your booking on ${formatGymTime(booking.startsAt, gymTimeZone())} was cancelled${reason ? `: ${reason}` : '.'}`, link: '/member/bookings', dedupeKey: `booking:${booking._id}:cancelled` });
  }
  return updated;
}

export async function rescheduleClassBooking(viewer: AuthUser, bookingId: string, newClassId: string) {
  const booking = await BookingModel.findById(bookingId);
  if (!booking || String(booking.user) !== viewer.id || booking.type !== 'class') throw AppError.notFound('Booking');
  if (!booking.active) throw AppError.conflict('This booking is no longer active');
  const settings = await getSiteSettings();
  if (booking.startsAt < addMinutes(new Date(), settings.bookings.rescheduleWindowHours * 60)) {
    throw AppError.conflict(`Bookings can be rescheduled up to ${settings.bookings.rescheduleWindowHours} hours before the start time.`);
  }
  if (String(booking.gymClass) === newClassId) throw AppError.badRequest('Choose a different class');
  const newBooking = await bookClass(viewer.id, newClassId);
  newBooking.rescheduledFrom = booking._id;
  await newBooking.save();
  await cancelBooking({ ...viewer, role: 'admin' }, bookingId, 'Rescheduled');
  return newBooking;
}

/** Personal training: validates trainer availability and prevents overlaps. */
export async function bookPersonalTraining(userId: string, input: { trainerId: string; startsAt: Date; notes?: string }) {
  await assertMemberCanBook(userId);
  const trainer = await TrainerProfileModel.findOne({ user: input.trainerId });
  const trainerUser = await UserModel.findOne({ _id: input.trainerId, role: 'trainer', status: 'active' }).select('_id').lean();
  if (!trainer || !trainerUser) throw AppError.notFound('Trainer');
  const start = new Date(input.startsAt);
  if (start <= addMinutes(new Date(), 60)) throw AppError.badRequest('Personal training must be booked at least 1 hour ahead');
  const end = addMinutes(start, trainer.ptSessionMinutes ?? 60);
  const settings = await getSiteSettings();
  const tz = settings.business.timezone;
  const s = zonedParts(start, tz);
  const e = zonedParts(end, tz);
  const fits = trainer.availability.some((a) => a.day === s.weekday && e.weekday === s.weekday && hhmmToMinutes(a.start) <= s.minutes && hhmmToMinutes(a.end) >= e.minutes);
  if (!fits) throw AppError.conflict('The trainer is not available at that time. Pick a slot within their availability.');
  const clash = await BookingModel.exists({ trainer: input.trainerId, active: true, startsAt: { $lt: end }, endsAt: { $gt: start } });
  const classClash = await GymClassModel.exists({ trainer: input.trainerId, status: 'scheduled', startsAt: { $lt: end }, endsAt: { $gt: start } });
  if (clash || classClash) throw AppError.conflict('That slot was just taken. Please choose another time.');
  try {
    const booking = await BookingModel.create({ type: 'personal_training', user: userId, trainer: input.trainerId, startsAt: start, endsAt: end, status: 'confirmed', active: true, notes: input.notes });
    notifyLater({ userId: input.trainerId, type: 'booking', title: 'New personal training session', body: `A member booked a session on ${formatGymTime(start, gymTimeZone())}.`, link: '/trainer/schedule', dedupeKey: `pt:${booking._id}:trainer` });
    notifyLater({ userId, type: 'booking', title: 'Personal training booked', body: `Your session is confirmed for ${formatGymTime(start, gymTimeZone())}.`, link: '/member/bookings', dedupeKey: `pt:${booking._id}:member` });
    return booking;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw AppError.conflict('That slot was just taken. Please choose another time.');
    throw err;
  }
}

/** Free available PT slots for a trainer on a given date (YYYY-MM-DD, gym timezone approximated as UTC offset of the date). */
export async function trainerSlots(trainerId: string, date: string) {
  const trainer = await TrainerProfileModel.findOne({ user: trainerId }).lean();
  if (!trainer) throw AppError.notFound('Trainer');
  const settings = await getSiteSettings();
  const tz = settings.business.timezone;
  const minutes = trainer.ptSessionMinutes ?? 60;
  // Determine timezone offset for that date.
  const probe = new Date(`${date}T12:00:00Z`);
  const local = zonedParts(probe, tz);
  const offsetMin = local.minutes - (12 * 60);
  const weekday = local.weekday;
  const windows = trainer.availability.filter((a) => a.day === weekday);
  const dayStartUtc = new Date(`${date}T00:00:00Z`).getTime() - offsetMin * 60000;
  const dayEndUtc = dayStartUtc + 86400000;
  const [bookings, classes] = await Promise.all([
    BookingModel.find({ trainer: trainerId, active: true, startsAt: { $lt: new Date(dayEndUtc) }, endsAt: { $gt: new Date(dayStartUtc) } }).select('startsAt endsAt').lean(),
    GymClassModel.find({ trainer: trainerId, status: 'scheduled', startsAt: { $lt: new Date(dayEndUtc) }, endsAt: { $gt: new Date(dayStartUtc) } }).select('startsAt endsAt').lean(),
  ]);
  const busy = [...bookings, ...classes].map((b) => [b.startsAt.getTime(), b.endsAt.getTime()]);
  const slots: string[] = [];
  const earliest = Date.now() + 60 * 60000;
  for (const w of windows) {
    for (let m = hhmmToMinutes(w.start); m + minutes <= hhmmToMinutes(w.end); m += minutes) {
      const s = dayStartUtc + m * 60000;
      const e = s + minutes * 60000;
      if (s < earliest) continue;
      if (busy.some(([bs, be]) => bs < e && be > s)) continue;
      slots.push(new Date(s).toISOString());
    }
  }
  return { minutes, slots };
}

export async function requestTrial(input: { name: string; email: string; phone: string; preferredDate: Date; goal?: string; programInterest?: string }) {
  const start = new Date(input.preferredDate);
  const recent = await BookingModel.exists({ type: 'trial', 'guest.email': input.email.toLowerCase(), active: true });
  if (recent) throw AppError.conflict("You already have a trial request with us. We'll be in touch shortly.");
  const booking = await BookingModel.create({
    type: 'trial',
    guest: { name: input.name, email: input.email, phone: input.phone },
    startsAt: start,
    endsAt: addMinutes(start, 60),
    status: 'pending',
    active: true,
    goal: input.goal,
    notes: input.programInterest ? `Interested in: ${input.programInterest}` : undefined,
  });
  await notifyAdmins({ type: 'booking', title: 'New free-trial request', body: `${input.name} requested a trial on ${start.toDateString()}.`, link: '/admin/bookings?type=trial', dedupeKey: `trial:${booking._id}`, email: true });
  return booking;
}

/** Marks a class/PT booking as attended or no-show; attended creates an attendance record. */
export async function markBookingAttendance(viewer: AuthUser, bookingId: string, status: 'attended' | 'no_show') {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking');
  const isTrainer = viewer.role === 'trainer' && booking.trainer && String(booking.trainer) === viewer.id;
  if (!isTrainer && !hasPermission(viewer, 'attendance:write')) throw AppError.notFound('Booking');
  if (!['confirmed', 'attended', 'no_show'].includes(booking.status)) throw AppError.conflict('Only confirmed bookings can be marked');
  if (booking.startsAt > addMinutes(new Date(), 30)) throw AppError.conflict('Attendance can be recorded from 30 minutes before the start time');
  booking.status = status;
  booking.active = false;
  await booking.save();
  if (status === 'attended' && booking.user) {
    const settings = await getSiteSettings();
    try {
      await AttendanceModel.create({ user: booking.user, day: dayKey(booking.startsAt, settings.business.timezone), checkInAt: booking.startsAt, method: 'class', gymClass: booking.gymClass ?? null, booking: booking._id, recordedBy: viewer.id });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  return booking;
}

export async function cancelClass(viewer: AuthUser, classId: string, reason: string) {
  const gymClass = await GymClassModel.findOneAndUpdate({ _id: classId, status: 'scheduled' }, { $set: { status: 'cancelled', cancelReason: reason } }, { new: true });
  if (!gymClass) throw AppError.notFound('Scheduled class');
  const bookings = await BookingModel.find({ gymClass: classId, active: true });
  await BookingModel.updateMany({ gymClass: classId, active: true }, { $set: { status: 'cancelled', active: false, cancelledAt: new Date(), cancelReason: `Class cancelled: ${reason}`, cancelledBy: viewer.id } });
  await GymClassModel.updateOne({ _id: classId }, { $set: { bookedCount: 0, waitlistCount: 0 } });
  for (const b of bookings) {
    if (b.user) notifyLater({ userId: b.user, type: 'class', title: `Cancelled: ${gymClass.title}`, body: `${gymClass.title} on ${formatGymTime(gymClass.startsAt, gymTimeZone())} has been cancelled. ${reason}`, link: '/member/bookings', dedupeKey: `class-cancel:${classId}:${b._id}`, whatsapp: true });
  }
  return { gymClass, affected: bookings.length };
}

export async function awardCheckInPoints(userId: Types.ObjectId | string, day: string) {
  const settings = await getSiteSettings();
  if (!settings.loyalty.enabled || settings.loyalty.pointsPerCheckIn <= 0) return;
  try {
    await LoyaltyTransactionModel.create({ user: userId, points: settings.loyalty.pointsPerCheckIn, reason: 'check_in', key: `checkin:${userId}:${day}`, note: `Check-in ${day}` });
    await MemberProfileModel.updateOne({ user: userId }, { $inc: { loyaltyPoints: settings.loyalty.pointsPerCheckIn } });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}

export const isActiveStatus = (s: string) => ACTIVE.includes(s);
