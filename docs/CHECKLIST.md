# Build checklist

Legend: ✅ done (frontend + backend + database + validation) · 🟡 partial (what exists is real; the rest is listed) · ⬜ next

## Phase 1 — Architecture & setup ✅
- ✅ npm workspaces (`server`, `client`), scripts, `.editorconfig`, `.nvmrc`, `.gitignore`
- ✅ Env validation with clear errors, `server/.env.example` and `client/.env.example` (placeholders only)
- ✅ Docs: architecture, folder structure, design system, database schema, API, security, integrations, deployment

## Phase 2 — Public website 🟡
- ✅ Home: cinematic hero (image or video, 3D dumbbell on desktop), Join/Explore CTAs, animated stats (manual or live
  DB counts), about, facilities, featured trainers, pricing with period toggle, featured programs, before/after
  slider (consented items only), testimonials (sample badge), events & challenges, BMI / calorie / workout-burn
  tools with disclaimer, FAQ, contact + Google Map + form, newsletter, WhatsApp button, footer with socials
- ✅ About (story, mission, vision, facilities, gallery, certifications, trainers, safety & hygiene)
- ✅ Memberships (4 tiers × 4 periods, comparison table, benefits, joining fee, terms/cancellation/refund policies)
- ✅ Programs list (search, category & difficulty filters, pagination) and program detail (eligibility, coaches)
- ✅ Trainers list (search, specialisation filter) and trainer profile (qualifications, certifications, slots)
- ✅ Contact page (form with spam protection, details, hours, map, WhatsApp, stores inquiries in DB)
- ✅ Dark/light theme, admin-driven colours & fonts, SEO tags + JSON-LD, robots.txt, responsive, skeletons,
  error states with retry, empty states, reduced-motion support, keyboard navigation
- ⬜ Blog pages, sitemap.xml (Phase 6), PWA (Phase 6)
- Note: "Request a personal training session" currently goes to the contact form (pre-filled); online slot
  booking arrives with Phase 5.

## Phase 3 — Models, APIs, auth, RBAC ✅
- ✅ 26 Mongoose models with validation, refs and indexes (see DATABASE.md)
- ✅ Register (+ referral code), email verification, login with lockout, refresh rotation, logout / logout-all,
  forgot & reset password, `/me`
- ✅ Profile management: account details, avatar upload (Cloudinary, progress bar), personal details, fitness goals,
  emergency contact, medical notes, notification prefs, password change, account deletion request
- ✅ RBAC middleware (owner/admin/staff/trainer/member), CSRF, sanitising, rate limits, upload checks, audit log
- ✅ Secure `create-admin` script; demo seed script
- ✅ Website-settings CMS API with draft → publish

## Phase 4 — Admin dashboard ⬜ (next)
Admin layout & navigation · overview KPIs and charts from real data · CMS editors for every settings section with
image upload/preview/progress, save draft / publish / discard · CRUD: plans, trainers, programs, testimonials,
gallery, FAQs, events, announcements, blog, coupons · members list (search/filter/sort/paginate, profile, suspend,
CSV export) · inquiries · staff roles · audit log viewer · integration status.

## Phase 5 — Member dashboard & operations ⬜
Membership purchase & renewal with Razorpay (server signature verification + webhook), coupons & referrals,
payment history & PDF invoices · PT & group-class booking with capacity, overlap prevention, waitlist,
cancel/reschedule · QR check-in with short-lived tokens, attendance history, admin corrections with audit ·
progress tracking & charts · workout plans · notifications · support tickets.

## Phase 6 — Advanced features & hardening ⬜
Expiry & renewal reminder jobs, email receipts, challenges leaderboard, reviews & ratings, reports & CSV exports,
blog, sitemap, PWA + optional push (with consent), AI fitness assistant (optional, with safety disclaimer),
security monitoring.

## Phase 7 — Testing, deployment, docs ⬜
E2E tests, load checks, backup & restore runbook, production deployment guide expansion.

---

# How to test what exists today

Start MongoDB, then `npm run seed && npm run create-admin && npm run dev`.

| Feature | Steps | Expected |
| --- | --- | --- |
| Public site | Open http://localhost:5173 | All homepage sections render with seeded content; resize to mobile and use the ☰ menu |
| Theme | Click the sun/moon icon | Switches dark/light; persists on reload |
| CMS content | `PATCH /api/settings/draft` as admin (e.g. with the browser console: see below), then `POST /api/settings/publish` | Site shows the change only after publish |
| Register | /register → submit empty form, then valid data | Inline errors; then redirected to /account with a welcome note |
| Verify email | Copy the `[email:dev] … link=` URL from the API console | "Email verified"; badge turns green |
| Login lockout | Enter a wrong password 5 times | 6th attempt returns "Too many failed attempts" |
| Forgot / reset | /forgot-password → open the logged link → new password | Old sessions signed out; log in with new password |
| Profile | /account → edit details, goals, emergency contact → Save | Saved message; values persist after reload |
| Avatar | Upload a JPG (needs Cloudinary keys) | Progress %, new photo; without keys a clear 503 message |
| Deletion request | /account → Request account deletion → cancel | Pending date shown, then cleared |
| Contact form | Submit the form on /contact | Success message; inquiry stored in `contactinquiries` |
| Spam | Fill the hidden `website` field via devtools and submit | Success shown but nothing stored |
| RBAC | As a member, `fetch('/api/settings/draft')` | 403 |
| Programs/trainers | Use search and filters | URL updates (shareable); results filter server-side |
| BMI/calories | Home → Fitness tools | Results update live |

Browser-console snippet for admins (signed in):
```js
const { data } = await (await fetch('/api/auth/csrf')).json();
const h = { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrfToken };
await fetch('/api/settings/draft', { method: 'PATCH', headers: h, body: JSON.stringify({ hero: { title: 'Train like royalty' } }) });
await fetch('/api/settings/publish', { method: 'POST', headers: h });
```

Automated: `npm test` (29 unit/HTTP/component tests) and, with MongoDB,
`TEST_MONGO_URI=mongodb://127.0.0.1:27017/aurum_test npm test -w server` (9 more end-to-end API tests).
