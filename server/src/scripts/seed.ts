/**
 * Seeds demonstration website content (pages, programs, plans, classes, FAQs, articles...).
 *
 *   npm run seed                 # content only (idempotent: skips collections that already have data)
 *   npm run seed -- --reset      # wipe CMS/content collections first (refused in production)
 *   npm run seed -- --demo-accounts   # also create a demo trainer + member with random passwords (dev only)
 *
 * Member stories, testimonials and before/after items are created UNPUBLISHED as format examples:
 * the public site never presents sample data as genuine customer data. Publish real, consented
 * stories from the admin dashboard.
 */
import { SECTION_META, createSection, type DraftSection } from '@apex/shared';
import { connectDb, disconnectDb } from '../config/db';
import { isProd } from '../config/env';
import {
  BlogPostModel,
  ExerciseModel,
  FacilityModel,
  FaqModel,
  GalleryItemModel,
  GymClassModel,
  MemberProfileModel,
  MembershipPlanModel,
  PageModel,
  PageVersionModel,
  ProgramModel,
  PromotionModel,
  TestimonialModel,
  TrainerProfileModel,
  UserModel,
  WebsiteSettingsModel,
  CouponModel,
  WorkoutPlanModel,
} from '../models';
import { hashPassword } from '../services/auth.service';
import { DEFAULT_SITE_SETTINGS, getThemeDoc } from '../services/settings.service';
import { ensureMemberProfile } from '../services/member.service';
import { grantMembership } from '../services/membership.service';
import { randomToken } from '../utils/crypto';
import { addDays } from '../utils/dates';

const args = new Set(process.argv.slice(2));

async function seedIfEmpty<T>(name: string, model: { countDocuments: () => Promise<number> }, fn: () => Promise<T>) {
  if ((await model.countDocuments()) > 0) {
    console.log(`  · ${name}: already has data, skipped`);
    return;
  }
  await fn();
  console.log(`  ✓ ${name}`);
}

function homeSections(): DraftSection[] {
  const s = (type: Parameters<typeof createSection>[0], props: Record<string, unknown> = {}) => createSection(type, { ...SECTION_META[type].defaults, ...props });
  return [
    s('hero', {
      eyebrow: 'Bengaluru · Performance Club',
      headline: 'Forge the strongest version of you.',
      subheadline: 'A luxury training floor, coaches who obsess over your progress, and equipment engineered to the millimetre. This is where serious training lives.',
      scene: { modelId: 'hero-stack', autoRotate: true, animationSpeed: 1, environment: 'studio' },
    }),
    s('stats', {
      eyebrow: 'By the numbers',
      heading: 'Built on results',
      items: [
        { label: 'Active members', value: 0, suffix: '+', metric: 'activeMembers' },
        { label: 'Expert coaches', value: 0, suffix: '', metric: 'trainers' },
        { label: 'Years of coaching', value: 12, suffix: '', metric: 'manual' },
        { label: 'Weekly classes', value: 0, suffix: '', metric: 'classesThisWeek' },
      ],
    }),
    s('about', {
      eyebrow: 'The club',
      heading: 'Built for people who train with intent',
      body: 'Apex Athletics is a 14,000 sq ft performance club designed around one idea: every rep should move you forward.\n\nOur coaches program with purpose, our floor is laid out for flow, and every piece of equipment is chosen for feel and precision — from calibrated plates to competition kettlebells.',
      bullets: ['Calibrated competition equipment', 'Coaching with measurable progress', 'Recovery suite with sauna & cold plunge', 'Open 5:30 am – 10:30 pm'],
      cta: { label: 'Explore the facility', href: '#facilities', variant: 'secondary' },
      anchorId: 'about',
    }),
    s('programs', { eyebrow: 'Programs', heading: 'Train for what matters to you', subheading: 'Structured programs built by our coaching team, from first barbell to competition platform.', limit: 6, anchorId: 'programs' }),
    s('equipment3d', { eyebrow: 'Equipment', heading: 'Precision you can feel', subheading: 'Rotate, zoom and inspect the tools you will train with.' }),
    s('trainers', { eyebrow: 'Coaches', heading: 'Coaching that changes outcomes', subheading: 'Certified specialists who program, cue and track every session.', limit: 4 }),
    s('pricing', { eyebrow: 'Memberships', heading: 'Choose your commitment', subheading: 'Transparent pricing. No joining fees. Cancel according to plan terms.', highlightPlanSlug: 'performance-quarterly', anchorId: 'pricing' }),
    s('schedule', { eyebrow: 'Schedule', heading: 'This week on the floor', days: 7, limit: 12 }),
    s('transformations', { eyebrow: 'Member stories', heading: 'Transformations', limit: 3 }),
    s('testimonials', { eyebrow: 'Reviews', heading: 'What members say', limit: 6 }),
    s('beforeAfter', { eyebrow: 'Results', heading: 'Before & after', subheading: 'Shared with the explicit consent of our members.', limit: 4 }),
    s('facilities', { eyebrow: 'Facilities', heading: 'Everything you need. Nothing you don’t.', limit: 8, anchorId: 'facilities' }),
    s('bmi', { eyebrow: 'Tools', heading: 'Know your starting point', subheading: 'A quick estimate to frame your first conversation with a coach.' }),
    s('promo', {
      eyebrow: 'Founding offer',
      heading: '20% off your first month',
      body: 'Join before the end of the month and use code APEX20 at checkout.',
      cta: { label: 'Claim offer', href: '/memberships', variant: 'primary' },
      background: { variant: 'gradient', imageUrl: '', overlay: 0.6 },
    }),
    s('blog', { eyebrow: 'Journal', heading: 'Training notes', limit: 3 }),
    s('faq', { eyebrow: 'FAQ', heading: 'Questions, answered', limit: 8 }),
    s('location', { eyebrow: 'Visit', heading: 'Find the club', anchorId: 'location' }),
    s('trialForm', { eyebrow: 'Free trial', heading: 'Book a complimentary session', body: 'Tour the club, meet a coach and train a full session on us. No commitment.', successMessage: 'Request received — our team will call you within one business day to confirm a time.', anchorId: 'trial' }),
    s('contact', { eyebrow: 'Contact', heading: 'Talk to the team', body: 'Questions about memberships, corporate plans or personal training? We reply within one business day.', anchorId: 'contact' }),
    s('newsletter', { eyebrow: 'Newsletter', heading: 'Training notes, monthly', body: 'One email a month: programming insights, nutrition fundamentals and club news. Unsubscribe any time.' }),
  ];
}

async function publishSeedPage(slug: string, title: string, sections: DraftSection[], opts: { isHome?: boolean; system?: boolean; showInNav?: boolean; description?: string } = {}) {
  const page = await PageModel.create({
    slug,
    isHome: Boolean(opts.isHome),
    system: Boolean(opts.system),
    status: 'published',
    showInNav: Boolean(opts.showInNav),
    draft: { title, seo: { title: '', description: opts.description ?? '', image: '', noIndex: false }, featuredImage: '', sections },
    publishedVersionNumber: 1,
    publishedAt: new Date(),
    hasUnpublishedChanges: false,
  });
  const v = await PageVersionModel.create({ page: page._id, version: 1, slug, title, seo: page.draft!.seo, featuredImage: '', sections, note: 'Initial seed' });
  page.publishedVersion = v._id;
  await page.save();
}

async function main() {
  await connectDb();
  if (args.has('--reset')) {
    if (isProd) throw new Error('--reset is not allowed in production');
    console.log('Resetting content collections…');
    await Promise.all([PageModel, PageVersionModel, ProgramModel, FaqModel, FacilityModel, TestimonialModel, GalleryItemModel, PromotionModel, BlogPostModel, MembershipPlanModel, GymClassModel, ExerciseModel, CouponModel].map((m) => (m as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({})));
  }

  console.log('Seeding content:');
  if (!(await WebsiteSettingsModel.exists({ key: 'site' }))) {
    await WebsiteSettingsModel.create({ key: 'site', data: DEFAULT_SITE_SETTINGS });
    console.log('  ✓ site settings');
  }
  await getThemeDoc();

  await seedIfEmpty('pages', PageModel, async () => {
    await publishSeedPage('home', 'Home', homeSections(), { isHome: true, system: true, description: DEFAULT_SITE_SETTINGS.seo.description });
    await publishSeedPage('about', 'About', [
      createSection('hero', { eyebrow: 'About', headline: 'A club built around progress', subheadline: 'Founded in 2014 by competitive lifters and physiotherapists.', mediaType: 'scene', ctas: [{ label: 'Book a free trial', href: '/#trial', variant: 'primary' }], scene: { modelId: 'barbell' } }),
      createSection('imageText', { eyebrow: 'Our philosophy', heading: 'Measured, coached, progressive', body: 'We believe great training is simple: show up, do the work, track it, and adjust. Every member gets an assessment, a plan and a coach who knows their name.' }),
      createSection('cta', { heading: 'See it for yourself', body: 'Your first session is on us.', ctas: [{ label: 'Book a free trial', href: '/#trial', variant: 'primary' }] }),
    ], { showInNav: true });
    const legal = (t: string) => createSection('richText', { heading: t, body: `This ${t.toLowerCase()} is a placeholder. Replace it with your own reviewed legal text from **CMS → Pages** before launch.` });
    await publishSeedPage('privacy', 'Privacy Policy', [legal('Privacy Policy')]);
    await publishSeedPage('terms', 'Terms & Conditions', [legal('Terms & Conditions')]);
  });

  await seedIfEmpty('programs', ProgramModel, () =>
    ProgramModel.insertMany([
      { title: 'Strength Foundations', slug: 'strength-foundations', summary: 'Master the squat, hinge, press and pull with expert coaching.', description: 'An 8-week introduction to barbell training. Small groups, technical coaching and progressive overload from day one.', level: 'beginner', durationWeeks: 8, sessionsPerWeek: 3, tags: ['strength', 'barbell'], featured: true, order: 1 },
      { title: 'Hypertrophy Lab', slug: 'hypertrophy-lab', summary: 'Evidence-based muscle building with tracked volume.', description: 'Periodised training blocks with weekly volume targets, tempo work and nutrition check-ins.', level: 'intermediate', durationWeeks: 12, sessionsPerWeek: 4, tags: ['muscle', 'bodybuilding'], featured: true, order: 2 },
      { title: 'Metabolic Conditioning', slug: 'metabolic-conditioning', summary: 'High-output intervals that build an engine.', description: 'Sled, rower, bike and kettlebell circuits programmed with heart-rate zones.', level: 'all', durationWeeks: 6, sessionsPerWeek: 3, tags: ['conditioning', 'fat loss'], featured: true, order: 3 },
      { title: 'Olympic Lifting', slug: 'olympic-lifting', summary: 'Snatch and clean & jerk on competition platforms.', description: 'Technical progressions and strength work coached by national-level lifters.', level: 'advanced', durationWeeks: 12, sessionsPerWeek: 3, tags: ['olympic', 'power'], featured: false, order: 4 },
      { title: 'Mobility & Recovery', slug: 'mobility-recovery', summary: 'Move better, recover faster, train longer.', description: 'Guided mobility flows, breathwork and recovery-suite protocols.', level: 'all', durationWeeks: 4, sessionsPerWeek: 2, tags: ['mobility', 'recovery'], featured: true, order: 5 },
      { title: 'Athlete Performance', slug: 'athlete-performance', summary: 'Speed, power and resilience for field and court athletes.', description: 'Sport-specific periodisation with testing every 4 weeks.', level: 'intermediate', durationWeeks: 10, sessionsPerWeek: 3, tags: ['athletes', 'speed'], featured: true, order: 6 },
    ]),
  );

  await seedIfEmpty('membership plans', MembershipPlanModel, () =>
    MembershipPlanModel.insertMany([
      { name: 'Trial Week', slug: 'trial-week', tagline: 'Experience the club', durationDays: 7, priceMinor: 0, isTrial: true, benefits: ['7 days full floor access', '1 coaching assessment', 'Group classes included'], limits: { classesPerWeek: 3 }, order: 0 },
      { name: 'Essential Monthly', slug: 'essential-monthly', tagline: 'Floor access, your way', durationDays: 30, priceMinor: 349900, benefits: ['Unlimited floor access', '4 group classes / week', 'Locker & towel service', 'App progress tracking'], limits: { classesPerWeek: 4 }, order: 1 },
      { name: 'Performance Quarterly', slug: 'performance-quarterly', tagline: 'Most popular', durationDays: 90, priceMinor: 899900, compareAtMinor: 1049700, promoLabel: 'Save 14%', highlight: true, benefits: ['Unlimited floor access', 'Unlimited group classes', '2 personal training sessions', 'Quarterly body composition scan', 'Recovery suite access'], limits: { classesPerWeek: null, ptSessions: 2 }, order: 2, refundableDays: 7, cancellationPolicy: 'Full refund within 7 days of purchase if no more than 2 visits.' },
      { name: 'Elite Annual', slug: 'elite-annual', tagline: 'The complete experience', durationDays: 365, priceMinor: 2999900, compareAtMinor: 4198800, promoLabel: 'Save 28%', benefits: ['Everything in Performance', '12 personal training sessions', 'Monthly nutrition consult', 'Guest passes (6)', 'Priority class booking'], limits: { classesPerWeek: null, ptSessions: 12, guestPasses: 6 }, order: 3 },
    ]),
  );

  await seedIfEmpty('coupons', CouponModel, () => CouponModel.create({ code: 'APEX20', description: 'Founding offer: 20% off', type: 'percent', value: 20, maxDiscountMinor: 200000, perUserLimit: 1, newMembersOnly: true, campaign: 'founding', validUntil: addDays(new Date(), 60) }));

  await seedIfEmpty('facilities', FacilityModel, () =>
    FacilityModel.insertMany([
      { name: 'Strength floor', description: '12 competition racks, calibrated plates and specialty bars.', icon: 'dumbbell', order: 1 },
      { name: 'Olympic platforms', description: 'Six dedicated lifting platforms with bumper sets.', icon: 'trophy', order: 2 },
      { name: 'Conditioning zone', description: 'Air bikes, rowers, ski-ergs, sleds and a 30 m turf lane.', icon: 'activity', order: 3 },
      { name: 'Recovery suite', description: 'Infrared sauna, cold plunge and compression therapy.', icon: 'snowflake', order: 4 },
      { name: 'Studio', description: 'Sprung-floor studio for mobility, yoga and group classes.', icon: 'sparkles', order: 5 },
      { name: 'Luxury locker rooms', description: 'Rain showers, premium amenities and digital lockers.', icon: 'lock', order: 6 },
      { name: 'Nutrition bar', description: 'Protein shakes and recovery meals made to order.', icon: 'coffee', order: 7 },
      { name: 'Secure parking', description: 'Covered parking with EV charging.', icon: 'car', order: 8 },
    ]),
  );

  await seedIfEmpty('FAQs', FaqModel, () =>
    FaqModel.insertMany([
      { question: 'Do I need experience to join?', answer: 'No. Every membership starts with a coaching assessment, and our Strength Foundations program is designed for complete beginners.', order: 1 },
      { question: 'Can I try the club before joining?', answer: 'Yes — book a complimentary trial session using the form on this page and a coach will walk you through the facility and a full workout.', order: 2 },
      { question: 'How do class bookings work?', answer: 'Members book classes from their dashboard. If a class is full you can join the waitlist and you will be notified automatically if a spot opens.', order: 3 },
      { question: 'What is your cancellation policy?', answer: 'Class bookings can be cancelled up to 4 hours before the start time. Membership cancellation and refund terms are listed on each plan.', order: 4 },
      { question: 'Which payment methods do you accept?', answer: 'UPI, cards, net banking and wallets via our secure payment partner, plus cash or card at the front desk.', order: 5 },
      { question: 'Is personal training included?', answer: 'Performance and Elite plans include personal training sessions. Additional sessions can be booked with any coach from your dashboard.', order: 6 },
      { question: 'What are your opening hours?', answer: 'Monday to Friday 5:30 am – 10:30 pm, Saturday 6:30 am – 8 pm and Sunday 7 am – 1 pm.', order: 7 },
      { question: 'Is my data private?', answer: 'Yes. Progress photos and health notes are private to you, your assigned coach (only if you allow it) and authorised staff.', order: 8 },
    ]),
  );

  await seedIfEmpty('testimonial examples (unpublished)', TestimonialModel, () =>
    TestimonialModel.create({ name: 'Example member', subtitle: 'Replace with a real, consented testimonial', quote: 'This is an example testimonial to show the format. Publish only genuine reviews from real members.', rating: 5, published: false }),
  );
  await seedIfEmpty('gallery examples (unpublished)', GalleryItemModel, () =>
    GalleryItemModel.create({ category: 'transformation', title: 'Example transformation story', story: 'Use this format for real member stories. Record the member’s written consent before publishing.', memberDisplayName: 'Member name', durationWeeks: 16, resultSummary: 'e.g. +40 kg deadlift', published: false, consent: { given: false } }),
  );

  await seedIfEmpty('blog', BlogPostModel, () =>
    BlogPostModel.insertMany([
      {
        title: 'Progressive overload, explained simply',
        slug: 'progressive-overload-explained',
        excerpt: 'The single principle behind every successful strength program — and three practical ways to apply it.',
        category: 'training',
        tags: ['strength', 'programming'],
        authorName: 'Apex Coaching Team',
        status: 'published',
        publishedAt: addDays(new Date(), -12),
        readingMinutes: 4,
        content:
          '## What it means\n\nYour body adapts to the demands you place on it. To keep progressing, those demands must increase gradually over time.\n\n## Three ways to progress\n\n1. **Add load** — small jumps of 1–2.5 kg on compound lifts.\n2. **Add reps** — work within a rep range, then increase the weight.\n3. **Add quality** — better tempo, depth and control count too.\n\n## Track it\n\nYou cannot manage what you do not measure. Log every session in your member dashboard so your coach can adjust the plan.',
      },
      {
        title: 'Sleep: the most underrated performance tool',
        slug: 'sleep-performance-tool',
        excerpt: 'Why seven to nine hours matters more than your pre-workout, and simple habits to get there.',
        category: 'recovery',
        tags: ['recovery', 'lifestyle'],
        authorName: 'Apex Coaching Team',
        status: 'published',
        publishedAt: addDays(new Date(), -6),
        readingMinutes: 3,
        content: '## Recovery happens at night\n\nMuscle repair, hormone regulation and motor learning all depend on quality sleep.\n\n## Practical habits\n\n- Keep a consistent wake time\n- Dim screens an hour before bed\n- Keep the room cool and dark\n- Limit caffeine after 2 pm\n\n_This article is general information, not medical advice._',
      },
      {
        title: 'Your first month: what to expect',
        slug: 'your-first-month',
        excerpt: 'From your assessment to your first program block — a clear roadmap for new members.',
        category: 'club',
        tags: ['beginners'],
        authorName: 'Apex Coaching Team',
        status: 'published',
        publishedAt: addDays(new Date(), -2),
        readingMinutes: 3,
        content: '## Week 1: assessment\n\nWe measure movement quality, strength baselines and goals.\n\n## Weeks 2–4: foundations\n\nYour coach builds a plan you can see in your dashboard, with sessions you can log as you go.\n\n## After 30 days\n\nWe review progress together and set the next block.',
      },
    ]),
  );

  await seedIfEmpty('exercise library', ExerciseModel, () =>
    ExerciseModel.insertMany(
      [
        ['Back Squat', 'strength', ['quads', 'glutes'], ['barbell', 'rack']],
        ['Front Squat', 'strength', ['quads', 'core'], ['barbell', 'rack']],
        ['Conventional Deadlift', 'strength', ['hamstrings', 'glutes', 'back'], ['barbell']],
        ['Romanian Deadlift', 'strength', ['hamstrings', 'glutes'], ['barbell']],
        ['Bench Press', 'strength', ['chest', 'triceps'], ['barbell', 'bench']],
        ['Overhead Press', 'strength', ['shoulders', 'triceps'], ['barbell']],
        ['Pull-up', 'strength', ['lats', 'biceps'], ['pull-up bar']],
        ['Barbell Row', 'strength', ['back', 'biceps'], ['barbell']],
        ['Walking Lunge', 'strength', ['quads', 'glutes'], ['dumbbells']],
        ['Hip Thrust', 'strength', ['glutes'], ['barbell', 'bench']],
        ['Kettlebell Swing', 'conditioning', ['glutes', 'hamstrings'], ['kettlebell']],
        ['Sled Push', 'conditioning', ['legs'], ['sled']],
        ['Rowing Intervals', 'cardio', ['full body'], ['rower']],
        ['Air Bike Sprint', 'cardio', ['full body'], ['air bike']],
        ['Plank', 'core', ['core'], []],
        ['Hanging Leg Raise', 'core', ['core'], ['pull-up bar']],
        ['Power Clean', 'olympic', ['full body'], ['barbell']],
        ['Snatch', 'olympic', ['full body'], ['barbell']],
        ['World’s Greatest Stretch', 'mobility', ['hips', 'thoracic'], []],
        ['Couch Stretch', 'mobility', ['hip flexors'], []],
      ].map(([name, category, muscles, equipment]) => ({
        name,
        slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        category,
        muscleGroups: muscles,
        equipment,
        difficulty: category === 'olympic' ? 'advanced' : 'beginner',
        instructions: 'Brace, control the eccentric, and move through a full, pain-free range of motion. Ask a coach for a technique check.',
      })),
    ),
  );

  let trainers = await UserModel.find({ role: 'trainer' }).lean();
  if (trainers.length === 0) {
    const defs = [
      { name: 'Arjun Mehta', slug: 'arjun-mehta', title: 'Head of Strength', specializations: ['Powerlifting', 'Strength'], experienceYears: 11, certifications: ['NSCA-CSCS'] },
      { name: 'Kavya Rao', slug: 'kavya-rao', title: 'Performance Coach', specializations: ['Athlete performance', 'Conditioning'], experienceYears: 8, certifications: ['CSCS', 'FMS Level 2'] },
      { name: 'Rohan Iyer', slug: 'rohan-iyer', title: 'Olympic Lifting Coach', specializations: ['Olympic lifting', 'Mobility'], experienceYears: 9, certifications: ['IWF Level 2'] },
      { name: 'Meera Kapoor', slug: 'meera-kapoor', title: 'Hypertrophy & Nutrition', specializations: ['Hypertrophy', 'Nutrition'], experienceYears: 7, certifications: ['Precision Nutrition L1'] },
    ];
    for (const [i, d] of defs.entries()) {
      // Trainers get random passwords and set their own via "Forgot password".
      const user = await UserModel.create({ name: d.name, email: `${d.slug}@trainers.apex.example`, passwordHash: await hashPassword(randomToken(24)), role: 'trainer', emailVerified: true });
      await TrainerProfileModel.create({
        user: user._id,
        slug: d.slug,
        displayName: d.name,
        title: d.title,
        bio: `${d.name.split(' ')[0]} coaches with a simple promise: measurable progress, every block. Sample profile — edit in Admin → Trainers.`,
        specializations: d.specializations,
        certifications: d.certifications,
        experienceYears: d.experienceYears,
        order: i,
        availability: [1, 2, 3, 4, 5].map((day) => ({ day, start: '07:00', end: '12:00' })).concat([1, 3, 5].map((day) => ({ day, start: '16:00', end: '20:00' }))),
      });
    }
    trainers = await UserModel.find({ role: 'trainer' }).lean();
    console.log('  ✓ trainers (sample profiles, no login until a password reset is requested)');
  }

  await seedIfEmpty('class schedule (next 14 days)', GymClassModel, async () => {
    const templates = [
      { title: 'Strength Foundations', hour: 7, duration: 60, capacity: 12, level: 'beginner', program: 'strength-foundations' },
      { title: 'Metcon Engine', hour: 18, duration: 45, capacity: 16, level: 'all', program: 'metabolic-conditioning' },
      { title: 'Olympic Technique', hour: 19, duration: 75, capacity: 8, level: 'advanced', program: 'olympic-lifting' },
      { title: 'Mobility Flow', hour: 8, duration: 45, capacity: 14, level: 'all', program: 'mobility-recovery' },
    ];
    const programs = await ProgramModel.find().lean();
    const docs = [];
    const base = new Date();
    base.setUTCHours(0, 0, 0, 0);
    for (let d = 1; d <= 14; d++) {
      const day = addDays(base, d);
      if (day.getUTCDay() === 0) continue;
      for (const [i, t] of templates.entries()) {
        if ((d + i) % 2 === 0 && i > 1) continue;
        // Gym timezone is IST (UTC+5:30).
        const startsAt = new Date(day.getTime() + (t.hour * 60 - 330) * 60000);
        docs.push({ title: t.title, startsAt, endsAt: new Date(startsAt.getTime() + t.duration * 60000), capacity: t.capacity, level: t.level, location: i % 2 ? 'Studio' : 'Main floor', trainer: trainers[i % trainers.length]?._id, program: programs.find((p) => p.slug === t.program)?._id, description: `${t.title} — coached session.` });
      }
    }
    await GymClassModel.insertMany(docs);
  });

  if (args.has('--demo-accounts')) {
    if (isProd) throw new Error('--demo-accounts is not allowed in production');
    const pw = () => `Demo-${randomToken(9)}9`;
    const out: string[] = [];
    const trainer = trainers[0];
    if (trainer) {
      const p = pw();
      await UserModel.updateOne({ _id: trainer._id }, { $set: { passwordHash: await hashPassword(p) } });
      out.push(`trainer  ${trainer.email}  ${p}`);
    }
    let member = await UserModel.findOne({ email: 'demo.member@apex.example' });
    const mp = pw();
    if (!member) {
      member = await UserModel.create({ name: 'Demo Member', email: 'demo.member@apex.example', passwordHash: await hashPassword(mp), role: 'member', qrToken: randomToken(18), emailVerified: true, phone: '+919800000000' });
      await ensureMemberProfile(member._id);
      const plan = await MembershipPlanModel.findOne({ slug: 'performance-quarterly' });
      if (plan) await grantMembership({ userId: member._id, planId: plan._id, mode: 'new', source: 'admin' });
      if (trainer) {
        await MemberProfileModel.updateOne({ user: member._id }, { $set: { assignedTrainer: trainer._id, heightCm: 176 } });
        await WorkoutPlanModel.create({
          title: 'Foundations Block A',
          member: member._id,
          trainer: trainer._id,
          days: [
            { name: 'Day 1', focus: 'Lower', exercises: [{ name: 'Back Squat', sets: 4, reps: '6', restSec: 150 }, { name: 'Romanian Deadlift', sets: 3, reps: '8', restSec: 120 }, { name: 'Walking Lunge', sets: 3, reps: '10/leg' }] },
            { name: 'Day 2', focus: 'Upper', exercises: [{ name: 'Bench Press', sets: 4, reps: '6', restSec: 150 }, { name: 'Barbell Row', sets: 4, reps: '8' }, { name: 'Overhead Press', sets: 3, reps: '8' }] },
          ],
        });
      }
    } else {
      await UserModel.updateOne({ _id: member._id }, { $set: { passwordHash: await hashPassword(mp) } });
    }
    out.push(`member   demo.member@apex.example  ${mp}`);
    console.log('\nDemo accounts (development only — random passwords, shown once):');
    out.forEach((l) => console.log(`  ${l}`));
    console.log('Create your admin with: npm run create-admin');
  }

  await PromotionModel.countDocuments();
  console.log('\nSeed complete.');
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb();
  process.exit(1);
});
