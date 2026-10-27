# API reference

Base URL: `/api`. JSON in and out. Successful responses: `{ "success": true, "data": …, "message"?, "meta"? }`.
Errors: `{ "success": false, "message": "…", "details"?: [{ "field", "message" }] }` with a meaningful status
(400 validation, 401 not signed in, 403 forbidden/CSRF, 404, 409 duplicate, 413, 429 rate-limited, 5xx).

**CSRF:** call `GET /auth/csrf` once, then send its token as `X-CSRF-Token` on every POST/PUT/PATCH/DELETE.
Cookies must be included (`credentials: 'include'`). List endpoints accept `page`, `limit` (≤100) and `sort`
where noted and return `meta: { page, limit, total, pages }`.

## Implemented

### Health
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | — | DB status and which integrations are configured (no secrets) |

### Auth — `/auth`
| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| GET | `/csrf` | — | Issues CSRF cookie, returns `{ csrfToken }` |
| POST | `/register` | — | `name, email, password, phone?, referralCode?, acceptTerms:true` → signs in, sends verification email |
| POST | `/login` | — | `email, password`. 5 failures → 15-minute lock (429) |
| POST | `/refresh` | refresh cookie | Rotates refresh token, new access cookie |
| POST | `/logout` | — | Revokes the current session |
| POST | `/logout-all` | user | Revokes every session |
| GET | `/me` | user | `{ user, profile }` |
| POST | `/verify-email` | — | `token` (64 hex, 24 h) |
| POST | `/resend-verification` | user | |
| POST | `/forgot-password` | — | `email` — same response whether or not the account exists |
| POST | `/reset-password` | — | `token, password` (30 min, single use) → revokes all sessions |

### Users — `/users` (signed in)
| Method | Path | Body / notes |
| --- | --- | --- |
| PATCH | `/me` | `name?, phone?` |
| GET | `/me/profile` | user + member profile |
| PATCH | `/me/profile` | dateOfBirth, gender, heightCm, fitnessLevel, fitnessGoals[], address{}, emergencyContact{}, medicalNotes, notificationPrefs{} |
| POST | `/me/avatar` | multipart `file` (JPG/PNG/WebP/AVIF ≤ 8 MB, magic-byte checked) → Cloudinary |
| DELETE | `/me/avatar` | |
| POST | `/me/password` | `currentPassword, newPassword` → signs out other devices |
| POST / DELETE | `/me/deletion-request` | `reason?` / cancel |

### Website settings — `/settings`
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/public` | — | Published settings + active promo banners. Live stats when `stats.source = live` |
| GET | `/draft` | admin | `{ draft, publishedAt, draftUpdatedAt, version, hasUnpublishedChanges }` |
| PATCH | `/draft` | admin | Any subset of the settings tree; deep-merged and fully validated. Audited |
| POST | `/publish` | admin | Copies draft → published. Audited |
| POST | `/discard` | admin | Resets draft to published |

### Public content
| Method | Path | Query |
| --- | --- | --- |
| GET | `/memberships/plans` | — (published, active plans) |
| GET | `/trainers` | `q, specialization, featured, page, limit, sort(order\|experienceYears\|name)`; `meta.specializations` lists filters |
| GET | `/trainers/:slug` | includes the trainer's programs |
| GET | `/programs` | `q, category, difficulty, featured, page, limit, sort` |
| GET | `/programs/:slug` | populated trainers & eligible plans |
| GET | `/reviews/testimonials` | published testimonials |
| GET | `/gallery` | `category, limit` |
| GET | `/faqs` | |
| GET | `/events` | upcoming published events & challenges |
| POST | `/contact` | `name, email, phone?, subject?, interest?, message, source?` + honeypot `website`, `startedAt` |
| POST | `/contact/newsletter` | `email` |

## Planned (see CHECKLIST.md)

`/admin` (CRUD for plans, trainers, programs, testimonials, gallery, FAQs, blog, announcements, coupons, staff,
inquiries, audit log), `/members`, `/memberships` (purchase, renew, cancel), `/payments` (Razorpay order,
verify, webhook, refunds, invoices), `/bookings`, `/classes`, `/attendance` (QR tokens), `/coupons`,
`/notifications`, `/blogs`, `/reports`.
