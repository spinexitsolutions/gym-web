import { Schema, model, type InferSchemaType } from 'mongoose';

/** Immutable snapshot of a page at publish time. */
const pageVersionSchema = new Schema(
  {
    page: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
    version: { type: Number, required: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    seo: { type: Schema.Types.Mixed, default: {} },
    featuredImage: { type: String, default: '' },
    sections: { type: [Schema.Types.Mixed], default: [] },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true, minimize: false },
);
pageVersionSchema.index({ page: 1, version: -1 }, { unique: true });

export type PageVersion = InferSchemaType<typeof pageVersionSchema>;
export const PageVersionModel = model('PageVersion', pageVersionSchema);
