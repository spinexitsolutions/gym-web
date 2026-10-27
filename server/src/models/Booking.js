import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['personal_training', 'class'], required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    classSchedule: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSchedule' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['booked', 'waitlisted', 'cancelled', 'completed', 'no_show'],
      default: 'booked',
    },
    waitlistedAt: Date,
    notes: { type: String, trim: true, maxlength: 500 },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, maxlength: 300 },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true },
);

bookingSchema.index({ member: 1, startAt: -1 });
bookingSchema.index({ trainer: 1, startAt: 1, status: 1 });
bookingSchema.index({ classSchedule: 1, status: 1, waitlistedAt: 1 });
// A member can hold only one live booking per class.
bookingSchema.index(
  { member: 1, classSchedule: 1 },
  { unique: true, partialFilterExpression: { classSchedule: { $exists: true }, status: { $in: ['booked', 'waitlisted'] } } },
);

export default mongoose.model('Booking', bookingSchema);
