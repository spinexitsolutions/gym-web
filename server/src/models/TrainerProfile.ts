import { Schema, model, type InferSchemaType } from 'mongoose';

const availabilitySchema = new Schema(
  {
    /** 0 = Sunday … 6 = Saturday */
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false },
);

const trainerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    displayName: { type: String, required: true, maxlength: 100 },
    title: { type: String, maxlength: 100 },
    bio: { type: String, maxlength: 3000 },
    specializations: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 70, default: 0 },
    photoUrl: { type: String, maxlength: 1000 },
    instagram: { type: String, maxlength: 300 },
    showOnWebsite: { type: Boolean, default: true },
    order: { type: Number, default: 50 },
    availability: { type: [availabilitySchema], default: [] },
    ptSessionMinutes: { type: Number, min: 15, max: 240, default: 60 },
    maxClients: { type: Number, min: 0, max: 500, default: 30 },
  },
  { timestamps: true },
);

export type TrainerProfile = InferSchemaType<typeof trainerProfileSchema>;
export const TrainerProfileModel = model('TrainerProfile', trainerProfileSchema);
