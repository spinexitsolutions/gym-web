import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, uploadVideo, uploadIcon, verifyFileSignature } from '../middleware/upload.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/common.js';
import { inquiryUpdateSchema } from '../validators/admin.validator.js';

const r = Router();
r.use(authenticate);
const admin = authorize('admin');
const staff = authorize('admin', 'staff');

// Website content (owner/admin). Staff may read plans/trainers/programs for front-desk work.
c.plans.mount(r, '/plans', admin, { readGuard: staff });
c.trainers.mount(r, '/trainers', admin, { readGuard: staff });
c.programs.mount(r, '/programs', admin, { readGuard: staff });
c.testimonials.mount(r, '/testimonials', admin);
c.gallery.mount(r, '/gallery', admin);
c.faqs.mount(r, '/faqs', admin);
c.events.mount(r, '/events', admin, { readGuard: staff });
c.announcements.mount(r, '/announcements', admin);
c.blog.mount(r, '/blog', admin);
c.coupons.mount(r, '/coupons', admin);

r.post('/announcements/:id/deliver', admin, validate({ params: idParam }), h(c.deliverAnnouncement));
r.post('/events/:id/scores', staff, validate({ params: idParam, body: c.scoreSchema }), h(c.setScore));

// Media uploads → Cloudinary
r.post('/media/image', admin, uploadImage, verifyFileSignature, validate({ query: c.mediaQuery }), h(c.uploadMedia));
r.post('/media/video', admin, uploadVideo, verifyFileSignature, validate({ query: c.mediaQuery }), h(c.uploadMedia));
r.post('/media/icon', admin, uploadIcon, validate({ query: c.mediaQuery }), h(c.uploadMedia));
r.delete('/media', admin, validate({ body: z.object({ publicId: z.string().max(300), resourceType: z.enum(['image', 'video']).default('image') }) }), h(c.deleteMedia));

// Inquiries
r.get('/inquiries', staff, validate({ query: c.inquiryListSchema }), h(c.listInquiries));
r.patch('/inquiries/:id', staff, validate({ params: idParam, body: inquiryUpdateSchema }), h(c.updateInquiry));

// Team
r.get('/staff', admin, h(c.listStaff));
r.post('/staff', admin, validate({ body: c.staffCreateSchema }), h(c.createStaff));
r.patch('/staff/:id', admin, validate({ params: idParam, body: c.staffUpdateSchema }), h(c.updateStaff));

// Reviews
r.get('/reviews', admin, validate({ query: z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() }) }), h(c.listReviews));
r.patch('/reviews/:id', admin, validate({ params: idParam, body: z.object({ status: z.enum(['approved', 'rejected']) }) }), h(c.moderateReview));

// Audit, newsletter, system
r.get('/audit', admin, validate({ query: c.auditQuery }), h(c.listAudit));
r.get('/newsletter', admin, h(c.listSubscribers));
r.get('/newsletter.csv', admin, h(c.listSubscribers));
r.get('/system', admin, h(c.systemStatus));

export default r;
