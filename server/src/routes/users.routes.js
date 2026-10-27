import { Router } from 'express';
import * as c from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, verifyFileSignature } from '../middleware/upload.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { updateMeSchema, updateProfileSchema, changePasswordSchema, deletionRequestSchema } from '../validators/user.validator.js';

const r = Router();
r.use(authenticate);

r.patch('/me', validate({ body: updateMeSchema }), h(c.updateMe));
r.get('/me/profile', h(c.getProfile));
r.patch('/me/profile', validate({ body: updateProfileSchema }), h(c.updateProfile));
r.post('/me/avatar', uploadImage, verifyFileSignature, h(c.uploadAvatar));
r.delete('/me/avatar', h(c.removeAvatar));
r.post('/me/password', authLimiter, validate({ body: changePasswordSchema }), h(c.changePassword));
r.post('/me/deletion-request', validate({ body: deletionRequestSchema }), h(c.requestDeletion));
r.delete('/me/deletion-request', h(c.cancelDeletion));

export default r;
