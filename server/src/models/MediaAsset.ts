import { Schema, model, type InferSchemaType } from 'mongoose';

const mediaAssetSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'model'], required: true, index: true },
    visibility: { type: String, enum: ['public', 'private'], required: true },
    storage: { type: String, enum: ['local', 'cloudinary'], required: true },
    /** Storage key (local relative path or Cloudinary public_id). Never exposed for private assets. */
    key: { type: String, required: true },
    /** Public URL (public assets only). */
    url: { type: String, default: '' },
    variants: [{ _id: false, width: Number, url: String, key: String }],
    name: { type: String, required: true, maxlength: 160 },
    originalName: { type: String, maxlength: 255 },
    folder: { type: String, default: 'general', maxlength: 60, index: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    alt: { type: String, maxlength: 200, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** 3D model review workflow. Only approved models can be selected in scenes. */
    model: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'] },
      meshes: Number,
      materials: Number,
      triangles: Number,
      notes: { type: String, maxlength: 500 },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true },
);
mediaAssetSchema.index({ name: 'text', alt: 'text' });

export type MediaAsset = InferSchemaType<typeof mediaAssetSchema>;
export const MediaAssetModel = model('MediaAsset', mediaAssetSchema);
