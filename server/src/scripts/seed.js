/* eslint-disable no-console */
// Seeds DEMO content so the website renders out of the box. Everything created here is sample data:
//   - plans, trainers and programs are examples — edit or replace them in the admin dashboard;
//   - testimonials are flagged isDemo and display a "Sample" badge on the site;
//   - no members, payments or attendance are created, so dashboards only ever show real business data.
// Usage: npm run seed            (idempotent upsert by slug)
//        npm run seed -- --reset (removes previously seeded demo content first)
import { connectDB, disconnectDB } from '../config/db.js';
import {
  MembershipPlan, Trainer, WorkoutProgram, Testimonial, Faq, Challenge, Gallery, WebsiteSettings, Coupon,
} from '../models/index.js';
import { defaultSettings, PHOTOS } from '../services/settings.defaults.js';

const rupees = (n) => Math.round(n * 100);
const RESET = process.argv.includes('--reset');

const allDays = (start, end, days = [1, 2, 3, 4, 5]) => days.map((dayOfWeek) => ({ dayOfWeek, start, end }));

const trainers = [
  {
    name: 'Arjun Mehta', slug: 'arjun-mehta', title: 'Head of Strength', photo: PHOTOS.coach,
    bio: 'Former national-level powerlifter who has coached more than 400 members to their first bodyweight deadlift and beyond.',
    specializations: ['Strength', 'Powerlifting', 'Muscle Building'],
    qualifications: ['B.Sc. Sports Science', 'NSCA-CSCS'],
    certifications: [{ name: 'Certified Strength & Conditioning Specialist', issuer: 'NSCA', year: 2017 }],
    experienceYears: 11, languages: ['English', 'Hindi'], availability: allDays('06:00', '11:00'),
    ptPricePaise: rupees(1800), isFeatured: true, order: 1,
  },
  {
    name: 'Sara Khan', slug: 'sara-khan', title: 'Mobility & Yoga Lead', photo: PHOTOS.yoga,
    bio: 'Blends yoga, mobility and breathwork to help athletes move better and recover faster.',
    specializations: ['Yoga', 'Mobility', 'Flexibility'],
    qualifications: ['RYT-500 Yoga Alliance'],
    certifications: [{ name: 'Registered Yoga Teacher 500', issuer: 'Yoga Alliance', year: 2018 }],
    experienceYears: 8, languages: ['English', 'Hindi', 'Urdu'], availability: allDays('07:00', '12:00', [1, 3, 5, 6]),
    ptPricePaise: rupees(1500), isFeatured: true, order: 2,
  },
  {
    name: 'Vikram Rao', slug: 'vikram-rao', title: 'Performance Coach', photo: PHOTOS.pullup,
    bio: 'Specialises in athletic conditioning and HIIT for busy professionals who want maximum results in minimum time.',
    specializations: ['HIIT', 'Functional Training', 'Weight Loss'],
    qualifications: ['ACE Certified Personal Trainer', 'Precision Nutrition L1'],
    certifications: [{ name: 'ACE Personal Trainer', issuer: 'American Council on Exercise', year: 2019 }],
    experienceYears: 7, languages: ['English', 'Kannada', 'Hindi'], availability: allDays('16:00', '21:00'),
    ptPricePaise: rupees(1600), isFeatured: true, order: 3,
  },
  {
    name: 'Meera Iyer', slug: 'meera-iyer', title: 'Body Transformation Coach', photo: PHOTOS.trainerWoman,
    bio: 'Evidence-based fat-loss and body recomposition coaching with sustainable nutrition habits.',
    specializations: ['Weight Loss', 'Nutrition', 'Personal Training'],
    qualifications: ['M.Sc. Nutrition', 'NASM-CPT'],
    certifications: [{ name: 'NASM Certified Personal Trainer', issuer: 'NASM', year: 2016 }],
    experienceYears: 9, languages: ['English', 'Tamil', 'Hindi'], availability: allDays('08:00', '13:00', [2, 4, 6]),
    ptPricePaise: rupees(2000), isFeatured: true, order: 4,
  },
  {
    name: 'Rohan Das', slug: 'rohan-das', title: 'Cardio & Endurance Coach', photo: PHOTOS.cardio,
    bio: 'Marathoner and spin instructor who builds aerobic engines for runners, cyclists and beginners alike.',
    specializations: ['Cardio', 'Endurance', 'Beginner Fitness'],
    qualifications: ['ISSA Certified Fitness Trainer'],
    certifications: [{ name: 'ISSA Certified Fitness Trainer', issuer: 'ISSA', year: 2020 }],
    experienceYears: 5, languages: ['English', 'Bengali', 'Hindi'], availability: allDays('17:00', '22:00', [1, 2, 3, 4, 5, 6]),
    ptPricePaise: rupees(1200), order: 5,
  },
  {
    name: 'Ananya Sharma', slug: 'ananya-sharma', title: 'Functional Training Coach', photo: PHOTOS.kettlebell,
    bio: 'Kettlebell specialist focused on real-world strength, posture and injury prevention.',
    specializations: ['Functional Training', 'Strength', 'Beginner Fitness'],
    qualifications: ['StrongFirst SFG Level 1'],
    certifications: [{ name: 'StrongFirst Kettlebell Instructor', issuer: 'StrongFirst', year: 2021 }],
    experienceYears: 6, languages: ['English', 'Hindi'], availability: allDays('06:00', '10:00', [0, 2, 4, 6]),
    ptPricePaise: rupees(1400), order: 6,
  },
];

const tierPricing = (monthly) => [
  { period: 'monthly', pricePaise: rupees(monthly), discountPercent: 0 },
  { period: 'quarterly', pricePaise: rupees(Math.round(monthly * 3 * 0.92)), discountPercent: 8 },
  { period: 'half_yearly', pricePaise: rupees(Math.round(monthly * 6 * 0.85)), discountPercent: 15 },
  { period: 'yearly', pricePaise: rupees(Math.round(monthly * 12 * 0.75)), discountPercent: 25 },
];

const comparisonRows = (v) =>
  ['Gym floor access', 'Group classes', 'Personal training sessions', 'Steam & sauna', 'Body composition scan', 'Guest passes', 'Towel & locker service']
    .map((label, i) => ({ label, value: v[i] }));

const plans = [
  {
    name: 'Basic', slug: 'basic', tier: 'basic', tagline: 'Everything you need to train well',
    description: 'Full access to the gym floor during off-peak hours with a complimentary onboarding session.',
    benefits: ['Gym floor access (off-peak: 10 AM – 5 PM)', 'Free fitness assessment', 'Mobile app & workout tracking'],
    comparison: comparisonRows(['Off-peak', 'No', '0', 'No', 'Quarterly', '0', 'No']),
    pricing: tierPricing(2499), joiningFeePaise: rupees(1000), limits: { ptSessionsPerMonth: 0, classesPerWeek: 0, guestPassesPerMonth: 0 }, order: 1,
  },
  {
    name: 'Standard', slug: 'standard', tier: 'standard', tagline: 'Unlimited access, all day',
    description: 'All-hours access plus group classes for members who train consistently.',
    benefits: ['All-hours gym access', 'Up to 3 group classes per week', 'Monthly body composition scan'],
    comparison: comparisonRows(['All hours', '3 / week', '0', 'No', 'Monthly', '1 / month', 'No']),
    pricing: tierPricing(3999), joiningFeePaise: rupees(1000), limits: { ptSessionsPerMonth: 0, classesPerWeek: 3, guestPassesPerMonth: 1 }, order: 2,
  },
  {
    name: 'Premium', slug: 'premium', tier: 'premium', tagline: 'Coached, recovered, accountable', isFeatured: true,
    description: 'Unlimited classes, recovery suite and monthly personal training to keep you progressing.',
    benefits: ['Unlimited group classes', '4 personal training sessions / month', 'Steam, sauna & cold plunge', 'Towel & locker service'],
    comparison: comparisonRows(['All hours', 'Unlimited', '4 / month', 'Yes', 'Monthly', '2 / month', 'Yes']),
    pricing: tierPricing(6999), joiningFeePaise: rupees(0), limits: { ptSessionsPerMonth: 4, classesPerWeek: 0, guestPassesPerMonth: 2 }, order: 3,
  },
  {
    name: 'Elite', slug: 'elite', tier: 'elite', tagline: 'The complete private-club experience',
    description: 'Dedicated coach, personalised nutrition and priority booking for the highest level of support.',
    benefits: ['12 personal training sessions / month', 'Personalised nutrition plan', 'Priority class booking', 'Private locker & laundry'],
    comparison: comparisonRows(['All hours', 'Unlimited', '12 / month', 'Yes', 'Fortnightly', '4 / month', 'Yes']),
    pricing: tierPricing(12999), joiningFeePaise: rupees(0), limits: { ptSessionsPerMonth: 12, classesPerWeek: 0, guestPassesPerMonth: 4 }, order: 4,
  },
];

const programs = [
  ['Lean & Strong Fat Loss', 'weight_loss', 'beginner', 12, 4, PHOTOS.hiit, ['meera-iyer', 'vikram-rao'], ['basic', 'standard', 'premium', 'elite'],
    'A progressive fat-loss system combining strength work, conditioning and simple nutrition habits.'],
  ['Hypertrophy Blueprint', 'muscle_building', 'intermediate', 16, 5, PHOTOS.rack, ['arjun-mehta'], ['standard', 'premium', 'elite'],
    'Science-based muscle building with periodised volume, technique coaching and progress tracking.'],
  ['Foundations of Strength', 'strength', 'intermediate', 12, 3, PHOTOS.deadlift, ['arjun-mehta', 'ananya-sharma'], ['standard', 'premium', 'elite'],
    'Master the squat, bench, deadlift and overhead press with coached, data-driven progression.'],
  ['1:1 Personal Coaching', 'personal_training', 'beginner', 8, 3, PHOTOS.trainerWoman, ['meera-iyer', 'arjun-mehta'], ['premium', 'elite'],
    'Fully personalised training with a dedicated coach, weekly check-ins and adjustments.'],
  ['Athletic Functional Training', 'functional', 'intermediate', 10, 3, PHOTOS.ropes, ['ananya-sharma', 'vikram-rao'], ['standard', 'premium', 'elite'],
    'Sleds, kettlebells and bodyweight drills that build strength you can use in real life.'],
  ['Aurum HIIT 45', 'hiit', 'advanced', 6, 4, PHOTOS.hiit, ['vikram-rao'], ['standard', 'premium', 'elite'],
    'Intense 45-minute intervals designed to boost conditioning and burn calories efficiently.'],
  ['Mobility & Flow Yoga', 'yoga', 'beginner', 8, 3, PHOTOS.yoga, ['sara-khan'], ['standard', 'premium', 'elite'],
    'Improve flexibility, posture and recovery with guided yoga and mobility flows.'],
  ['Endurance Engine', 'cardio', 'intermediate', 10, 4, PHOTOS.cycling, ['rohan-das'], ['basic', 'standard', 'premium', 'elite'],
    'Build aerobic capacity with structured indoor cycling, rowing and running sessions.'],
  ['First 30 Days', 'beginner', 'beginner', 4, 3, PHOTOS.woman, ['rohan-das', 'ananya-sharma'], ['basic', 'standard', 'premium', 'elite'],
    'A guided introduction to the gym: technique, confidence and a routine you can stick to.'],
];

const testimonials = [
  { name: 'Sample member A', headline: 'Stronger at 42 than at 25', quote: 'The coaching here is on another level. Every session has a purpose and I have never felt better.', rating: 5, memberSince: '2021' },
  { name: 'Sample member B', headline: 'Found a routine that stuck', quote: 'I tried four gyms before Aurum. The difference is the people — they genuinely care about your progress.', rating: 5, memberSince: '2022' },
  { name: 'Sample member C', headline: 'Back to running pain-free', quote: 'The mobility programme fixed issues I had lived with for years. The recovery suite is a bonus.', rating: 5, memberSince: '2023' },
];

const faqs = [
  ['Can I try the gym before joining?', 'Yes. Book a complimentary guided visit from the contact page and a coach will show you around and plan your first workout.'],
  ['What are the opening hours?', 'We are open 5 AM – 11 PM on weekdays, 6 AM – 10 PM on Saturdays and 7 AM – 8 PM on Sundays. Hours are always up to date on the contact page.'],
  ['Do I need to be fit to start?', 'Not at all. Every membership includes a fitness assessment, and our First 30 Days programme is designed for complete beginners.'],
  ['How do I pay for my membership?', 'Pay securely online with UPI, cards or netbanking via Razorpay. You receive an email receipt and can download invoices from your dashboard.'],
  ['Can I freeze or cancel my membership?', 'Submit a cancellation or freeze request from your member dashboard. See the cancellation and refund policy on the memberships page for details.'],
  ['Is personal training included?', 'Premium and Elite plans include monthly personal training sessions. Other members can book sessions with any coach for an additional fee.'],
  ['How does check-in work?', 'Show the QR code in your member dashboard at the front desk. Codes refresh every minute, so they cannot be shared or reused.'],
  ['Is there parking?', 'Yes, complimentary valet parking is available for members during opening hours.'],
];

const daysFromNow = (n) => new Date(Date.now() + n * 864e5);
const events = [
  { title: '30-Day Consistency Challenge', slug: '30-day-consistency-challenge', kind: 'challenge', metric: 'attendance', unit: 'visits',
    description: 'Check in on as many days as you can in 30 days. Top three members win a month of free personal training.',
    image: PHOTOS.lifter, location: 'Whole club', startDate: daysFromNow(5), endDate: daysFromNow(35) },
  { title: 'Deadlift Clinic with Arjun', slug: 'deadlift-clinic', kind: 'event',
    description: 'A two-hour technique clinic covering setup, bracing and programming for a stronger, safer deadlift.',
    image: PHOTOS.deadlift, location: 'Strength Arena', startDate: daysFromNow(12), endDate: daysFromNow(12) },
  { title: 'Sunrise Yoga on the Terrace', slug: 'sunrise-yoga', kind: 'event',
    description: 'A calming outdoor flow followed by breakfast with the community. Open to all members and one guest.',
    image: PHOTOS.yoga, location: 'Rooftop terrace', startDate: daysFromNow(19), endDate: daysFromNow(19) },
];

const gallery = [
  ['Strength Arena', 'facility', PHOTOS.floor], ['Dumbbell bay', 'equipment', PHOTOS.dumbbells], ['Functional turf', 'facility', PHOTOS.ropes],
  ['Yoga studio', 'facility', PHOTOS.yoga], ['Cardio deck', 'facility', PHOTOS.cycling], ['Training studio', 'gym', PHOTOS.studio],
  ['Platform lifting', 'gym', PHOTOS.deadlift], ['Kettlebell zone', 'equipment', PHOTOS.kettlebell],
];

async function upsertBySlug(Model, docs) {
  for (const doc of docs) await Model.updateOne({ slug: doc.slug }, { $set: doc }, { upsert: true, runValidators: true });
}

async function main() {
  await connectDB();

  if (RESET) {
    await Promise.all([
      Testimonial.deleteMany({ isDemo: true }),
      Gallery.deleteMany({ isDemo: true }),
      Faq.deleteMany({}),
      Challenge.deleteMany({ slug: { $in: events.map((e) => e.slug) } }),
    ]);
    console.log('Removed previous demo testimonials, gallery items, FAQs and events.');
  }

  await upsertBySlug(Trainer, trainers);
  await upsertBySlug(MembershipPlan, plans.map((p) => ({ ...p, status: 'published', isActive: true })));

  const trainerIds = Object.fromEntries((await Trainer.find({}, 'slug')).map((t) => [t.slug, t._id]));
  const planIds = Object.fromEntries((await MembershipPlan.find({}, 'slug')).map((p) => [p.slug, p._id]));
  await upsertBySlug(
    WorkoutProgram,
    programs.map(([title, category, difficulty, durationWeeks, sessionsPerWeek, image, ts, ps, summary], i) => ({
      title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), category, difficulty, durationWeeks, sessionsPerWeek,
      sessionLengthMin: category === 'hiit' ? 45 : 60, image, summary,
      description: `${summary}\n\nEach week combines coached sessions with tracked homework so you always know what to do next. Your coach reviews progress every two weeks and adjusts the plan.`,
      highlights: ['Coach-reviewed progress', `${sessionsPerWeek} sessions per week`, `${durationWeeks}-week structured plan`],
      trainers: ts.map((s) => trainerIds[s]).filter(Boolean), eligiblePlans: ps.map((s) => planIds[s]).filter(Boolean),
      isFeatured: i < 6, order: i + 1, isActive: true,
    })),
  );

  if ((await Testimonial.countDocuments()) === 0) {
    await Testimonial.insertMany(testimonials.map((t, i) => ({ ...t, isDemo: true, isPublished: true, order: i })));
  }
  if ((await Faq.countDocuments()) === 0) {
    await Faq.insertMany(faqs.map(([question, answer], i) => ({ question, answer, order: i })));
  }
  await upsertBySlug(Challenge, events.map((e) => ({ ...e, isPublished: true })));
  if ((await Gallery.countDocuments({ isDemo: true })) === 0) {
    await Gallery.insertMany(gallery.map(([title, category, image], i) => ({ title, category, image, isDemo: true, order: i })));
  }

  await Coupon.updateOne(
    { code: 'WELCOME10' },
    { $setOnInsert: { code: 'WELCOME10', description: 'DEMO coupon: 10% off the first membership (max ₹2,000)', discountType: 'percent', value: 10, maxDiscountPaise: rupees(2000), perUserLimit: 1 } },
    { upsert: true },
  );

  if (!(await WebsiteSettings.exists({ key: 'site' }))) {
    await WebsiteSettings.create({ key: 'site', draft: defaultSettings, published: defaultSettings, publishedAt: new Date() });
  }

  console.log(`Seeded demo content: ${trainers.length} trainers, ${plans.length} plans, ${programs.length} programs, ${faqs.length} FAQs, ${events.length} events, gallery, sample testimonials, coupon WELCOME10.`);
  console.log('No members, payments or attendance were created. Run `npm run create-admin` to create the first admin.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
