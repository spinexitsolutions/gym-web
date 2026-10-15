import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAGE_STATUSES } from '@apex/shared';

const seo = {
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  noIndex: { type: Boolean, default: false },
};

/**
 * A CMS page. `draft` is the editable working copy; the public site only ever reads
 * the PageVersion referenced by `publishedVersion`.
 */
const pageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    isHome: { type: Boolean, default: false },
    /** System pages (home) cannot be deleted or have their slug changed. */
    system: { type: Boolean, default: false },
    status: { type: String, enum: PAGE_STATUSES, default: 'draft', index: true },
    draft: {
      title: { type: String, required: true },
      seo,
      featuredImage: { type: String, default: '' },
      sections: { type: [Schema.Types.Mixed], default: [] },
    },
    showInNav: { type: Boolean, default: false },
    navOrder: { type: Number, default: 50 },
    publishedVersion: { type: Schema.Types.ObjectId, ref: 'PageVersion' },
    publishedVersionNumber: { type: Number, default: 0 },
    publishedAt: Date,
    hasUnpublishedChanges: { type: Boolean, default: true },
    draftUpdatedAt: Date,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

export type Page = InferSchemaType<typeof pageSchema>;
export const PageModel = model('Page', pageSchema);
