# Aurum Fitness Club — premium gym website & management system (MERN)

A complete luxury gym platform: a cinematic, admin-editable public website plus memberships, Razorpay payments, PT and class
bookings with waitlists, QR attendance, member/trainer/admin dashboards, notifications, reports and an optional AI fitness
assistant.

| Layer | Stack |
| --- | --- |
| Frontend | React 18 + Vite, Tailwind CSS, React Router, Framer Motion, React Three Fiber, Lucide, Recharts, React Hook Form + Zod, TanStack Query, PWA |
| Backend | Node.js 20+, Express 4, MongoDB + Mongoose 8, JWT in HTTP-only cookies, bcrypt, Zod, node-cron, PDFKit |
| Services | Razorpay (payments), Cloudinary (media), Nodemailer/SMTP (email), Web Push (optional), Anthropic API (optional assistant) |

## Quick start
Prerequisites: Node.js 20.11+, MongoDB 6+ (local, Docker or Atlas).

```bash
npm install
cp server/.env.example server/.env        # set MONGO_URI and JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # → JWT_ACCESS_SECRET
docker run -d --name aurum-mongo -p 27017:27017 mongo:7                    # if you need MongoDB
npm run seed                              # clearly labelled demo content
npm run create-admin                      # first owner account — there are no default credentials
npm run dev                               # website http://localhost:5173 · API http://localhost:5000/api
```
Log in with the owner account → **/admin**. Register a normal account → **/dashboard**. Without Razorpay keys a labelled
**sandbox gateway** lets you complete purchases locally; without SMTP, emails are printed to the API console.

Production in one command: `docker compose up -d --build` (see [deployment](docs/DEPLOYMENT.md)).

## Scripts
| Command | Purpose |
| --- | --- |
| `npm run dev` | API (watch) + website (Vite) |
| `npm run lint` / `npm test` / `npm run build` | Quality gates (CI runs all three) |
| `npm start` | Production API, also serves `client/dist` |
| `npm run seed` | Demo plans, trainers, programs, classes, articles, FAQs, events (`-- --reset` removes earlier demo items) |
| `npm run create-admin` | Owner/admin creation (interactive or `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`; `--role=staff`, `--promote`) |
| `scripts/backup.sh`, `scripts/restore.sh` | MongoDB backup and restore |

## What's included
- **Public site:** cinematic hero (image/video + lazy 3D dumbbell), animated stats, about, facilities, trainers, pricing with
  4 billing periods, programs, consented transformations, testimonials, events, BMI/calorie/workout tools, FAQ, contact + map,
  newsletter, WhatsApp; Memberships (comparison & policies), Programs, Trainers, Schedule, Blog, Events, Contact.
- **Admin:** live KPIs and charts, full website CMS (theme, fonts, logo, hero, every section, SEO) with draft/preview/publish,
  managers for plans, trainers, programs, gallery, testimonials, FAQs, events, announcements, blog and coupons, members,
  memberships, payments & refunds, offline sales, classes & bookings, QR check-in, inquiries, support, reviews, team roles,
  audit log, reports & CSV exports, system status.
- **Member:** membership & renewal checkout, invoices & refunds, PT/class booking with waitlists, rotating QR check-in,
  progress charts, workout plans, challenges, notifications, support, feedback, AI assistant, profile & push settings.
- **Trainer:** schedule, completion/no-show marking, assigned members, workout plan builder, availability.

## Demo data
`npm run seed` creates sample content only: plans, trainers, programs, a two-week class timetable, two articles, FAQs, events,
gallery and coupon `WELCOME10`. Sample testimonials show a **"Sample content"** badge. No members, payments or attendance are
created, so every dashboard figure is real data. Before/after transformations are never seeded; they appear only when an admin
adds photos with recorded member consent. Photos are royalty-free Unsplash images — replace them with your own.

## Documentation
[Architecture & design system](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [API](docs/API.md) ·
[Security](docs/SECURITY.md) · [Integrations](docs/INTEGRATIONS.md) · [Deployment & backups](docs/DEPLOYMENT.md) ·
[Checklist & test guide](docs/CHECKLIST.md)
