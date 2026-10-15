import { Schema, model, type InferSchemaType } from 'mongoose';

/** Private progress photos. Served only through authenticated, ownership-checked endpoints. */
const progressPhotoSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    asset: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
    takenAt: { type: Date, required: true },
    pose: { type: String, enum: ['front', 'side', 'back', 'other'], default: 'front' },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

export type ProgressPhoto = InferSchemaType<typeof progressPhotoSchema>;
export const ProgressPhotoModel = model('ProgressPhoto', progressPhotoSchema);
