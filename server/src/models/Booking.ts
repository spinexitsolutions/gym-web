import { Schema, model, type InferSchemaType } from 'mongoose';

export const BOOKING_STATUSES = ['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show'] as const;
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'waitlisted'] as const;

const bookingSchema = new Schema(
  {
    type: { type: String, enum: ['class', 'personal_training', 'trial'], required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    /** For public trial requests from visitors without an account. */
    guest: {
      name: { type: String, maxlength: 100 },
      email: { type: String, maxlength: 254, lowercase: true },
      phone: { type: String, maxlength: 30 },
    },
    gymClass: { type: Schema.Types.ObjectId, ref: 'GymClass', index: true },
    trainer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    /** True while pending/confirmed/waitlisted. Used by partial unique indexes to block duplicates. */
    active: { type: Boolean, default: true },
    waitlistedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, maxlength: 300 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rescheduledFrom: { type: Schema.Types.ObjectId, ref: 'Booking' },
    notes: { type: String, maxlength: 1000 },
    goal: { type: String, maxlength: 200 },
    reminderSentAt: Date,
  },
  { timestamps: true },
);
bookingSchema.index({ user: 1, gymClass: 1 }, { unique: true, partialFilterExpression: { active: true, type: 'class' } });
bookingSchema.index({ trainer: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { active: true, type: 'personal_training' } });
bookingSchema.index({ gymClass: 1, status: 1, waitlistedAt: 1 });
bookingSchema.index({ startsAt: 1, status: 1 });

export type Booking = InferSchemaType<typeof bookingSchema>;
export const BookingModel = model('Booking', bookingSchema);
