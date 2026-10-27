import {
  User, Trainer, WorkoutProgram, MembershipPlan, Testimonial, Gallery, Faq, Challenge, Announcement,
} from '../models/index.js';
import { getPublishedSettings } from '../services/settings.service.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, parsePagination, paginate } from '../utils/pagination.js';

async function liveCounts() {
  const [members, trainers, programs, transformations] = await Promise.all([
    User.countDocuments({ role: 'member', status: 'active' }),
    Trainer.countDocuments({ isActive: true }),
    WorkoutProgram.countDocuments({ isActive: true }),
    Gallery.countDocuments({ category: 'transformation', isPublished: true }),
  ]);
  return { members, trainers, programs, transformations };
}

export async function getSettings(_req, res) {
  const settings = await getPublishedSettings();
  if (settings.stats?.source === 'live') {
    const counts = await liveCounts();
    settings.stats = {
      ...settings.stats,
      items: settings.stats.items.map((it) => (it.key in counts ? { ...it, value: counts[it.key] } : it)),
    };
  }
  const now = new Date();
  const banners = await Announcement.find({
    status: 'published',
    audience: 'public',
    showAsBanner: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .select('title body link')
    .sort('-createdAt')
    .limit(3)
    .lean();
  res.set('Cache-Control', 'public, max-age=30');
  return ok(res, { ...settings, banners });
}

const PUBLIC_PLAN_FIELDS = '-__v -createdAt -updatedAt -status';

export async function listPlans(_req, res) {
  const plans = await MembershipPlan.find({ status: 'published', isActive: true }).select(PUBLIC_PLAN_FIELDS).sort('order').lean();
  return ok(res, plans);
}

export async function listTrainers(req, res) {
  const { q, specialization, featured } = req.query;
  const filter = { isActive: true };
  if (specialization) filter.specializations = new RegExp(`^${escapeRegex(specialization)}$`, 'i');
  if (featured === 'true') filter.isFeatured = true;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { title: rx }, { specializations: rx }];
  }
  const opts = parsePagination(req.query, { defaultLimit: 24, sortable: ['order', 'experienceYears', 'name'], defaultSort: 'order' });
  const { items, meta } = await paginate(Trainer, filter, opts, { select: '-user -__v' });
  const specializations = await Trainer.distinct('specializations', { isActive: true });
  return ok(res, items, { meta: { ...meta, specializations: specializations.sort() } });
}

export async function getTrainer(req, res) {
  const trainer = await Trainer.findOne({ slug: req.params.slug, isActive: true }).select('-user -__v').lean();
  if (!trainer) throw ApiError.notFound('Trainer not found');
  const programs = await WorkoutProgram.find({ trainers: trainer._id, isActive: true }).select('title slug category difficulty image').lean();
  return ok(res, { ...trainer, programs });
}

export async function listPrograms(req, res) {
  const { q, category, difficulty, featured } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (featured === 'true') filter.isFeatured = true;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const opts = parsePagination(req.query, { defaultLimit: 24, sortable: ['order', 'durationWeeks', 'title'], defaultSort: 'order' });
  const { items, meta } = await paginate(WorkoutProgram, filter, opts, {
    select: '-description -__v',
    populate: [{ path: 'trainers', select: 'name slug photo title' }, { path: 'eligiblePlans', select: 'name tier' }],
  });
  return ok(res, items, { meta });
}

export async function getProgram(req, res) {
  const program = await WorkoutProgram.findOne({ slug: req.params.slug, isActive: true })
    .populate('trainers', 'name slug photo title specializations')
    .populate('eligiblePlans', 'name slug tier')
    .lean();
  if (!program) throw ApiError.notFound('Program not found');
  return ok(res, program);
}

export async function listTestimonials(_req, res) {
  const items = await Testimonial.find({ isPublished: true }).select('-__v -consentConfirmed').sort('order').limit(24).lean();
  return ok(res, items);
}

export async function listGallery(req, res) {
  const filter = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  const items = await Gallery.find(filter).select('-__v -consentConfirmed').sort('order -createdAt').limit(req.query.limit || 30).lean();
  return ok(res, items);
}

export async function listFaqs(_req, res) {
  const items = await Faq.find({ isPublished: true }).select('question answer category').sort('order').lean();
  return ok(res, items);
}

export async function listEvents(_req, res) {
  const items = await Challenge.find({ isPublished: true, endDate: { $gte: new Date() } })
    .select('title slug kind description image location startDate endDate metric unit')
    .sort('startDate')
    .limit(12)
    .lean();
  return ok(res, items);
}
