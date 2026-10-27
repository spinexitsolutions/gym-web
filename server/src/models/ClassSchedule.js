import mongoose from 'mongoose';

const classScheduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutProgram' },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true },
    description: { type: String, trim: true, maxlength: 1000 },
    location: { type: String, trim: true, maxlength: 80 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    capacity: { type: Number, min: 1, max: 500, required: true },
    bookedCount: { type: Number, min: 0, default: 0 },
    waitlistLimit: { type: Number, min: 0, default: 10 },
    eligiblePlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' }],
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
    seriesId: { type: String, index: true }, // groups weekly recurring classes
  },
  { timestamps: true },
);

classScheduleSchema.index({ startAt: 1, status: 1 });
classScheduleSchema.index({ trainer: 1, startAt: 1 });

export default mongoose.model('ClassSchedule', classScheduleSchema);
