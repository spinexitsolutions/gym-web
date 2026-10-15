import { Schema, model, type InferSchemaType } from 'mongoose';

/** Member-submitted reviews. Shown publicly only after admin approval. */
const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    displayName: { type: String, required: true, maxlength: 100 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 120 },
    body: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    response: { type: String, maxlength: 1000 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type Review = InferSchemaType<typeof reviewSchema>;
export const ReviewModel = model('Review', reviewSchema);
