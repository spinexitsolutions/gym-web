# Local setup

## Prerequisites

- Node.js 20.11+ (22 recommended; see `.nvmrc`)
- MongoDB 7 running as a **replica set** (needed for transactions). The included
  `docker-compose.yml` starts one: `docker compose up -d mongo`.
  - MongoDB Atlas works too (it is always a replica set).
  - A standalone `mongod` also works for development, but transactions are disabled and the API logs a warning.

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env   # optional; defaults are fine for local dev
```

Edit `server/.env`:

| Variable | What to set |
| --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/apex_athletics?replicaSet=rs0` with docker compose |
| `JWT_ACCESS_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `PAYMENT_PROVIDER` | `sandbox` for local development without credentials, or `razorpay` with test keys (see [integrations](integrations.md)) |

Everything else has safe defaults. Email is logged instead of sent until `SMTP_HOST` is set.

## 3. Seed content and create the first admin

```bash
npm run seed                    # pages, programs, plans, classes, FAQs, articles…
npm run create-admin            # prompts for name, email and a strong password
```

`npm run create-admin` refuses weak passwords and refuses to run when an admin already exists.
There are **no default credentials**.

Optional, development only:

```bash
npm run seed -- --demo-accounts # demo trainer + member with random passwords printed once
npm run seed -- --reset         # wipe and re-seed content collections (refused in production)
```

Seeded testimonials and transformation stories are created **unpublished** as format examples.
The public site never presents sample data as genuine member data.

## 4. Run

```bash
npm run dev
```

- Website: http://localhost:5173 (Vite proxies `/api` and `/uploads` to the API)
- API: http://localhost:4000, interactive docs at http://localhost:4000/api/docs
- Admin: http://localhost:5173/admin (log in with the admin you created)

## 5. Checks

```bash
npm run typecheck
npm run lint
npm test          # shared + server (in-memory MongoDB replica set) + client
npm run build
```

Server tests use `mongodb-memory-server`, which downloads a `mongod` binary on first run.
To use an existing binary instead: `MONGOMS_SYSTEM_BINARY=/path/to/mongod npm test`.

## Testing payments locally

With `PAYMENT_PROVIDER=sandbox`, checkout opens a clearly labelled **simulated gateway** (no real money).
It produces a payment id and HMAC signature on the server, and the browser then goes through the
same `/payments/verify` endpoint as Razorpay — so signature verification, idempotent activation,
coupon redemption and receipts are all exercised. The server refuses to start with `sandbox` when
`NODE_ENV=production`.

To test the real Razorpay flow, use Razorpay **test mode** keys (`rzp_test_...`) — see [integrations.md](integrations.md).
