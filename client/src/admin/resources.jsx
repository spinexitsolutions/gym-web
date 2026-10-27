import { Send } from 'lucide-react';
import { api } from '../services/api.js';
import { Img } from '../components/ui/Img.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { StatusBadge } from '../components/dashboard/Widgets.jsx';
import { formatPaise, formatDate, CATEGORY_LABELS, PERIODS } from '../utils/format.js';

const yesNo = [{ value: '', label: 'All' }, { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
const thumb = (img, alt) => <Img image={img} alt={alt || ''} sizes="48px" className="h-12 w-12 shrink-0 rounded-brand" />;
const titleCell = (img, title, sub) => (
  <div className="flex items-center gap-3">{img !== undefined && thumb(img, title)}<div><p className="font-medium">{title}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div></div>
);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ value: i, label: d }));
const periodOptions = Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }));
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const difficulty = ['beginner', 'intermediate', 'advanced'].map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }));
const PLAN_SOURCE = { endpoint: '/admin/plans?limit=100&sort=order', label: 'name' };
const TRAINER_SOURCE = { endpoint: '/admin/trainers?limit=100&sort=order', label: 'name' };

export const plansConfig = {
  title: 'Membership plans', singular: 'plan', endpoint: '/admin/plans', sortDefault: 'order',
  description: 'Prices, durations, benefits and limits shown on the website and used at checkout.',
  filters: [{ key: 'status', label: 'Status', options: [{ value: '', label: 'All statuses' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }],
  columns: [
    { key: 'name', header: 'Plan', sortKey: 'name', render: (r) => titleCell(undefined, r.name, r.tagline) },
    { key: 'tier', header: 'Tier', render: (r) => <span className="capitalize">{r.tier}</span> },
    { key: 'pricing', header: 'From', render: (r) => (r.pricing?.length ? formatPaise(Math.min(...r.pricing.map((p) => p.pricePaise / (PERIODS[p.period]?.months || 1)))) + '/mo' : '—') },
    { key: 'status', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.status} />{!r.isActive && <Badge>inactive</Badge>}{r.isFeatured && <Badge tone="gold">featured</Badge>}</div> },
    { key: 'order', header: 'Order', sortKey: 'order', hideOnMobile: true },
  ],
  defaults: () => ({ tier: 'basic', status: 'draft', isActive: true, pricing: [{ period: 'monthly', pricePaise: 0, discountPercent: 0 }], benefits: [], comparison: [], limits: { ptSessionsPerMonth: 0, classesPerWeek: 0, guestPassesPerMonth: 0 }, joiningFeePaise: 0, order: 0 }),
  fields: [
    { name: 'name', label: 'Plan name', required: true },
    { name: 'slug', label: 'URL slug', hint: 'Leave blank to generate from the name' },
    { name: 'tier', label: 'Tier', type: 'select', options: ['basic', 'standard', 'premium', 'elite'].map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })) },
    { name: 'tagline', label: 'Tagline' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { section: 'Pricing' },
    { name: 'pricing', label: 'Billing options', type: 'repeater', itemLabel: 'Option', max: 4, newItem: () => ({ period: 'monthly', pricePaise: 0, discountPercent: 0 }),
      hint: 'Enter the total price for each period. The discount % is shown as a "Save" label.',
      fields: [
        { name: 'period', label: 'Period', type: 'select', options: periodOptions },
        { name: 'pricePaise', label: 'Total price', type: 'money' },
        { name: 'discountPercent', label: 'Discount label %', type: 'percent', min: 0, max: 90 },
      ] },
    { name: 'joiningFeePaise', label: 'Joining fee', type: 'money', hint: 'Charged once on a member’s first purchase' },
    { section: 'Benefits & limits' },
    { name: 'benefits', label: 'Benefits (shown on pricing cards)', type: 'tags', max: 20 },
    { name: 'comparison', label: 'Comparison table rows', type: 'repeater', itemLabel: 'Row', newItem: () => ({ label: '', value: '' }),
      hint: 'Use "Yes"/"No" for ticks, or a short value like "4 / month". Use the same labels across plans.',
      fields: [{ name: 'label', label: 'Feature' }, { name: 'value', label: 'Value' }] },
    { name: 'limits.ptSessionsPerMonth', label: 'PT sessions per month', type: 'number', min: 0, hint: '0 = not included' },
    { name: 'limits.classesPerWeek', label: 'Group classes per week', type: 'number', min: 0, hint: '0 = unlimited' },
    { name: 'limits.guestPassesPerMonth', label: 'Guest passes per month', type: 'number', min: 0 },
    { section: 'Visibility' },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft (hidden)' }, { value: 'published', label: 'Published' }] },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'isActive', label: 'Available for purchase', type: 'checkbox' },
    { name: 'isFeatured', label: 'Highlight as most popular', type: 'checkbox' },
  ],
};

export const trainersConfig = {
  title: 'Trainers', singular: 'trainer', endpoint: '/admin/trainers', sortDefault: 'order', searchPlaceholder: 'Search name or specialisation',
  description: 'Profiles, qualifications, availability and personal-training rates.',
  filters: [{ key: 'isActive', label: 'Active', options: yesNo }],
  columns: [
    { key: 'name', header: 'Trainer', sortKey: 'name', render: (r) => titleCell(r.photo, r.name, r.title) },
    { key: 'specializations', header: 'Specialisations', hideOnMobile: true, render: (r) => r.specializations?.slice(0, 3).join(', ') },
    { key: 'experienceYears', header: 'Exp.', sortKey: 'experienceYears', render: (r) => `${r.experienceYears} yrs` },
    { key: 'user', header: 'Login', hideOnMobile: true, render: (r) => (r.user ? r.user.email : <span className="text-muted">Not linked</span>) },
    { key: 'isActive', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.isActive ? 'active' : 'archived'} />{r.isFeatured && <Badge tone="gold">featured</Badge>}</div> },
  ],
  defaults: () => ({ isActive: true, availability: [], specializations: [], qualifications: [], certifications: [], languages: ['English'], sessionDurationMin: 60, experienceYears: 0, order: 0 }),
  fields: [
    { name: 'name', label: 'Full name', required: true },
    { name: 'title', label: 'Title', placeholder: 'Head of Strength' },
    { name: 'photo', label: 'Professional photo', type: 'image', folder: 'trainers' },
    { name: 'bio', label: 'Bio', type: 'textarea' },
    { name: 'specializations', label: 'Specialisations', type: 'tags' },
    { name: 'qualifications', label: 'Qualifications', type: 'tags' },
    { name: 'certifications', label: 'Certifications', type: 'repeater', itemLabel: 'Certification', newItem: () => ({ name: '', issuer: '' }),
      fields: [{ name: 'name', label: 'Name' }, { name: 'issuer', label: 'Issuer' }, { name: 'year', label: 'Year', type: 'number', min: 1970, max: 2100 }] },
    { name: 'experienceYears', label: 'Years of experience', type: 'number', min: 0 },
    { name: 'languages', label: 'Languages', type: 'tags' },
    { section: 'Personal training' },
    { name: 'sessionDurationMin', label: 'Session length (minutes)', type: 'number', min: 15, max: 180 },
    { name: 'ptPricePaise', label: 'Price per session', type: 'money', hint: 'Shown on the profile' },
    { name: 'availability', label: 'Weekly availability', type: 'repeater', itemLabel: 'Slot', newItem: () => ({ dayOfWeek: 1, start: '06:00', end: '10:00' }),
      hint: 'Members can book sessions inside these windows (gym local time).',
      fields: [{ name: 'dayOfWeek', label: 'Day', type: 'select', options: DAYS }, { name: 'start', label: 'From', type: 'time' }, { name: 'end', label: 'To', type: 'time' }] },
    { section: 'Account & visibility' },
    { name: 'user', label: 'Linked trainer login', type: 'ref', source: { endpoint: '/admin/staff', label: (u) => `${u.name} (${u.email}) — ${u.role}` }, placeholder: '— Not linked —',
      hint: 'Link a team account with the trainer role so they can use the trainer dashboard.' },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'isActive', label: 'Active (visible and bookable)', type: 'checkbox' },
    { name: 'isFeatured', label: 'Feature on the homepage', type: 'checkbox' },
  ],
};

export const programsConfig = {
  title: 'Workout programs', singular: 'program', endpoint: '/admin/programs', sortDefault: 'order',
  description: 'Programs shown on the website with difficulty, duration, coaches and plan eligibility.',
  filters: [{ key: 'category', label: 'Category', options: [{ value: '', label: 'All categories' }, ...categoryOptions] }],
  columns: [
    { key: 'title', header: 'Program', sortKey: 'title', render: (r) => titleCell(r.image, r.title, CATEGORY_LABELS[r.category]) },
    { key: 'difficulty', header: 'Level', render: (r) => <span className="capitalize">{r.difficulty}</span> },
    { key: 'durationWeeks', header: 'Duration', hideOnMobile: true, render: (r) => `${r.durationWeeks} wks · ${r.sessionsPerWeek}×/wk` },
    { key: 'isActive', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.isActive ? 'active' : 'archived'} />{r.isFeatured && <Badge tone="gold">featured</Badge>}</div> },
  ],
  defaults: () => ({ category: 'strength', difficulty: 'beginner', durationWeeks: 8, sessionsPerWeek: 3, sessionLengthMin: 60, isActive: true, highlights: [], trainers: [], eligiblePlans: [], order: 0 }),
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'slug', label: 'URL slug', hint: 'Leave blank to generate' },
    { name: 'category', label: 'Category', type: 'select', options: categoryOptions },
    { name: 'difficulty', label: 'Difficulty', type: 'select', options: difficulty },
    { name: 'summary', label: 'Summary (cards)', type: 'textarea', rows: 2, maxLength: 240 },
    { name: 'description', label: 'Full description', type: 'textarea', rows: 6 },
    { name: 'image', label: 'Image', type: 'image', folder: 'programs' },
    { name: 'durationWeeks', label: 'Duration (weeks)', type: 'number', min: 1 },
    { name: 'sessionsPerWeek', label: 'Sessions per week', type: 'number', min: 1 },
    { name: 'sessionLengthMin', label: 'Session length (min)', type: 'number', min: 10 },
    { name: 'highlights', label: 'Highlights', type: 'tags', max: 10 },
    { name: 'trainers', label: 'Coaches', type: 'multiref', source: TRAINER_SOURCE, wide: true },
    { name: 'eligiblePlans', label: 'Included in plans', type: 'multiref', source: PLAN_SOURCE, wide: true },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'isActive', label: 'Visible on the website', type: 'checkbox' },
    { name: 'isFeatured', label: 'Feature on the homepage', type: 'checkbox' },
  ],
};

export const testimonialsConfig = {
  title: 'Testimonials', singular: 'testimonial', endpoint: '/admin/testimonials', sortDefault: 'order', searchPlaceholder: 'Search name or quote',
  description: 'Member success stories. Publishing requires the member’s recorded consent.',
  filters: [{ key: 'isPublished', label: 'Published', options: yesNo }],
  columns: [
    { key: 'name', header: 'Member', render: (r) => titleCell(r.photo, r.name, r.headline) },
    { key: 'rating', header: 'Rating', render: (r) => '★'.repeat(r.rating) },
    { key: 'isPublished', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.isPublished ? 'published' : 'draft'} />{r.isDemo && <Badge>sample</Badge>}{!r.consentConfirmed && !r.isDemo && <Badge tone="danger">no consent</Badge>}</div> },
  ],
  defaults: () => ({ rating: 5, isPublished: false, consentConfirmed: false, order: 0 }),
  fields: [
    { name: 'name', label: 'Member name', required: true },
    { name: 'headline', label: 'Headline', placeholder: 'Lost 12 kg in 6 months' },
    { name: 'quote', label: 'Quote', type: 'textarea', required: true },
    { name: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} stars` })) },
    { name: 'memberSince', label: 'Member since', placeholder: '2023' },
    { name: 'photo', label: 'Photo (optional)', type: 'image', folder: 'testimonials' },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'consentConfirmed', label: 'The member gave written consent to publish this', type: 'checkbox' },
    { name: 'isDemo', label: 'Sample content (shows a “Sample” badge)', type: 'checkbox' },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
  ],
};

export const galleryConfig = {
  title: 'Gallery', singular: 'gallery item', endpoint: '/admin/gallery', sortDefault: 'order',
  description: 'Club photos and consented before/after transformations.',
  filters: [{ key: 'category', label: 'Category', options: [{ value: '', label: 'All' }, ...['gym', 'facility', 'equipment', 'event', 'transformation'].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))] }],
  columns: [
    { key: 'title', header: 'Item', render: (r) => titleCell(r.image?.url ? r.image : r.afterImage, r.title || r.memberName || 'Untitled', r.caption) },
    { key: 'category', header: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'isPublished', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.isPublished ? 'published' : 'draft'} />{r.isDemo && <Badge>sample</Badge>}</div> },
  ],
  defaults: () => ({ category: 'gym', isPublished: true, order: 0 }),
  fields: [
    { name: 'category', label: 'Category', type: 'select', options: ['gym', 'facility', 'equipment', 'event', 'transformation'].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })) },
    { name: 'title', label: 'Title' },
    { name: 'caption', label: 'Caption', type: 'textarea', rows: 2 },
    { name: 'image', label: 'Photo', type: 'image', folder: 'gallery', showIf: (v) => v.category !== 'transformation' },
    { name: 'memberName', label: 'Member name (first name or initials)', showIf: (v) => v.category === 'transformation' },
    { name: 'durationLabel', label: 'Duration', placeholder: '6 months', showIf: (v) => v.category === 'transformation' },
    { name: 'beforeImage', label: 'Before photo', type: 'image', folder: 'gallery', showIf: (v) => v.category === 'transformation' },
    { name: 'afterImage', label: 'After photo', type: 'image', folder: 'gallery', showIf: (v) => v.category === 'transformation' },
    { name: 'consentConfirmed', label: 'Member gave written consent to publish these photos', type: 'checkbox', showIf: (v) => v.category === 'transformation' },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
  ],
};

export const faqsConfig = {
  title: 'FAQs', singular: 'FAQ', endpoint: '/admin/faqs', sortDefault: 'order', searchPlaceholder: 'Search questions',
  columns: [
    { key: 'question', header: 'Question', render: (r) => <p className="max-w-xl font-medium">{r.question}</p> },
    { key: 'category', header: 'Category', hideOnMobile: true },
    { key: 'isPublished', header: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'published' : 'draft'} /> },
    { key: 'order', header: 'Order', sortKey: 'order' },
  ],
  defaults: () => ({ isPublished: true, category: 'general', order: 0 }),
  fields: [
    { name: 'question', label: 'Question', required: true, wide: true },
    { name: 'answer', label: 'Answer', type: 'textarea', required: true },
    { name: 'category', label: 'Category' },
    { name: 'order', label: 'Display order', type: 'number', min: 0 },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
  ],
};

export const eventsConfig = {
  title: 'Events & challenges', singular: 'event', endpoint: '/admin/events', sortDefault: '-startDate',
  description: 'Workshops, community events and fitness challenges with leaderboards.',
  filters: [{ key: 'kind', label: 'Type', options: [{ value: '', label: 'All' }, { value: 'event', label: 'Events' }, { value: 'challenge', label: 'Challenges' }] }],
  columns: [
    { key: 'title', header: 'Event', render: (r) => titleCell(r.image, r.title, r.location) },
    { key: 'startDate', header: 'Dates', sortKey: 'startDate', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
    { key: 'kind', header: 'Type', render: (r) => <span className="capitalize">{r.kind}{r.metric !== 'none' ? ` · ${r.metric}` : ''}</span> },
    { key: 'participants', header: 'Joined', hideOnMobile: true, render: (r) => r.participants?.length || 0 },
    { key: 'isPublished', header: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'published' : 'draft'} /> },
  ],
  defaults: () => ({ kind: 'event', metric: 'none', isPublished: false }),
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'event', label: 'Event' }, { value: 'challenge', label: 'Challenge' }] },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'image', label: 'Image', type: 'image', folder: 'events' },
    { name: 'location', label: 'Location' },
    { name: 'startDate', label: 'Starts', type: 'datetime', required: true },
    { name: 'endDate', label: 'Ends', type: 'datetime', required: true },
    { name: 'metric', label: 'Leaderboard scoring', type: 'select', options: [{ value: 'none', label: 'No leaderboard' }, { value: 'attendance', label: 'Automatic — check-ins during the challenge' }, { value: 'manual', label: 'Manual scores entered by staff' }] },
    { name: 'unit', label: 'Score unit', placeholder: 'visits, kg, reps', showIf: (v) => v.metric !== 'none' },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
  ],
};

async function deliver(id, toast) {
  try { toast?.success((await api.post(`/admin/announcements/${id}/deliver`)).message); } catch (err) { toast?.error(err); }
}

export const announcementsConfig = (toast, qc) => ({
  title: 'Announcements', singular: 'announcement', endpoint: '/admin/announcements',
  description: 'Website promo banners and messages to members or staff (in-app and optional email).',
  filters: [{ key: 'audience', label: 'Audience', options: [{ value: '', label: 'All audiences' }, { value: 'public', label: 'Website visitors' }, { value: 'members', label: 'Members' }, { value: 'staff', label: 'Staff' }] }],
  columns: [
    { key: 'title', header: 'Title', render: (r) => titleCell(undefined, r.title, r.body?.slice(0, 80)) },
    { key: 'audience', header: 'Audience', render: (r) => <span className="capitalize">{r.audience}{r.showAsBanner ? ' · banner' : ''}</span> },
    { key: 'status', header: 'Status', render: (r) => <div className="flex gap-1"><StatusBadge status={r.status} />{r.deliveredAt && <Badge tone="success">sent</Badge>}</div> },
    { key: 'createdAt', header: 'Created', hideOnMobile: true, render: (r) => formatDate(r.createdAt) },
  ],
  extraActions: (r) => (r.status === 'published' && !r.deliveredAt && r.audience !== 'public' ? (
    <button type="button" className="rounded-full p-2 text-muted hover:bg-gold/10 hover:text-gold" aria-label="Send now"
      onClick={async (e) => { e.stopPropagation(); await deliver(r._id, toast); qc.invalidateQueries({ queryKey: ['/admin/announcements'] }); }}>
      <Send className="h-4 w-4" />
    </button>
  ) : null),
  defaults: () => ({ audience: 'members', status: 'draft', showAsBanner: false, sendEmail: false }),
  fields: [
    { name: 'title', label: 'Title', required: true, wide: true },
    { name: 'body', label: 'Message', type: 'textarea' },
    { name: 'audience', label: 'Audience', type: 'select', options: [{ value: 'public', label: 'Website visitors (banner)' }, { value: 'members', label: 'Members' }, { value: 'staff', label: 'Staff' }] },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
    { name: 'showAsBanner', label: 'Show as a promotional banner at the top of the website', type: 'checkbox', showIf: (v) => v.audience === 'public' },
    { name: 'sendEmail', label: 'Also email recipients when sent', type: 'checkbox', showIf: (v) => v.audience !== 'public' },
    { name: 'link.label', label: 'Link label', placeholder: 'View offer' },
    { name: 'link.href', label: 'Link URL', placeholder: '/memberships' },
    { name: 'startsAt', label: 'Show from', type: 'datetime' },
    { name: 'endsAt', label: 'Show until', type: 'datetime' },
  ],
});

export const blogConfig = {
  title: 'Blog', singular: 'post', endpoint: '/admin/blog', sortDefault: '-createdAt', searchPlaceholder: 'Search posts',
  description: 'Articles for SEO and member education. Write in Markdown.',
  filters: [{ key: 'status', label: 'Status', options: [{ value: '', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }],
  columns: [
    { key: 'title', header: 'Post', sortKey: 'title', render: (r) => titleCell(r.coverImage, r.title, r.tags?.join(', ')) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'publishedAt', header: 'Published', sortKey: 'publishedAt', render: (r) => (r.publishedAt ? formatDate(r.publishedAt) : '—') },
  ],
  defaults: () => ({ status: 'draft', tags: [], content: '' }),
  fields: [
    { name: 'title', label: 'Title', required: true, wide: true },
    { name: 'slug', label: 'URL slug', hint: 'Leave blank to generate' },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
    { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2, maxLength: 300 },
    { name: 'coverImage', label: 'Cover image', type: 'image', folder: 'blog' },
    { name: 'content', label: 'Content', type: 'markdown' },
    { name: 'tags', label: 'Tags', type: 'tags', max: 10 },
    { name: 'seo.title', label: 'SEO title (optional)', maxLength: 70 },
    { name: 'seo.description', label: 'SEO description (optional)', maxLength: 170 },
  ],
};

export const couponsConfig = {
  title: 'Coupons', singular: 'coupon', endpoint: '/admin/coupons', searchPlaceholder: 'Search codes',
  description: 'Promotional codes and automatic referral rewards.',
  filters: [{ key: 'kind', label: 'Type', options: [{ value: '', label: 'All' }, { value: 'promo', label: 'Promo' }, { value: 'referral', label: 'Referral rewards' }] }],
  columns: [
    { key: 'code', header: 'Code', render: (r) => titleCell(undefined, <span className="font-mono tracking-wider">{r.code}</span>, r.description) },
    { key: 'value', header: 'Discount', render: (r) => (r.discountType === 'percent' ? `${r.value}%${r.maxDiscountPaise ? ` (max ${formatPaise(r.maxDiscountPaise)})` : ''}` : formatPaise(r.value)) },
    { key: 'usedCount', header: 'Used', render: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ''}` },
    { key: 'validTo', header: 'Valid until', hideOnMobile: true, render: (r) => (r.validTo ? formatDate(r.validTo) : 'No expiry') },
    { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'archived'} /> },
  ],
  defaults: () => ({ discountType: 'percent', value: 10, perUserLimit: 1, isActive: true, applicablePlans: [], minAmountPaise: 0 }),
  fields: [
    { name: 'code', label: 'Code', required: true, placeholder: 'SUMMER25' },
    { name: 'description', label: 'Description' },
    { name: 'discountType', label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }] },
    { name: 'value', label: 'Percent off', type: 'percent', min: 0, max: 100, showIf: (v) => v.discountType === 'percent' },
    { name: 'value', label: 'Amount off', type: 'money', showIf: (v) => v.discountType === 'fixed' },
    { name: 'maxDiscountPaise', label: 'Maximum discount', type: 'money', showIf: (v) => v.discountType === 'percent' },
    { name: 'minAmountPaise', label: 'Minimum plan price', type: 'money' },
    { name: 'validFrom', label: 'Valid from', type: 'datetime' },
    { name: 'validTo', label: 'Valid until', type: 'datetime' },
    { name: 'usageLimit', label: 'Total uses allowed', type: 'number', min: 0, hint: 'Blank = unlimited' },
    { name: 'perUserLimit', label: 'Uses per member', type: 'number', min: 0 },
    { name: 'applicablePlans', label: 'Only for these plans (none selected = all)', type: 'multiref', source: PLAN_SOURCE, wide: true },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  // `value` is shown as a percent or a ₹ amount depending on the type; blank usage limit means unlimited.
  toPayload: (p, v) => ({ ...p, usageLimit: v.usageLimit === '' || v.usageLimit === undefined || v.usageLimit === null ? null : Number(v.usageLimit) }),
};
