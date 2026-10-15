import { zodToJsonSchema } from 'zod-to-json-schema';
import { sectionSchema, siteSettingsSchema, themeTokensSchema, pageDraftUpdateSchema, pageInputSchema } from '@apex/shared';
import { loginSchema, registerSchema, resetSchema, forgotSchema, changePasswordSchema } from '../validators/auth.validators';
import { contactSchema, newsletterSchema, trialSchema, programSchema, faqSchema, gallerySchema, facilitySchema, testimonialSchema, promotionSchema } from '../validators/content.validators';
import type { ZodTypeAny } from 'zod';

/**
 * OpenAPI 3.0 description of the REST API, served at /api/docs (Swagger UI) and /api/openapi.json.
 * Request body schemas are generated from the same zod validators the routes use.
 */

type Access = 'public' | 'auth' | 'member' | 'trainer' | 'staff' | 'admin' | `perm:${string}` | 'webhook';
interface Ep {
  m: 'get' | 'post' | 'put' | 'patch' | 'delete';
  p: string;
  s: string;
  a: Access;
  body?: string;
  q?: string[];
}

const schemas: Record<string, ZodTypeAny> = {
  Register: registerSchema,
  Login: loginSchema,
  ForgotPassword: forgotSchema,
  ResetPassword: resetSchema,
  ChangePassword: changePasswordSchema,
  Contact: contactSchema,
  Newsletter: newsletterSchema,
  TrialRequest: trialSchema,
  Program: programSchema,
  Faq: faqSchema,
  GalleryItem: gallerySchema,
  Facility: facilitySchema,
  Testimonial: testimonialSchema,
  Promotion: promotionSchema,
  Section: sectionSchema,
  ThemeTokens: themeTokensSchema,
  SiteSettings: siteSettingsSchema,
  PageCreate: pageInputSchema,
  PageDraftUpdate: pageDraftUpdateSchema,
};

const E: Record<string, Ep[]> = {
  Auth: [
    { m: 'get', p: '/auth/csrf', s: 'Issue CSRF token (also set as apex_csrf cookie)', a: 'public' },
    { m: 'post', p: '/auth/register', s: 'Register a member account (always role=member)', a: 'public', body: 'Register' },
    { m: 'post', p: '/auth/login', s: 'Log in; sets httpOnly access/refresh cookies', a: 'public', body: 'Login' },
    { m: 'post', p: '/auth/refresh', s: 'Rotate refresh token (reuse detection revokes the session family)', a: 'public' },
    { m: 'post', p: '/auth/logout', s: 'Log out and revoke session', a: 'public' },
    { m: 'get', p: '/auth/me', s: 'Current user', a: 'auth' },
    { m: 'post', p: '/auth/forgot-password', s: 'Request password reset email (no account enumeration)', a: 'public', body: 'ForgotPassword' },
    { m: 'post', p: '/auth/reset-password', s: 'Reset password with token; revokes all sessions', a: 'public', body: 'ResetPassword' },
    { m: 'post', p: '/auth/verify-email', s: 'Verify email with token', a: 'public' },
    { m: 'post', p: '/auth/resend-verification', s: 'Resend verification email', a: 'auth' },
    { m: 'post', p: '/auth/change-password', s: 'Change password', a: 'auth', body: 'ChangePassword' },
  ],
  Users: [
    { m: 'get', p: '/users', s: 'List staff accounts', a: 'admin' },
    { m: 'post', p: '/users/admins', s: 'Create an admin (password set via email)', a: 'admin' },
    { m: 'patch', p: '/users/{id}/access', s: 'Change role / permissions / status (audited)', a: 'admin' },
  ],
  Members: [
    { m: 'get', p: '/members/me', s: 'Own profile', a: 'member' },
    { m: 'patch', p: '/members/me', s: 'Update own profile', a: 'member' },
    { m: 'post', p: '/members/me/avatar', s: 'Upload profile picture (multipart: file)', a: 'auth' },
    { m: 'get', p: '/members/me/dashboard', s: 'Member dashboard data', a: 'member' },
    { m: 'post', p: '/members/me/goals', s: 'Add fitness goal', a: 'member' },
    { m: 'put', p: '/members/me/goals/{goalId}', s: 'Update goal', a: 'member' },
    { m: 'delete', p: '/members/me/goals/{goalId}', s: 'Delete goal', a: 'member' },
    { m: 'get', p: '/members/{memberId}/progress', s: 'Progress entries (self, assigned trainer, staff). Use "me" for self.', a: 'auth' },
    { m: 'post', p: '/members/{memberId}/progress', s: 'Add progress entry', a: 'auth' },
    { m: 'get', p: '/members/{memberId}/photos', s: 'Private progress photos (trainer only if shared)', a: 'auth' },
    { m: 'post', p: '/members/me/photos', s: 'Upload private progress photo', a: 'member' },
    { m: 'delete', p: '/members/me/photos/{id}', s: 'Delete progress photo', a: 'member' },
    { m: 'get', p: '/members/{memberId}/workout-logs', s: 'Training history', a: 'auth' },
    { m: 'post', p: '/members/{memberId}/workout-logs', s: 'Log a workout', a: 'auth' },
    { m: 'get', p: '/members/me/loyalty', s: 'Loyalty points & referrals', a: 'member' },
    { m: 'post', p: '/members/me/reviews', s: 'Submit a review (moderated)', a: 'member' },
    { m: 'get', p: '/members', s: 'Search/filter members (trainers: assigned only). format=csv to export', a: 'staff', q: ['q', 'status', 'membership', 'trainer', 'page', 'limit', 'format'] },
    { m: 'get', p: '/members/{id}', s: 'Member detail (payments only with payments:read)', a: 'staff' },
    { m: 'post', p: '/members', s: 'Create member', a: 'perm:members:write' },
    { m: 'patch', p: '/members/{id}', s: 'Edit member', a: 'perm:members:write' },
    { m: 'post', p: '/members/{id}/status', s: 'Suspend / reactivate (audited)', a: 'perm:members:write' },
    { m: 'post', p: '/members/{id}/assign-trainer', s: 'Assign trainer', a: 'perm:members:write' },
  ],
  Trainers: [
    { m: 'get', p: '/trainers', s: 'Public trainer profiles', a: 'public' },
    { m: 'get', p: '/trainers/profile/{slug}', s: 'Public trainer profile', a: 'public' },
    { m: 'get', p: '/trainers/me', s: 'Own trainer profile', a: 'trainer' },
    { m: 'patch', p: '/trainers/me', s: 'Update profile & availability', a: 'trainer' },
    { m: 'get', p: '/trainers/me/overview', s: 'Trainer dashboard', a: 'trainer' },
    { m: 'get', p: '/trainers/me/members', s: 'Assigned members', a: 'trainer' },
    { m: 'get', p: '/trainers/me/schedule', s: 'Classes and sessions', a: 'trainer' },
    { m: 'get', p: '/trainers/me/notes', s: 'Notes & follow-ups', a: 'trainer' },
    { m: 'post', p: '/trainers/me/notes', s: 'Add note (assigned members only)', a: 'trainer' },
    { m: 'get', p: '/trainers/admin/all', s: 'All trainers', a: 'perm:trainers:write' },
    { m: 'post', p: '/trainers/admin', s: 'Create trainer (password via email)', a: 'perm:trainers:write' },
    { m: 'put', p: '/trainers/admin/{userId}', s: 'Update trainer', a: 'perm:trainers:write' },
  ],
  Plans: [
    { m: 'get', p: '/plans', s: 'Active membership plans (prices in paise)', a: 'public' },
    { m: 'get', p: '/plans/admin', s: 'All plans', a: 'perm:plans:write' },
    { m: 'post', p: '/plans/admin', s: 'Create plan', a: 'perm:plans:write' },
    { m: 'put', p: '/plans/admin/{id}', s: 'Update plan', a: 'perm:plans:write' },
    { m: 'delete', p: '/plans/admin/{id}', s: 'Archive plan', a: 'perm:plans:write' },
    { m: 'get', p: '/plans/admin/coupons/all', s: 'List coupons', a: 'perm:plans:write' },
    { m: 'post', p: '/plans/admin/coupons', s: 'Create coupon', a: 'perm:plans:write' },
    { m: 'put', p: '/plans/admin/coupons/{id}', s: 'Update coupon', a: 'perm:plans:write' },
  ],
  Memberships: [
    { m: 'get', p: '/memberships/me', s: 'Own memberships', a: 'auth' },
    { m: 'post', p: '/memberships/me/{id}/cancel-request', s: 'Request cancellation', a: 'member' },
    { m: 'get', p: '/memberships', s: 'List memberships (filters: status, expiringInDays). format=csv', a: 'perm:members:read' },
    { m: 'post', p: '/memberships', s: 'Grant complimentary membership (audited)', a: 'perm:members:write' },
    { m: 'patch', p: '/memberships/{id}', s: 'Extend / cancel / set dates (audited)', a: 'perm:members:write' },
  ],
  Payments: [
    { m: 'post', p: '/payments/quote', s: 'Server-side price quote (plan + coupon)', a: 'member' },
    { m: 'post', p: '/payments/checkout', s: 'Create provider order; amount computed on server', a: 'member' },
    { m: 'post', p: '/payments/verify', s: 'Verify signature + confirm with provider, then activate membership (idempotent)', a: 'member' },
    { m: 'post', p: '/payments/failed', s: 'Record checkout failure/dismissal', a: 'member' },
    { m: 'post', p: '/payments/sandbox/complete', s: 'DEV ONLY: simulate gateway (PAYMENT_PROVIDER=sandbox)', a: 'member' },
    { m: 'get', p: '/payments/me', s: 'Own payment history', a: 'auth' },
    { m: 'get', p: '/payments/{id}/receipt', s: 'Download PDF receipt (owner or payments:read)', a: 'auth' },
    { m: 'get', p: '/payments', s: 'All payments (filters). format=csv', a: 'perm:payments:read' },
    { m: 'get', p: '/payments/status', s: 'Payment configuration status', a: 'perm:payments:read' },
    { m: 'post', p: '/payments/offline', s: 'Record offline payment & activate (audited)', a: 'perm:payments:write' },
    { m: 'post', p: '/payments/{id}/refund', s: 'Refund (audited)', a: 'perm:payments:write' },
    { m: 'post', p: '/payments/webhook/razorpay', s: 'Razorpay webhook (HMAC-SHA256 X-Razorpay-Signature; idempotent per X-Razorpay-Event-Id)', a: 'webhook' },
  ],
  Bookings: [
    { m: 'post', p: '/bookings/trial', s: 'Public free-trial request', a: 'public', body: 'TrialRequest' },
    { m: 'get', p: '/bookings/me', s: 'Own bookings (scope=upcoming|past|all)', a: 'auth' },
    { m: 'post', p: '/bookings/class', s: 'Book a class (capacity + waitlist + duplicate protection)', a: 'member' },
    { m: 'post', p: '/bookings/pt', s: 'Book personal training (availability + overlap checks)', a: 'member' },
    { m: 'get', p: '/bookings/pt/slots', s: 'Free PT slots for a trainer/date', a: 'auth' },
    { m: 'post', p: '/bookings/{id}/cancel', s: 'Cancel (policy window for members); promotes waitlist', a: 'auth' },
    { m: 'post', p: '/bookings/{id}/reschedule', s: 'Move to another class', a: 'member' },
    { m: 'post', p: '/bookings/{id}/attendance', s: 'Mark attended / no-show (class trainer or staff)', a: 'staff' },
    { m: 'get', p: '/bookings', s: 'All bookings', a: 'perm:classes:write' },
    { m: 'patch', p: '/bookings/{id}/trial', s: 'Confirm / assign / close a trial request', a: 'perm:classes:write' },
  ],
  Classes: [
    { m: 'get', p: '/classes', s: 'Public schedule', a: 'public', q: ['from', 'to', 'days', 'trainer'] },
    { m: 'get', p: '/classes/{id}/roster', s: 'Class roster', a: 'staff' },
    { m: 'post', p: '/classes', s: 'Create class (optionally weekly series)', a: 'perm:classes:write' },
    { m: 'patch', p: '/classes/{id}', s: 'Update class', a: 'perm:classes:write' },
    { m: 'post', p: '/classes/{id}/cancel', s: 'Cancel class & notify attendees', a: 'perm:classes:write' },
    { m: 'delete', p: '/classes/{id}', s: 'Delete class without bookings', a: 'perm:classes:write' },
  ],
  Workouts: [
    { m: 'get', p: '/workouts/exercises', s: 'Exercise library', a: 'auth' },
    { m: 'post', p: '/workouts/exercises', s: 'Create exercise', a: 'staff' },
    { m: 'put', p: '/workouts/exercises/{id}', s: 'Update exercise', a: 'staff' },
    { m: 'get', p: '/workouts/plans', s: 'Workout plans (scoped by role)', a: 'auth' },
    { m: 'get', p: '/workouts/plans/{id}', s: 'Workout plan', a: 'auth' },
    { m: 'post', p: '/workouts/plans', s: 'Create / assign plan (assigned members only)', a: 'staff' },
    { m: 'put', p: '/workouts/plans/{id}', s: 'Update plan', a: 'staff' },
  ],
  Attendance: [
    { m: 'get', p: '/attendance/me', s: 'Own attendance history', a: 'auth' },
    { m: 'get', p: '/attendance/me/qr', s: 'Own check-in QR payload', a: 'member' },
    { m: 'post', p: '/attendance/me/qr/rotate', s: 'Rotate QR token', a: 'member' },
    { m: 'post', p: '/attendance/check-in', s: 'Check in by QR or member id (active membership required)', a: 'staff' },
    { m: 'post', p: '/attendance/{id}/check-out', s: 'Check out', a: 'staff' },
    { m: 'get', p: '/attendance', s: 'Attendance by day / member', a: 'staff' },
  ],
  Notifications: [
    { m: 'get', p: '/notifications/me', s: 'Notification center', a: 'auth' },
    { m: 'post', p: '/notifications/{id}/read', s: 'Mark read', a: 'auth' },
    { m: 'post', p: '/notifications/read-all', s: 'Mark all read', a: 'auth' },
    { m: 'post', p: '/notifications/campaigns', s: 'Send renewal/marketing campaign (deduplicated per key)', a: 'perm:members:write' },
  ],
  CMS: [
    { m: 'get', p: '/cms/site', s: 'Public bootstrap: settings, published theme, nav, promotions, 3D models, payment public config', a: 'public' },
    { m: 'get', p: '/cms/version', s: 'Content version for client refetch after publishing', a: 'public' },
    { m: 'get', p: '/cms/stats', s: 'Live aggregate statistics', a: 'public' },
    { m: 'get', p: '/cms/public/{collection}', s: 'programs | faqs | facilities | testimonials | reviews | promotions | gallery', a: 'public' },
    { m: 'post', p: '/cms/contact', s: 'Contact form', a: 'public', body: 'Contact' },
    { m: 'post', p: '/cms/newsletter', s: 'Newsletter signup (consent required)', a: 'public', body: 'Newsletter' },
    { m: 'get', p: '/cms/admin/programs', s: 'CRUD: programs (also faqs, facilities, testimonials, promotions, gallery)', a: 'perm:cms:write' },
    { m: 'post', p: '/cms/admin/programs', s: 'Create program', a: 'perm:cms:write', body: 'Program' },
    { m: 'post', p: '/cms/admin/gallery', s: 'Create gallery item (consent enforced for member images)', a: 'perm:cms:write', body: 'GalleryItem' },
    { m: 'get', p: '/cms/admin/messages', s: 'Contact messages', a: 'perm:cms:write' },
    { m: 'get', p: '/cms/admin/subscribers', s: 'Newsletter subscribers (format=csv)', a: 'perm:cms:write' },
    { m: 'get', p: '/cms/admin/reviews', s: 'Reviews to moderate', a: 'perm:cms:write' },
    { m: 'patch', p: '/cms/admin/reviews/{id}', s: 'Approve / reject review', a: 'perm:cms:write' },
  ],
  Themes: [
    { m: 'get', p: '/themes/published', s: 'Published theme tokens', a: 'public' },
    { m: 'get', p: '/themes', s: 'Draft, published, presets, history', a: 'perm:cms:write' },
    { m: 'put', p: '/themes/draft', s: 'Save theme draft', a: 'perm:cms:write', body: 'ThemeTokens' },
    { m: 'post', p: '/themes/publish', s: 'Publish draft (validated)', a: 'perm:cms:write' },
    { m: 'post', p: '/themes/reset-draft', s: 'Reset draft to default', a: 'perm:cms:write' },
  ],
  Pages: [
    { m: 'get', p: '/pages/public/{slug}', s: 'Published page (slug "home" resolves the home page)', a: 'public' },
    { m: 'get', p: '/pages', s: 'List pages', a: 'perm:cms:write' },
    { m: 'post', p: '/pages', s: 'Create page', a: 'perm:cms:write', body: 'PageCreate' },
    { m: 'get', p: '/pages/{id}', s: 'Page with draft + validation', a: 'perm:cms:write' },
    { m: 'put', p: '/pages/{id}/draft', s: 'Save draft (sections may be incomplete)', a: 'perm:cms:write', body: 'PageDraftUpdate' },
    { m: 'post', p: '/pages/{id}/publish', s: 'Validate & publish (live page unchanged if invalid)', a: 'perm:cms:write' },
    { m: 'post', p: '/pages/{id}/unpublish', s: 'Unpublish', a: 'perm:cms:write' },
    { m: 'post', p: '/pages/{id}/duplicate', s: 'Duplicate page', a: 'perm:cms:write' },
    { m: 'delete', p: '/pages/{id}', s: 'Delete (non-system)', a: 'perm:cms:write' },
    { m: 'get', p: '/pages/{id}/versions', s: 'Published versions', a: 'perm:cms:write' },
    { m: 'post', p: '/pages/{id}/versions/{versionId}/restore', s: 'Restore version into draft', a: 'perm:cms:write' },
  ],
  Media: [
    { m: 'get', p: '/media', s: 'Media library', a: 'perm:media:write' },
    { m: 'post', p: '/media/images', s: 'Upload images (multipart: files[], folder). Magic-byte + dimension validation, EXIF stripped, WebP variants', a: 'perm:media:write' },
    { m: 'post', p: '/media/models', s: 'Upload .glb model (validated, starts pending)', a: 'perm:media:write' },
    { m: 'post', p: '/media/models/{id}/review', s: 'Approve / reject model', a: 'perm:cms:write' },
    { m: 'patch', p: '/media/{id}', s: 'Rename / alt / folder', a: 'perm:media:write' },
    { m: 'delete', p: '/media/{id}', s: 'Delete', a: 'perm:media:write' },
    { m: 'get', p: '/media/private/{id}', s: 'Stream private file after ownership checks', a: 'auth' },
  ],
  Blog: [
    { m: 'get', p: '/blog', s: 'Published posts', a: 'public' },
    { m: 'get', p: '/blog/post/{slug}', s: 'Published post', a: 'public' },
    { m: 'get', p: '/blog/admin', s: 'All posts', a: 'perm:cms:write' },
    { m: 'post', p: '/blog/admin', s: 'Create post', a: 'perm:cms:write' },
    { m: 'put', p: '/blog/admin/{id}', s: 'Update post', a: 'perm:cms:write' },
  ],
  Reports: [
    { m: 'get', p: '/reports/overview', s: 'Dashboard overview', a: 'perm:reports:read' },
    { m: 'get', p: '/reports/registrations', s: 'Registrations by period (format=csv)', a: 'perm:reports:read', q: ['from', 'to', 'interval', 'format'] },
    { m: 'get', p: '/reports/revenue', s: 'Revenue by period (format=csv)', a: 'perm:reports:read', q: ['from', 'to', 'interval', 'format'] },
    { m: 'get', p: '/reports/plans', s: 'Plan performance (format=csv)', a: 'perm:reports:read' },
    { m: 'get', p: '/reports/memberships', s: 'Membership status breakdown', a: 'perm:reports:read' },
    { m: 'get', p: '/reports/bookings', s: 'Booking & attendance summary', a: 'perm:reports:read' },
  ],
  Settings: [
    { m: 'get', p: '/settings', s: 'Site settings', a: 'perm:settings:write' },
    { m: 'put', p: '/settings', s: 'Update site settings', a: 'perm:settings:write', body: 'SiteSettings' },
    { m: 'get', p: '/settings/system-status', s: 'Integration & job status (no secrets)', a: 'perm:settings:write' },
    { m: 'get', p: '/settings/audit-logs', s: 'Audit log', a: 'perm:audit:read' },
  ],
  Support: [
    { m: 'post', p: '/support', s: 'Open a ticket', a: 'auth' },
    { m: 'get', p: '/support', s: 'Tickets (scope=all for staff)', a: 'auth' },
    { m: 'get', p: '/support/{id}', s: 'Ticket', a: 'auth' },
    { m: 'post', p: '/support/{id}/messages', s: 'Reply', a: 'auth' },
    { m: 'patch', p: '/support/{id}', s: 'Change status / priority', a: 'auth' },
  ],
};

const accessText: Record<string, string> = {
  public: 'Public',
  auth: 'Any signed-in user (ownership enforced)',
  member: 'Member role',
  trainer: 'Trainer role',
  staff: 'Admin or trainer (trainers limited to assigned members / own classes)',
  admin: 'Admin role',
  webhook: 'Provider webhook (signature verified)',
};

function build() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [tag, eps] of Object.entries(E)) {
    for (const ep of eps) {
      const params = [...ep.p.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
      const query = (ep.q ?? []).map((name) => ({ name, in: 'query', required: false, schema: { type: 'string' } }));
      const access = ep.a.startsWith('perm:') ? `Admin, or staff granted \`${ep.a.slice(5)}\`` : accessText[ep.a];
      paths[ep.p] ??= {};
      paths[ep.p][ep.m] = {
        tags: [tag],
        summary: ep.s,
        description: `**Access:** ${access}`,
        parameters: [...params, ...query],
        security: ep.a === 'public' || ep.a === 'webhook' ? [] : [{ cookieAuth: [], csrf: [] }],
        ...(ep.body ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ep.body}` } } } } } : {}),
        responses: {
          '200': { description: 'Success: `{ data, meta? }`' },
          '4XX': { description: 'Error: `{ error: { code, message, details? } }`', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      };
    }
  }
  const components: Record<string, unknown> = {
    Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } },
  };
  for (const [name, schema] of Object.entries(schemas)) {
    components[name] = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Apex Athletics API',
      version: '1.0.0',
      description:
        'REST API for the Apex Athletics website and gym management system.\n\n' +
        '- Authentication: httpOnly cookies (`apex_at` access, `apex_rt` refresh). Call `POST /auth/refresh` on 401.\n' +
        '- CSRF: send the `apex_csrf` cookie value (or `GET /auth/csrf`) in the `X-CSRF-Token` header on every non-GET request.\n' +
        '- Money is always integer minor units (paise). Prices are never accepted from the client.\n' +
        '- Responses: `{ data, meta? }`; errors: `{ error: { code, message, details? } }`.',
    },
    servers: [{ url: '/api/v1' }],
    tags: Object.keys(E).map((name) => ({ name })),
    paths,
    components: {
      schemas: components,
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'apex_at' },
        csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
    },
  };
}

export const openapiSpec = build();
