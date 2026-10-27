# Architecture

```
          Browser (React SPA, installable PWA)
                │  same-origin /api  (HTTP-only cookies + X-CSRF-Token header)
                ▼
   Reverse proxy / Vite dev proxy ──► Express API (server/)
                                        ├─ middleware: helmet, CORS, rate limit, sanitize, CSRF, auth/RBAC, validate
                                        ├─ routes → controllers → services → Mongoose models
                                        ├─ jobs (activation, expiry, reminders, cleanup — DB-leased)
                                        └─ integrations: Cloudinary · Razorpay · Nodemailer
                                                     │
                                                     ▼
                                                  MongoDB
```

- **Single source of truth for content.** Every public page reads from the API: website settings (hero, theme,
  contact, SEO…), plans, trainers, programs, testimonials, FAQs, gallery and events. Nothing editable is
  hard-coded in components.
- **Draft → publish.** Admins edit `WebsiteSettings.draft`; the public site reads `published`. Publishing
  validates the whole document, bumps a version and clears the cache. Plans and blog posts have their own
  `draft`/`published` status; testimonials, FAQs and gallery items use `isPublished`.
- **Security on the server.** Hiding a button never protects anything: every private route checks the session,
  role and ownership on the API.

## Folder structure

```
.
├── package.json              npm workspaces + root scripts
├── docs/                     this documentation
├── server/
│   ├── .env.example          placeholders only
│   ├── src/
│   │   ├── server.js         boots DB + HTTP server, graceful shutdown
│   │   ├── app.js            express app & middleware order
│   │   ├── config/           env validation (zod), db, cloudinary
│   │   ├── models/           30 Mongoose models (+ index.js)
│   │   ├── controllers/      HTTP handlers (thin)
│   │   ├── routes/           routers per module, mounted in routes/index.js
│   │   ├── middleware/       auth/RBAC, csrf, validate, sanitize, rateLimit, upload, error
│   │   ├── services/         business logic: auth, tokens, pricing, membership, gateway (Razorpay),
│   │   │                     invoice (PDF), booking, notification, email, upload, settings, audit, assistant
│   │   ├── validators/       zod request schemas
│   │   ├── utils/            ApiError, responses, pagination, crypto
│   │   ├── jobs/             node-cron scheduler + idempotent tasks
│   │   └── scripts/          seed.js, createAdmin.js
│   └── tests/                vitest + supertest
└── client/
    ├── index.html, vite.config.js, tailwind.config.js
    └── src/
        ├── main.jsx, App.jsx  providers + lazy routes
        ├── layouts/           PublicLayout, AuthLayout, DashboardLayout (admin/member/trainer)
        ├── pages/             public/, auth/, member/
        ├── components/        ui/ (Button, Img, States…), layout/ (Header, Footer, Seo…),
        │                      sections/ (Hero, Pricing, FitnessTools…), three/ (3D dumbbell)
        ├── context/           AuthContext, ThemeContext
        ├── hooks/             useSettings, useInView, useReducedMotion, useDebounced
        ├── services/          api.js (fetch client), content.js
        ├── forms/             Field components, shared zod schemas
        ├── admin/             AdminApp, resource configs, CMS sections, pages
        ├── member/            MemberApp, checkout (Razorpay/sandbox), pages
        ├── trainer/           TrainerApp (schedule, members, plan builder, availability)
        ├── components/dashboard/  DataTable, Modal, FormBuilder, ResourcePage, ImageUpload, QrScanner, TicketThread…
        ├── utils/             format, fitness maths, responsive media, redirects
        └── __tests__/
```

## Request lifecycle

`helmet → cors → compression → logging (path + status only) → json/urlencoded (size-limited) → cookies →
sanitize ($/. keys stripped) → rate limit → CSRF (unsafe methods) → router → validate(zod) → authenticate →
authorize(roles) → controller → service → model → { success, data, message?, meta? }`

Errors flow to `middleware/error.js`, which maps Mongoose validation/cast/duplicate-key, Multer and JSON parse
errors to 4xx responses `{ success: false, message, details? }`, and hides internal messages in production.

## Authentication

- **Access token:** JWT (HS256, 15 min) in the `access_token` HTTP-only cookie.
- **Refresh token:** 48 random bytes in the `refresh_token` HTTP-only cookie scoped to `/api/auth`. Only its
  SHA-256 hash is stored (`Session`). Every refresh rotates it; replaying a used token revokes the whole family.
- **CSRF:** double-submit — `GET /api/auth/csrf` sets a readable `csrf_token` cookie; the client echoes it in
  `X-CSRF-Token` on POST/PUT/PATCH/DELETE. Cookies are `SameSite=Lax` by default.
- **Roles:** `owner` › `admin` › `staff` › `trainer` › `member`. `authorize('admin')` lets owner and admin through.
- Lockout after 5 failed logins (15 min). Password change/reset revokes all sessions and invalidates older JWTs.

## UI design system

| Token | Dark (default) | Light | Notes |
| --- | --- | --- | --- |
| `bg` | `#0B0B0C` | `#F8F6F1` | page background (admin-editable in dark mode) |
| `surface` | `#141416` | `#FFFFFF` | cards |
| `elevated` | `#1C1C1F` | `#F1EEE7` | inputs, skeletons |
| `ink` / `muted` | `#F4F1EA` / `#A39D92` | `#141311` / `#666158` | text (AA contrast on bg) |
| `gold` (accent) | `#C9A54C` | `#A07C28` | admin-editable; darker in light mode for contrast |
| `gold-soft` | `#E6CF8B` | — | metallic gradient highlight |

- **Type:** headings Playfair Display, body Inter (both selectable in the CMS from a curated list and loaded from
  Google Fonts at runtime). Eyebrows: 11 px, 0.28em tracking, uppercase, gold.
- **Shape:** one radius token (`--radius`: none/sm/md/lg in the CMS). Hairline borders at 10% ink.
- **Surfaces:** solid cards on `surface`; `.glass` (blur 18px + translucent surface) only over imagery or for
  highlighted panels; metallic gold gradient reserved for primary buttons and key numbers.
- **Motion:** Framer Motion fade-up on first view (0.7 s, ease-out-expo), animated counters, gentle hover lifts.
  `prefers-reduced-motion` disables motion and the 3D scene.
- **3D:** one procedural gold dumbbell in the hero (React Three Fiber, ~220 kB gzip) — lazy-loaded only on
  ≥1024 px screens with WebGL and ≥4 CPU cores, paused when off-screen.
- **Images:** `Img` builds `srcset` for Unsplash/Cloudinary (WebP/AVIF via `auto=format` / `f_auto`), lazy-loads
  below the fold, and falls back to a neutral panel if a source fails.
- **Accessibility:** skip link, visible focus rings, labelled form controls with `aria-invalid`/`aria-describedby`,
  keyboard-operable tabs, accordion, before/after slider and mobile menu (Esc closes).

## Dashboards

One `DashboardLayout` (sidebar, mobile drawer, notification bell) powers three apps with role-filtered navigation:

| App | Path | Roles | Highlights |
| --- | --- | --- | --- |
| Admin | `/admin` | owner, admin, staff (front-desk subset), trainer (check-in) | KPIs & charts, CMS, resource managers, members, payments, classes, check-in, inbox, team, audit, system |
| Member | `/dashboard` | member | membership & checkout, payments, booking, QR check-in, progress, workouts, challenges, support, assistant, profile |
| Trainer | `/trainer` | trainer | schedule, assigned members, workout plan builder, availability, check-in |

Admin content screens are generated from declarative configs (`admin/resources.jsx`, `admin/settingsSections.js`) rendered by
`ResourcePage` + `FormBuilder`, so adding a field is a one-line change. Server-side validation errors map back onto the exact
form field (including nested repeater paths).

## Background jobs

`server/src/jobs/scheduler.js` runs with `node-cron` in the gym time zone. Each job takes a lease in `SystemState`, so several
API instances never run the same job concurrently, and every side effect is idempotent (e.g. reminders are claimed in
`Membership.remindersSent` before sending).

| Job | Schedule | Effect |
| --- | --- | --- |
| activate-memberships | every 15 min | Starts renewals whose start date has arrived |
| expire-memberships | hourly | Marks ended memberships expired and notifies members without a renewal |
| expiry-reminders | daily 10:00 | Email + in-app reminders 7 days and 1 day before expiry |
| complete-sessions | hourly | Completes past classes/class bookings, closes stale waitlists |
| purge-unverified | daily 03:30 | Removes unverified accounts with no purchases after 30 days |
