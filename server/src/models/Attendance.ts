import { Schema, model, type InferSchemaType } from 'mongoose';

const attendanceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** YYYY-MM-DD in the gym's timezone. */
    day: { type: String, required: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: Date,
    method: { type: String, enum: ['qr', 'manual', 'class'], required: true },
    gymClass: { type: Schema.Types.ObjectId, ref: 'GymClass', default: null },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
// One general check-in per member per day, and one per class.
attendanceSchema.index({ user: 1, day: 1, gymClass: 1 }, { unique: true });
attendanceSchema.index({ day: 1 });
attendanceSchema.index({ checkInAt: -1 });

export type Attendance = InferSchemaType<typeof attendanceSchema>;
export const AttendanceModel = model('Attendance', attendanceSchema);
