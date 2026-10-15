# Security model

## Authentication
- Passwords: bcrypt (12 rounds); policy ≥10 chars with letters and digits; timing-equalised login for unknown emails.
- Lockout: 5 failed logins ⇒ 15-minute lock. Per-IP rate limits on auth (`AUTH_RATE_LIMIT`), public forms and uploads.
- Sessions: short-lived JWT access cookie (`apex_at`, 15 min, `HttpOnly`, `SameSite=Lax`, `Secure` in production) +
  opaque refresh cookie (`apex_rt`, `Path=/api/v1/auth`). Only SHA-256 hashes of refresh tokens are stored.
  Refresh tokens rotate on every use; replaying a rotated token revokes the entire session family.
  Password reset / change and suspension revoke all sessions.
- The user's role, permissions and status are loaded from MongoDB on every request — a role in a token or request body is never trusted.
- Public registration can only create `member` accounts. The first admin is created with `npm run create-admin` (no default credentials).

## Authorization
- Roles: `admin` (all permissions), `trainer`, `member`. Fine-grained permissions (e.g. `payments:read`, `cms:write`)
  can be granted to staff in Admin → Staff & permissions; every admin route checks `requirePermission(...)` server-side.
- Ownership: member data (progress, photos, workout logs, receipts, tickets, bookings) is accessible only to the member,
  staff with `members:read`, or the trainer the member is **assigned** to (`services/access.service.ts`).
  Trainers never receive payment data. Private progress photos are visible to a trainer only if the member opts in.
- Not-found is returned instead of forbidden where revealing existence would leak information.

## CSRF
Double-submit token: `apex_csrf` cookie + `X-CSRF-Token` header required on every non-GET API request
(webhooks excluded — they are signature-verified). Combined with `SameSite=Lax` and a strict CORS allowlist (`CLIENT_URL`).

## Input & output handling
- Every request body/query is parsed by a strict zod schema (unknown keys stripped, types coerced), so user input can never
  become a MongoDB operator object. Regex search input is escaped.
- CMS links are restricted to relative paths, anchors, http(s), mailto and tel (`javascript:`/`data:` rejected).
  Theme colours must be `#rrggbb`; fonts come from an allowlist. Markdown is rendered without raw HTML; no `dangerouslySetInnerHTML`.
- CSV exports neutralise spreadsheet formula injection.
- Helmet security headers with a CSP that only allows Razorpay Checkout, Google Fonts and Google Maps embeds.

## Payments
See [integrations.md](integrations.md#how-the-flow-is-secured). Never trusts browser prices or success callbacks;
signatures verified with constant-time comparison; webhook events deduplicated; activation is idempotent.

## Files
Magic-byte detection, extension allowlist, size/dimension limits, re-encoding (strips metadata), random file names,
no SVG, `nosniff` + `default-src 'none'` CSP on served uploads, private files only via authenticated ownership-checked streams.
3D models: header/length/JSON validation, embedded resources only, complexity limits, admin approval before use.

## Privacy & logging
- Logs redact cookies, authorization headers, CSRF tokens, signatures and password/token fields; request logs record
  method, path and status only. Email addresses are masked in delivery logs; audit logs store coarse IPs.
- Public endpoints expose only published content and aggregate statistics. Member stories/before-after images need recorded consent.
- Audit log for sensitive staff actions (payments, refunds, membership changes, role changes, CMS publishing, exports).

## Production checklist
- `NODE_ENV=production`, `COOKIE_SECURE=true` (enforced), HTTPS everywhere, `TRUST_PROXY` set correctly behind a proxy.
- Strong unique `JWT_ACCESS_SECRET`; rotate by deploying a new value (forces re-login).
- MongoDB replica set/Atlas with authentication and network restrictions; regular backups.
- Remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment after creating the admin.
- `PAYMENT_PROVIDER=razorpay` with live keys only after end-to-end testing in Razorpay test mode.
