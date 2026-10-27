import cloudinary, { cloudinaryEnabled } from '../config/cloudinary.js';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function uploadBuffer(buffer, { folder = 'misc', resourceType = 'image' } = {}) {
  if (!cloudinaryEnabled) {
    throw new ApiError(503, 'Media uploads are not configured. Set the CLOUDINARY_* variables on the server.');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
        resource_type: resourceType,
        // Cloudinary serves WebP/AVIF automatically to supporting browsers with f_auto,q_auto URLs.
        transformation: resourceType === 'image' ? [{ width: 2400, height: 2400, crop: 'limit' }] : undefined,
      },
      (err, result) => {
        if (err) return reject(new ApiError(502, `Upload failed: ${err.message}`));
        resolve({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId, resourceType = 'image') {
  if (!cloudinaryEnabled || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
}
