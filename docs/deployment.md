# Deployment

The recommended topology is a **single origin**: the Node API also serves the built client (`SERVE_CLIENT=true`),
so auth cookies are first-party and CORS is not needed for the browser.

## Option A — Docker

```bash
docker build -t apex-athletics .
docker run -d --name apex -p 4000:4000 \
  --env-file server/.env.production \
  -v apex-uploads:/app/server/uploads \
  apex-athletics
```

Put a TLS-terminating reverse proxy (Caddy, Nginx, a cloud load balancer) in front and set `TRUST_PROXY=1`.

## Option B — Node directly

```bash
npm ci
npm run build                     # builds server/dist and client/dist
cd server && NODE_ENV=production SERVE_CLIENT=true node dist/index.js
```

Use a process manager (systemd, PM2) and a persistent `server/uploads` directory (or Cloudinary).

## Option C — separate static hosting

Host `client/dist` on a CDN and the API elsewhere. Then:
- set `VITE_API_URL=https://api.example.com` at client build time,
- set `CLIENT_URL=https://www.example.com` (CORS allowlist) and `COOKIE_DOMAIN=.example.com` on the API,
- configure the CDN to rewrite unknown paths to `index.html` (SPA) and proxy `/sitemap.xml` + `/robots.txt` to the API.

## Production environment

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas / replica set connection string |
| `PUBLIC_SITE_URL`, `CLIENT_URL` | your https origin |
| `JWT_ACCESS_SECRET` | long random secret |
| `COOKIE_SECURE` | `true` (required) |
| `TRUST_PROXY` | number of proxies in front (usually `1`) |
| `PAYMENT_PROVIDER` | `razorpay` (`sandbox` is refused in production) |
| `RAZORPAY_*` | live keys + webhook secret |
| `SMTP_*`, `EMAIL_FROM` | production mail provider |
| `STORAGE_DRIVER` | `local` with a persistent volume, or `cloudinary` |

After first deploy:

```bash
cd server && node dist/scripts/seed.js         # optional starter content
cd server && node dist/scripts/createAdmin.js  # interactive, or via ADMIN_BOOTSTRAP_* env vars once
```

## Scaling

- The API is stateless; run several instances behind the load balancer.
- Scheduled jobs use MongoDB lease locks (`jobstates`), so only one instance runs each job at a time.
  You may also set `JOBS_ENABLED=false` on all but one instance.
- Rate limits are in-memory per instance; for strict global limits add a shared store (e.g. Redis) to `express-rate-limit`.

## SEO notes

The site is a client-rendered SPA with per-page titles, meta descriptions, canonical URLs, Open Graph tags and
JSON-LD from the CMS, plus a dynamic `/sitemap.xml` and `/robots.txt`. Google renders JavaScript, but if you need
social-preview cards for every page or faster first paint, add prerendering (e.g. a prerender service at the proxy)
— the content APIs are public and cacheable.
