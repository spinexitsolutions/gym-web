# API reference

Base URL `/api`. JSON in and out. Success: `{ "success": true, "data": …, "message"?, "meta"? }`.
Errors: `{ "success": false, "message": "…", "details"?: [{ "field", "message" }] }` — 400 validation, 401 not signed in,
403 forbidden/CSRF, 404, 409 conflict/duplicate, 413, 429 rate-limited, 502/503 integration unavailable, 500.

**Auth & CSRF:** cookies (`credentials: 'include'`). Call `GET /auth/csrf` once and send the token as `X-CSRF-Token` on every
POST/PUT/PATCH/DELETE (the Razorpay webhook is exempt and signature-verified). Lists accept `page`, `limit` (≤100), `sort`
(`field` / `-field`, whitelisted) and return `meta: { page, limit, total, pages }`. Money is integer **paise**.

Roles: **P** public · **U** any signed-in user · **M** member · **T** trainer · **S** staff · **A** admin (owner passes every check).

## Auth `/auth`
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/csrf` | P | Issues CSRF cookie + token |
| POST | `/register` | P | `name, email, password, phone?, referralCode?, acceptTerms` → signs in, sends verification |
| POST | `/login` | P | 5 failures → 15-min lock (429) |
| POST | `/refresh` | refresh cookie | Rotates refresh token; reuse revokes the session family |
| POST | `/logout`, `/logout-all` | P / U | |
| GET | `/me` | U | `{ user, profile }` |
| POST | `/verify-email`, `/resend-verification` | P / U | 24-h single-use token |
| POST | `/forgot-password`, `/reset-password` | P | 30-min single-use token; reset revokes all sessions |

## Users `/users` (U)
`PATCH /me` · `GET|PATCH /me/profile` · `POST|DELETE /me/avatar` (multipart `file`) · `POST /me/password` · `POST|DELETE /me/deletion-request`

## Website & content
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/settings/public` | P | Published settings, promo banners, live stats when enabled |
| GET / PATCH | `/settings/draft` | A | Deep-merged, fully validated draft |
| POST | `/settings/publish`, `/settings/discard` | A | Audited |
| GET | `/memberships/plans` | P | Published, active plans |
| GET | `/trainers`, `/trainers/:slug` | P | `q, specialization, featured, page, limit, sort` |
| GET | `/programs`, `/programs/:slug` | P | `q, category, difficulty, featured` |
| GET | `/classes` | P (U adds `myBooking`) | `from, to (YYYY-MM-DD), trainer, program` |
| GET | `/events`, `/events/:slug` | P | Detail includes leaderboard and `joined` |
| GET | `/blogs`, `/blogs/:slug` | P | `tag, q, page` |
| GET | `/gallery`, `/faqs`, `/reviews/testimonials`, `/reviews?targetType&target` | P | |
| POST | `/contact`, `/contact/newsletter` | P | Honeypot, timing and per-IP spam checks |
| GET | `/sitemap.xml`, `/robots.txt` (site root) | P | |

## Memberships & payments
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/memberships/me` | U | `{ current, upcoming, history, daysLeft }` |
| POST | `/memberships/:id/cancel-request` | M | `reason` |
| GET | `/memberships` | S | `status, plan, expiringInDays, cancellation, q` |
| POST | `/memberships/assign` | A | Complimentary/corporate, no payment |
| PATCH | `/memberships/:id` | A | `status?, endDate?, reason` (audited) |
| POST | `/memberships/:id/cancellation` | A | `decision: approve|reject` |
| POST | `/payments/quote` | U | `planId, period, couponCode?` → server price |
| POST | `/payments/order` | U (verified email) | Creates Payment + Razorpay order (or sandbox / 100% coupon) |
| POST | `/payments/verify` | U | `orderId, paymentId, signature` — HMAC + Razorpay API check, idempotent |
| POST | `/payments/:id/cancel` | U | Marks an abandoned checkout failed |
| POST | `/payments/webhook` | Razorpay | Raw body, `X-Razorpay-Signature`; `payment.captured`, `payment.failed`, `refund.processed` |
| GET | `/payments/me` | U | |
| GET | `/payments/:id/invoice` | owner of payment / S | PDF |
| POST | `/payments/:id/refund-request` | M | `reason` |
| GET | `/payments`, `/payments/export.csv` | S / A | `status, method, plan, user, from, to, q`; `meta.totals` |
| POST | `/payments/offline` | S | Cash/UPI/card at desk or complimentary → activates membership |
| POST | `/payments/:id/refund` | A | `decision, amountPaise?, note?` (Razorpay refund for online payments) |

## Bookings & classes
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/bookings/trainers/:id/slots?date=` | P | Free slots in gym time zone |
| POST | `/bookings/pt` | M (active) | `trainerId, startAt, notes?` — availability, overlap, plan PT limit, unique index |
| GET | `/bookings/me` | U | `{ upcoming (with waitlistPosition), past }` |
| POST | `/bookings/:id/cancel` | owner / S / assigned T | Promotes waitlist for classes |
| POST | `/bookings/:id/reschedule` | owner | PT only, ≥1 h before |
| GET | `/bookings/trainer/me` | T | Own PT sessions and classes |
| GET | `/bookings`, `/bookings/export.csv` | S | `type, status, trainer, member, from, to` |
| PATCH | `/bookings/:id/status` | S / T | `completed | no_show | cancelled` |
| POST | `/classes/:id/book` | M (active) | Atomic capacity, waitlist, plan eligibility, weekly limit |
| GET | `/classes/:id/roster` | S / assigned T | |
| POST | `/classes`, `/classes/series` | A | Single class or weekly series (skips trainer clashes) |
| PATCH | `/classes/:id` | A | Time change notifies booked members; capacity increase promotes waitlist |
| POST | `/classes/:id/cancel` | A | Cancels bookings and notifies |

## Attendance
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/attendance/qr` | M (active) | 60-second JWT (`aud=gym-checkin`), no personal data |
| POST | `/attendance/scan` | S / T | Check-in, then check-out on a later scan; replay & duplicate protection |
| POST | `/attendance/manual` | S / T | `memberId` |
| GET | `/attendance/me` | U | History + streak |
| GET | `/attendance` | S / T | `from, to, member, q` (default today) |
| GET | `/attendance/report?month=YYYY-MM`, `/attendance/export.csv` | S | Daily totals, peak hours |
| PATCH | `/attendance/:id` | S | Correction with required reason (stored + audited) |
| DELETE | `/attendance/:id` | A | |

## Members (S, some A)
`GET /members` (`q, status, membership=active|expiring|expired|none, deletionRequested, sort`) · `GET /members/export.csv` (A) ·
`POST /members` (walk-in invite) · `GET /members/:id` · `PATCH /members/:id/status` (A) · `PATCH /members/:id/profile` ·
`POST /members/:id/deletion` (A; anonymises, keeps finance)

## Training, community & support
| Method | Path | Who |
| --- | --- | --- |
| GET / POST / DELETE | `/workouts/progress[/:id]` | U (own) |
| GET | `/workouts/progress/:memberId` | S / assigned T |
| GET | `/workouts/me` | M |
| GET / POST / PATCH / DELETE | `/workouts/plans[/:id]` | S / assigned T |
| GET / PATCH | `/trainers/me` · GET `/trainers/me/members` | T |
| POST | `/events/:id/join`, `/events/:id/leave` | M (active to join) |
| GET / POST | `/reviews/me`, `/reviews` | M (trainer reviews need a completed session) |
| POST / GET | `/support`, `/support/me`, `/support/:id`, `/support/:id/messages` | U (own) / S (all, internal notes) |
| PATCH | `/support/:id` | S (status, priority, assignee) / M (close or reopen own) |
| GET | `/notifications`, `/notifications/unread-count` | U |
| POST | `/notifications/:id/read`, `/notifications/read-all` | U |
| GET / POST | `/notifications/push/key`, `/push/subscribe`, `/push/unsubscribe` | U |
| GET / POST | `/assistant/status`, `/assistant` | P / U (20 per hour) |

## Admin `/admin`
CRUD (`GET list`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, all audited) for
`plans · trainers · programs · testimonials · gallery · faqs · events · announcements · blog · coupons` (A; staff can read plans,
trainers, programs, events). Plus: `POST /announcements/:id/deliver` · `POST /events/:id/scores` (S) ·
`POST /media/image|video|icon?folder=` (multipart) · `DELETE /media` · `GET|PATCH /inquiries[/:id]` (S) ·
`GET|POST|PATCH /staff[/:id]` (A; only the owner manages admins) · `GET|PATCH /reviews[/:id]` · `GET /audit` ·
`GET /newsletter`, `/newsletter.csv` · `GET /system`.

## Reports `/reports` (A)
`GET /overview` · `GET /revenue?months=&plan=` · `GET /revenue/daily?from=&to=&plan=` · `GET /growth?months=`

## Health
`GET /health` — database state and which integrations are configured (no secrets).
