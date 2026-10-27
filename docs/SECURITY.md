# Security

| Requirement | Implementation |
| --- | --- |
| Password hashing | bcrypt (bcryptjs, cost 12). Passwords are `select:false` and never serialised |
| Auth cookies | HTTP-only access (15 min) + refresh (7 d, path `/api/auth`) cookies; `Secure` via `COOKIE_SECURE`, `SameSite` via `COOKIE_SAMESITE` |
| Session theft | Refresh tokens stored as SHA-256 hashes, rotated on every use, reuse revokes the family; password change/reset revokes all sessions and invalidates older JWTs |
| CSRF | Double-submit cookie + `X-CSRF-Token` header on all unsafe methods (payment webhook exempt; it is signature-verified) |
| CORS | Allow-list from `CLIENT_URL`, credentials on, limited methods/headers |
| Headers | helmet defaults (HSTS, nosniff, frameguard, …); `x-powered-by` removed |
| Input | Zod schemas on every body/query/param (unknown keys stripped), `$`/`.`/`__proto__` keys removed, JSON body ≤ 1 MB, CMS URLs restricted to http(s)/site paths |
| Rate limiting | 600 req/15 min per IP on the API, 20/15 min on auth endpoints, 10/hour on contact & newsletter |
| Brute force | Account lockout after 5 failed logins; generic error messages; same response for unknown emails on reset |
| Tokens | Verification (24 h) and reset (30 min) tokens are random 256-bit values stored only as hashes, single use |
| Uploads | Memory storage, MIME allow-list, size limits, magic-byte verification, Cloudinary storage (no local execution) |
| RBAC | `authenticate` + `authorize(...roles)` on the server; owners pass all staff checks. Frontend guards are UX only |
| Audit | `AuditLog` for admin actions with automatic redaction of password/token/secret fields |
| Logging | Request logs contain method, path, status and timing only — no bodies, cookies or query strings. Env validation errors never print values |
| Spam | Honeypot, minimum fill time, link-count heuristic, per-IP-hash throttling (IPs stored hashed) |
| Secrets | Only in environment variables; `.env.example` contains placeholders; `.env` is git-ignored |
| Payments | Server-side pricing; HMAC signature check **and** Razorpay API confirmation of order/amount/status; signed webhook on the raw body; idempotent completion; card data never reaches this server; sandbox impossible in production |
| QR check-in | 60-second JWTs with a dedicated audience (session tokens cannot be replayed as QR codes), no personal data, replay and duplicate-visit protection, unique member+day index |
| Bookings | Atomic seat reservation, unique indexes against double booking, ownership checks on cancel/reschedule |
| Content Security Policy | Strict CSP: scripts only from self and Razorpay Checkout; frames only Razorpay and Google Maps; `object-src 'none'`; Markdown rendered without raw HTML |
| Privacy | Medical notes visible only to the member, admins/staff and their assigned trainer; IPs stored hashed for spam control; account deletion anonymises personal data while keeping legally required financial records; unverified accounts without purchases are removed after 30 days |
| CSV exports | Formula-injection protection (cells starting with = + - @ are escaped); exports are admin-only and audited |
| Monitoring | 5xx errors captured (without request bodies) for Admin → System; health endpoint |
