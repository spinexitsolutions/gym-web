import mongoose from 'mongoose';

// Singleton CMS document. `draft` is what admins edit; `published` is what the public site reads.
// Both are validated by validators/settings.validator.js before being written.
const websiteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    draft: { type: mongoose.Schema.Types.Mixed, default: {} },
    published: { type: mongoose.Schema.Types.Mixed, default: {} },
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    draftUpdatedAt: Date,
    draftUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

export default mongoose.model('WebsiteSettings', websiteSettingsSchema);
