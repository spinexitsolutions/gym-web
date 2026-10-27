// Starter website content. Every value is editable in Admin → Website. Photos are royalty-free images from
// Unsplash (https://unsplash.com/license) — replace them with your own gym photography before launch.
export const unsplash = (id, alt) => ({ url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80`, alt });

export const PHOTOS = {
  heroGym: unsplash('1534438327276-14e5300c3a48', 'Dark premium gym floor with dumbbell racks'),
  lifter: unsplash('1517836357463-d25dfeac3438', 'Athlete lifting a barbell'),
  woman: unsplash('1571019613454-1cb2f99b2d8b', 'Woman training with dumbbells'),
  floor: unsplash('1540497077202-7c8a3999166f', 'Strength training equipment on the gym floor'),
  dumbbells: unsplash('1593079831268-3381b0db4a77', 'Row of dumbbells'),
  ropes: unsplash('1574680096145-d05b474e2155', 'Functional training session'),
  pullup: unsplash('1583454110551-21f2fa2afe61', 'Athlete training upper body'),
  rack: unsplash('1541534741688-6078c6bfb5c5', 'Dumbbell rack in a modern gym'),
  yoga: unsplash('1544367567-0f2fcb009e0b', 'Yoga and flexibility class'),
  cycling: unsplash('1518611012118-696072aa579a', 'Group cardio class'),
  deadlift: unsplash('1581009146145-b5ef050c2e1e', 'Heavy deadlift training'),
  coach: unsplash('1567013127542-490d757e51fc', 'Personal trainer portrait'),
  studio: unsplash('1599058917212-d750089bc07e', 'Training studio'),
  hiit: unsplash('1605296867304-46d5465a13f1', 'High-intensity interval training'),
  cardio: unsplash('1526506118085-60ce8714f8c5', 'Cardio workout'),
  kettlebell: unsplash('1550345332-09e3ac987658', 'Kettlebell workout'),
  trainerWoman: unsplash('1576678927484-cc907957088c', 'Coach guiding a training session'),
};

export const defaultSettings = {
  brand: {
    name: 'Aurum Fitness Club',
    tagline: 'Where discipline becomes luxury',
    logo: { url: '', alt: 'Aurum Fitness Club' },
    logoDark: { url: '', alt: 'Aurum Fitness Club' },
    favicon: { url: '', alt: '' },
  },
  theme: {
    defaultMode: 'dark',
    allowToggle: true,
    accent: '#C9A54C',
    accentSoft: '#E6CF8B',
    background: '#0B0B0C',
    surface: '#141416',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
    radius: 'md',
  },
  announcementBar: {
    enabled: true,
    text: 'Founding membership: joining fee waived this month.',
    link: { label: 'View plans', href: '/memberships' },
  },
  hero: {
    eyebrow: 'Private training club · Est. 2016',
    title: 'Train in a class of',
    highlight: 'your own',
    subtitle:
      'Elite coaching, world-class equipment and a members-only atmosphere designed for people who take their performance seriously.',
    primaryCta: { label: 'Join now', href: '/register' },
    secondaryCta: { label: 'Explore membership', href: '/memberships' },
    backgroundImage: PHOTOS.heroGym,
    backgroundVideo: { url: '' },
    overlayOpacity: 0.6,
    show3d: true,
  },
  stats: {
    source: 'manual',
    // DEMO figures — replace with your real numbers or switch source to 'live'.
    items: [
      { key: 'members', label: 'Active members', value: 1200, suffix: '+' },
      { key: 'trainers', label: 'Certified coaches', value: 24, suffix: '' },
      { key: 'transformations', label: 'Transformations', value: 850, suffix: '+' },
      { key: 'custom', label: 'Years of excellence', value: 9, suffix: '' },
    ],
  },
  about: {
    eyebrow: 'About the club',
    title: 'Built for people who expect more from their training',
    body:
      'Aurum is a 22,000 sq ft performance club combining competition-grade strength equipment, recovery suites and a coaching team that tracks every rep. No crowds, no queues — just focused, intelligent training.',
    story:
      'Aurum began as a small strength studio run by two national-level coaches who were tired of crowded commercial gyms. Members came for the coaching and stayed for the culture. Today the club is a full-service performance facility, but the founding principle is unchanged: every member is coached, not just admitted.',
    mission: 'To deliver measurable, lasting results through expert coaching, premium facilities and genuine care.',
    vision: 'To be the most trusted performance club in the country — where every member trains with purpose.',
    image: PHOTOS.lifter,
    secondaryImage: PHOTOS.woman,
    highlights: ['Coach-to-member ratio of 1:30', 'Body composition scans every month', 'Open 5 AM – 11 PM daily', 'Hygiene audited weekly'],
  },
  facilities: [
    { title: 'Strength Arena', description: 'Competition racks, calibrated plates and platforms for serious lifting.', image: PHOTOS.floor, icon: 'Dumbbell' },
    { title: 'Cardio Deck', description: 'Connected treadmills, rowers and bikes with performance tracking.', image: PHOTOS.cardio, icon: 'HeartPulse' },
    { title: 'Functional Zone', description: 'Turf, sleds, ropes and rigs for athletic conditioning.', image: PHOTOS.ropes, icon: 'Activity' },
    { title: 'Mind & Body Studio', description: 'Heated studio for yoga, mobility and breathwork.', image: PHOTOS.yoga, icon: 'Flower2' },
    { title: 'Recovery Suite', description: 'Steam, sauna, cold plunge and percussion therapy.', image: PHOTOS.studio, icon: 'Snowflake' },
    { title: 'Private Training Rooms', description: 'Dedicated suites for one-to-one coaching.', image: PHOTOS.trainerWoman, icon: 'Lock' },
  ],
  certifications: [
    { title: 'ISO 9001 quality management', issuer: 'Example certification body', year: '2023' },
    { title: 'Coaches certified by ACE / NASM / ISSA', issuer: 'International bodies', year: 'Ongoing' },
    { title: 'Best Premium Gym — City Awards', issuer: 'Demo award (replace)', year: '2024' },
  ],
  safety: [
    { title: 'Hospital-grade sanitation', description: 'Equipment wiped after every use and deep-cleaned nightly.' },
    { title: 'Air purification', description: 'HEPA filtration with continuous fresh-air exchange.' },
    { title: 'First-aid trained staff', description: 'CPR and AED certified staff on every shift.' },
    { title: 'Health screening', description: 'PAR-Q screening and fitness assessment before your first session.' },
  ],
  contact: {
    address: '12 Example Avenue, Bandra West',
    city: 'Mumbai, Maharashtra 400050',
    phone: '+91 90000 00000',
    email: 'hello@example.com',
    whatsapp: '919000000000',
    whatsappMessage: 'Hi! I would like to know more about Aurum memberships.',
    mapQuery: 'Bandra West, Mumbai',
    hours: [
      { days: 'Monday – Friday', open: '05:00', close: '23:00' },
      { days: 'Saturday', open: '06:00', close: '22:00' },
      { days: 'Sunday', open: '07:00', close: '20:00' },
    ],
  },
  social: { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', youtube: 'https://youtube.com/', x: '', linkedin: '' },
  footer: {
    blurb: 'A private performance club for people who train with intent.',
    copyright: '© Aurum Fitness Club. All rights reserved.',
    links: [
      { label: 'Memberships', href: '/memberships' },
      { label: 'Programs', href: '/programs' },
      { label: 'Trainers', href: '/trainers' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  newsletter: { enabled: true, title: 'The Aurum Letter', subtitle: 'Training notes, nutrition guides and member events — once a month.' },
  membershipPolicy: {
    terms:
      'Memberships are personal and non-transferable. Members must follow club rules and staff instructions. Replace this text with terms reviewed by your legal adviser.',
    cancellation:
      'Cancellation requests can be submitted from the member dashboard and are reviewed within 3 business days. Your membership remains active until the end of the paid period unless otherwise approved.',
    refund:
      'Joining fees are non-refundable. Refunds on unused membership periods are assessed case by case and processed to the original payment method within 7–10 business days of approval.',
  },
  sections: {
    stats: true, about: true, facilities: true, trainers: true, plans: true, programs: true, transformations: true,
    testimonials: true, events: true, tools: true, faq: true, contact: true, newsletter: true,
  },
  seo: {
    title: 'Aurum Fitness Club — Premium Gym & Personal Training',
    description: 'A luxury performance gym with elite coaches, premium equipment, group classes and flexible memberships.',
    keywords: 'premium gym, luxury gym, personal training, fitness club, strength training',
    ogImage: PHOTOS.heroGym,
    siteUrl: 'http://localhost:5173',
  },
};
