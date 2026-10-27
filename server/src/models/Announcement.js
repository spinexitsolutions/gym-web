import mongoose from 'mongoose';
import { PUBLISH_STATUS } from './_shared.js';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 3000 },
    audience: { type: String, enum: ['public', 'members', 'staff'], default: 'members' },
    showAsBanner: { type: Boolean, default: false }, // promotional banner on the public site
    link: { label: String, href: String },
    sendEmail: { type: Boolean, default: false },
    startsAt: Date,
    endsAt: Date,
    status: { type: String, enum: PUBLISH_STATUS, default: 'draft' },
    deliveredAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

announcementSchema.index({ status: 1, audience: 1, startsAt: 1, endsAt: 1 });

export default mongoose.model('Announcement', announcementSchema);
