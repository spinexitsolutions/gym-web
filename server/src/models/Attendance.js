import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // gym-local calendar day
    checkInAt: { type: Date, required: true },
    checkOutAt: Date,
    method: { type: String, enum: ['qr', 'manual', 'staff'], default: 'qr' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastTokenId: { type: String, select: false }, // last QR token used, blocks replay
    corrections: [
      {
        _id: false,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        reason: { type: String, maxlength: 300 },
        before: { checkInAt: Date, checkOutAt: Date },
        after: { checkInAt: Date, checkOutAt: Date },
      },
    ],
  },
  { timestamps: true },
);

// Duplicate check-in prevention: one attendance record per member per day.
attendanceSchema.index({ member: 1, day: 1 }, { unique: true });
attendanceSchema.index({ day: 1 });

export default mongoose.model('Attendance', attendanceSchema);
