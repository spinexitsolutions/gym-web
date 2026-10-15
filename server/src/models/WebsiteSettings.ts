import { Schema, model } from 'mongoose';

/** Singleton documents keyed by `key` ('site'). `data` is validated with siteSettingsSchema from @apex/shared. */
const websiteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

export const WebsiteSettingsModel = model('WebsiteSettings', websiteSettingsSchema);
