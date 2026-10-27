# Aurum Fitness Club — premium gym website & management system (MERN)

A full-stack luxury gym platform: a cinematic public website that the owner edits from an admin dashboard,
plus member accounts, memberships, Razorpay payments, bookings, QR attendance and reports.

> **Status:** built phase by phase. See [docs/CHECKLIST.md](docs/CHECKLIST.md) for exactly what is done and
> what is next. Nothing listed as "next" is presented in the UI as working.

| Layer | Stack |
| --- | --- |
| Frontend | React 18 + Vite, Tailwind CSS, React Router, Framer Motion, React Three Fiber, Lucide, Recharts, React Hook Form + Zod, TanStack Query |
| Backend | Node.js 20+, Express 4, MongoDB + Mongoose 8, JWT in HTTP-only cookies, bcrypt (bcryptjs), Zod validation |
| Services | Cloudinary (media), Razorpay (payments), Nodemailer (email) |

## Quick start

Prerequisites: Node.js 20.11+, and MongoDB 6+ (local, Docker or a free MongoDB Atlas cluster).

```bash
# 1. Install everything (npm workspaces: server + client)
npm install

# 2. Configure the API
cp server/.env.example server/.env
#   then edit server/.env — at minimum set MONGO_URI and JWT_ACCESS_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. (optional) MongoDB in Docker
docker run -d --name aurum-mongo -p 27017:27017 mongo:7

# 4. Demo content + your first admin (no default credentials exist)
npm run seed
npm run create-admin

# 5. Run API (http://localhost:5000/api) and website (http://localhost:5173)
npm run dev
```

The Vite dev server proxies `/api` to the API, so cookies are first-party and no CORS setup is needed locally.
Without SMTP settings, verification and reset emails are **printed to the API console** (with the link) so you
can test every auth flow offline.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (node --watch) + website (Vite) together |
| `npm test` | Server tests + client tests |
| `npm run lint` | ESLint (client) |
| `npm run build` | Production build of the website into `client/dist` |
| `npm start` | Start the API in production mode |
| `npm run seed` | Upsert demo content (`-- --reset` to remove earlier demo items first) |
| `npm run create-admin` | Interactive, secure creation of the owner / admin accounts |

### Tests

```bash
npm test                                         # unit + HTTP tests, no database needed
TEST_MONGO_URI=mongodb://127.0.0.1:27017/aurum_test npm test -w server   # + full API integration tests
```

The integration suite **drops the database named in `TEST_MONGO_URI`** before and after running — never point it
at real data.

## Demo data

`npm run seed` creates clearly labelled sample content: 4 plans, 6 trainers, 9 programs, FAQs, upcoming events,
a gallery and the `WELCOME10` coupon. Sample testimonials are flagged `isDemo` and show a **"Sample content"**
badge on the site. No members, payments or attendance are seeded, so dashboards only ever show real data.
Transformation (before/after) stories are never seeded — they appear only when an admin adds real photos with
recorded member consent.

Photos are royalty-free images from Unsplash ([license](https://unsplash.com/license)) loaded via their CDN
with automatic WebP/AVIF; replace them with your own photography from the admin dashboard before launch.

## Documentation

- [Architecture, folder structure & design system](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE.md)
- [API reference](docs/API.md)
- [Security](docs/SECURITY.md)
- [Third-party services setup](docs/INTEGRATIONS.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Build checklist & testing guide](docs/CHECKLIST.md)
