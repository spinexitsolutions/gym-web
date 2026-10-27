import mongoose from 'mongoose';

// Media stored on Cloudinary (publicId) or an external licensed URL (publicId empty).
export const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, maxlength: 1000 },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false },
);

export const PUBLISH_STATUS = ['draft', 'published'];
