# API

- Base URL: `/api/v1`
- Interactive documentation (OpenAPI 3, generated from the same zod validators the routes use):
  **`/api/docs`** (Swagger UI) and `/api/openapi.json`.

## Conventions

- **Auth**: httpOnly cookies set by `POST /auth/login` / `/auth/register`. On `401`, call `POST /auth/refresh` once and retry.
- **CSRF**: send the `apex_csrf` cookie value (also returned by `GET /auth/csrf`) in `X-CSRF-Token` on every non-GET request.
- **Responses**: `{ "data": ..., "meta": { page, limit, total, pages } }`; errors: `{ "error": { code, message, details? } }`
  where `details` lists `{ path, message }` field issues for validation errors (HTTP 422).
- **Money**: integer paise. **Dates**: ISO 8601 (UTC). The gym timezone is in site settings.
- **Pagination**: `?page=1&limit=20` (max 100). Many admin lists support `?format=csv`.

## Route groups

| Group | Highlights |
| --- | --- |
| `/auth` | csrf, register, login, refresh, logout, me, forgot/reset password, verify email, change password |
| `/users` | staff accounts, roles & permissions (admin) |
| `/members` | self-service profile, dashboard, goals, progress, private photos, workout logs, loyalty, reviews; staff search/export/detail, suspend, assign trainer |
| `/trainers` | public profiles; trainer self-service (overview, members, schedule, notes, availability); admin management |
| `/plans` | public plans; admin plans & coupons |
| `/memberships` | own memberships, cancellation requests; admin list/export, grant, extend/cancel |
| `/payments` | quote, checkout, verify, failed, receipts, own history; admin list/export, offline payments, refunds; `/webhook/razorpay` |
| `/bookings` | public trial requests; class and PT booking, slots, cancel, reschedule, attendance marking; admin lists and trial handling |
| `/classes` | public schedule; roster; admin create (weekly series), update, cancel, delete |
| `/workouts` | exercise library; workout plans (templates and assigned) |
| `/attendance` | QR payload/rotation, check-in/out, history |
| `/notifications` | notification center; campaigns |
| `/cms` | public site bootstrap, content version, live stats, public collections, contact/newsletter; admin content CRUD, messages, subscribers, reviews |
| `/themes` | published theme; draft/publish/reset/history |
| `/pages` | published pages by slug; admin page management, draft save, publish/unpublish, versions/restore, duplicate |
| `/media` | media library, image upload, 3D model upload & review, private file streaming |
| `/blog` | published articles; admin CRUD |
| `/reports` | overview, registrations, revenue, plan performance, membership breakdown, bookings/attendance (CSV) |
| `/settings` | site settings, system status, audit logs |
| `/support` | support tickets |

Also: `GET /api/health`, `GET /sitemap.xml`, `GET /robots.txt`.
