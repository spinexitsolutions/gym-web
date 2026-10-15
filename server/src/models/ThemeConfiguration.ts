import { Schema, model } from 'mongoose';

/** Theme draft/published pair. Tokens validated with themeTokensSchema from @apex/shared. */
const themeConfigurationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    draft: { type: Schema.Types.Mixed, required: true },
    published: { type: Schema.Types.Mixed, required: true },
    presetId: String,
    publishedAt: Date,
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    draftUpdatedAt: Date,
    /** Last 10 published versions for rollback. */
    history: [{ _id: false, tokens: Schema.Types.Mixed, publishedAt: Date, publishedBy: { type: Schema.Types.ObjectId, ref: 'User' } }],
  },
  { timestamps: true, minimize: false },
);

export const ThemeConfigurationModel = model('ThemeConfiguration', themeConfigurationSchema);
