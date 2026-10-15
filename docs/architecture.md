# Architecture

```
apex-athletics/
├─ shared/            @apex/shared — zod schemas & types used by BOTH server and client
│  └─ src/            sections (CMS section registry), theme tokens & presets, site settings,
│                     3D scene config, roles & permissions, page schema, fitness helpers, money
├─ server/            Express + TypeScript + Mongoose REST API (/api/v1)
│  └─ src/
│     ├─ config/      env (zod-validated), db (transactions helper), logger (redacting)
│     ├─ models/      Mongoose schemas & indexes (see docs/database.md)
│     ├─ middleware/  auth (cookie JWT → DB user), RBAC/permissions, CSRF, validation, rate limits, uploads, errors
│     ├─ routes/      route groups (thin; validation + authorization + response shaping)
│     ├─ controllers/ auth controller, generic CMS CRUD factory
│     ├─ services/    business logic: auth/tokens, payments (Razorpay + sandbox providers), memberships,
│     │               bookings, attendance, CMS publishing, media/storage, notifications (email/WhatsApp),
│     │               reports, receipts (PDF), audit
│     ├─ validators/  request schemas
│     ├─ jobs/        node-cron scheduler + Mongo lease locks + tasks (reminders, expiry, cleanup)
│     ├─ docs/        OpenAPI spec (served at /api/docs)
│     └─ scripts/     seed, create-admin
│  └─ tests/          vitest + supertest against an in-memory MongoDB replica set
├─ client/            React 18 + Vite + TypeScript + Tailwind
│  └─ src/
│     ├─ app/         providers: SiteProvider (published settings + theme → CSS vars, publish polling),
│     │               AuthProvider, query client, route guard
│     ├─ components/  ui kit (buttons, forms, tables, modals, toasts, states) and public layout pieces
│     ├─ layouts/     PublicLayout, DashboardLayout (shared by admin/member/trainer)
│     ├─ features/    sections (CMS section renderers + PageRenderer), notifications
│     ├─ 3d/          reusable React Three Fiber layer (canvas, quality tiers, procedural models, GLTF loader)
│     ├─ pages/       public pages + auth pages
│     ├─ admin/       admin operations (pages/) and website CMS & theme builder (cms/)
│     ├─ member/      member dashboard
│     ├─ trainer/     trainer dashboard
│     └─ lib/         api client (CSRF + refresh), theme engine, formatting
└─ docs/
```

## Key decisions

- **One schema, two sides.** CMS sections, theme tokens and settings are defined once in `shared/` with zod.
  The server validates drafts/publishes with them; the client renders and builds admin forms from the same
  definitions (`SECTION_META.fields`). Adding a section type is a two-file change (see [cms.md](cms.md)).
- **Draft → publish with immutable versions.** Public endpoints only read `PageVersion` snapshots and the
  `published` theme; drafts can be saved incomplete, publishing validates everything first, so a broken
  draft can never take the live site down. A content version number lets clients refetch after publishing
  without rebuilds or reloads.
- **Theme as CSS variables.** The published theme is turned into CSS custom properties (RGB channels) at runtime;
  Tailwind utilities reference them, so colours/fonts/radii/button and card styles change instantly site-wide.
- **Server-authoritative money.** Prices, coupons, payment verification and membership activation happen only on the
  server; activation is idempotent (atomic transitions + unique indexes + transactions).
- **Defense in depth for access control.** Client guards are UX only; every route enforces role/permission/ownership
  server-side, and the user's role is read from the database on every request.
- **Cookie sessions.** httpOnly access + rotating refresh cookies with reuse detection, plus double-submit CSRF.
- **Graceful degradation.** Missing integrations (payments, SMTP, WhatsApp, WebGL, third-party maps) produce clear
  fallbacks instead of broken UI.

## Optional features — status

| Feature | Status |
| --- | --- |
| PWA | Web app manifest + theme colour are included. No service worker (avoids stale-content caching issues with the CMS); add one with `vite-plugin-pwa` if offline support is required. |
| Multilingual content | Not implemented. Recommended approach: add `locale` to `Page`/`PageVersion` and localised string maps to content collections; route prefix `/:locale`. |
| Multi-branch | Not implemented in v1 to keep operations simple. Design path: add a `Branch` collection and a `branch` reference on `GymClass`, `Attendance`, `Membership` (optional "all branches" plans), and staff permissions scoped per branch. Indexes already include the fields that would be composed with `branch`. |
| AI fitness recommendations / body analysis | Deliberately not included (privacy, validation and safety requirements). |
