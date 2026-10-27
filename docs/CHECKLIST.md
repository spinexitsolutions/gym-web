# Build checklist & testing guide

All seven phases are implemented. ✅ = frontend + backend + database + validation in place.

| Phase | Status | Scope |
| --- | --- | --- |
| 1. Architecture & setup | ✅ | Workspaces, env validation, `.env.example`, docs |
| 2. Public website | ✅ | Home (all sections), About, Memberships, Programs, Trainers, Schedule, Blog, Events, Contact, 404; dark/light theme, SEO, JSON-LD, sitemap, 3D hero |
| 3. Models, APIs, auth, RBAC | ✅ | 30 models, JWT cookies with rotation, CSRF, roles, profile management |
| 4. Admin dashboard & CMS | ✅ | KPIs/charts, website CMS with draft/preview/publish, plans, trainers, programs, gallery, testimonials, FAQs, events, announcements, blog, coupons, team roles, audit log, system status |
| 5. Members, memberships, payments, bookings, attendance | ✅ | Member dashboard, Razorpay checkout + webhook + invoices + refunds, offline payments, PT & class booking with waitlists, QR attendance |
| 6. Notifications, reports, advanced features, hardening | ✅ | In-app/email/push notifications, reminders, reports & CSV, challenges & leaderboard, reviews, referral rewards, PWA, AI assistant, CSP, rate limits |
| 7. Testing, deployment, docs | ✅ | Unit, HTTP, component and MongoDB integration tests, CI, Dockerfile/compose, backup scripts, deployment guide |

## Advanced features (spec §7)
| # | Feature | Where |
| --- | --- | --- |
| 1 | QR entry & attendance | Member → Check-in QR · Admin → Check-in (camera scanner) |
| 2–3 | Expiry & renewal reminders | `jobs/tasks.js` (7-day, 1-day, expiry) |
| 4–6 | PT booking, group classes, waitlists | Member → Book · Admin → Classes / Bookings |
| 7 | Coupons & referrals | Admin → Coupons · referral code at sign-up → automatic reward coupon |
| 8 | Workout & goal tracking | Member → Progress / Workout plans · Trainer → plan builder |
| 9 | BMI & calorie tools | Homepage tools |
| 10 | Challenges & leaderboard | Admin → Events · `/events/:slug` |
| 11 | Feedback & ratings | Member → Feedback · Admin → Reviews |
| 12–13 | PDF invoices & email receipts | Payments pages, receipt email with PDF |
| 14 | Search & filtering | Trainers, programs, blog, every admin table |
| 15–16 | PWA & optional push | `manifest.webmanifest`, `sw.js`, Profile → Push notifications |
| 17 | Multi-role access | owner/admin/staff/trainer/member (server-enforced) |
| 18 | Analytics & exports | Admin → Overview / Reports, CSV everywhere |
| 19 | Spam protection | Honeypot, timing, link heuristic, IP-hash throttle, rate limits |
| 20 | Backup & recovery | `scripts/backup.sh`, `scripts/restore.sh`, DEPLOYMENT.md |
| 21 | Accessibility | Skip links, focus traps, labelled controls, keyboard tabs/sliders, reduced motion |
| 22 | SEO | Per-page meta, canonical, Open Graph, JSON-LD, sitemap, robots |
| 23 | Rate limiting & monitoring | express-rate-limit, audit log, error log, Admin → System |
| 24 | AI fitness assistant | Member → AI assistant (requires `ANTHROPIC_API_KEY`) |

## Automated tests
```bash
npm run lint && npm test && npm run build
TEST_MONGO_URI=mongodb://127.0.0.1:27017/aurum_test npm test -w server   # + 19 MongoDB end-to-end tests
```
GitHub Actions (`.github/workflows/ci.yml`) runs lint, all tests against a MongoDB service, and the build on every push.

## Manual test script
Start MongoDB, then `npm run seed && npm run create-admin && npm run dev` (website :5173, API :5000). Without SMTP, email links
are printed in the API console.

| Area | Steps | Expected |
| --- | --- | --- |
| CMS | Admin → Site content → Homepage hero → edit title → Save draft → Preview draft → Publish | Preview shows the change with a blue banner; public site changes only after Publish |
| Theme | Brand & theme → change accent colour & heading font → Publish | Whole site and dashboards adopt the new colour/font |
| Plans | Admin → Membership plans → edit Premium price | Pricing cards and checkout use the new price |
| Sign-up & verify | Register → open the console link | Email verified; checkout unlocked |
| Purchase | Member → Membership → choose plan, coupon `WELCOME10` → Pay | Sandbox dialog (no keys) or Razorpay test checkout → membership active, receipt + invoice PDF |
| Renewal | Pay again while active | New period starts when the current one ends; no joining fee |
| Offline sale | Admin → Members → member → Record payment (cash) | Membership active, invoice issued, audit entry |
| Refund | Member requests refund → Admin → Payments → refund | Status refunded; Razorpay refund for online payments |
| PT booking | Member → Book → trainer → slot | Booked; slot disappears for others; trainer sees it in `/trainer` |
| Classes | Admin → Classes → Weekly series; book as two members with capacity 1 | Second member waitlisted; promoted when the first cancels (notification) |
| Check-in | Member → Check-in QR; Admin → Check-in → scan with a phone/webcam | Check-in, then check-out on the next scan after 5 min; duplicates rejected |
| Expiry reminders | Admin → Memberships → set an end date 6 days ahead → run `expiry-reminders` (wait for 10:00 or call the task) | Reminder email + notification, sent once |
| Support | Member opens ticket; staff replies with an internal note and a reply | Member sees only the reply |
| Reports | Admin → Overview / Reports | KPIs and charts reflect the above activity; CSV exports download |
| RBAC | As staff, open `/admin/website`; as member, open `/admin` | Staff sees no website menu (API returns 403); member is redirected to `/dashboard` |
| PWA | Production build → open on a phone → "Add to Home screen" | Installs with icon and shortcuts; offline page when disconnected |
