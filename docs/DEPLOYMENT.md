# Deployment

The API serves the built website itself in production (`NODE_ENV=production` + `client/dist` present), so the simplest
deployment is **one Node process (or one container) behind HTTPS**, with MongoDB Atlas or a MongoDB container.

## Option A — Docker (recommended)
```bash
cp server/.env.example server/.env        # fill in production values (see checklist below)
docker compose up -d --build              # MongoDB + app on port 5000
docker compose exec app node server/src/scripts/seed.js         # optional demo content
docker compose exec app node server/src/scripts/createAdmin.js  # first owner account (interactive)
```
Put a TLS-terminating proxy in front (Caddy, Nginx, Traefik, or your cloud load balancer) and set `COOKIE_SECURE=true`.

Caddy example (automatic HTTPS):
```
yourgym.com {
  reverse_proxy 127.0.0.1:5000
}
```

## Option B — Node on a VM (PM2 or systemd)
```bash
npm ci && npm run build                   # builds client/dist
NODE_ENV=production npm start             # or: pm2 start server/src/server.js --name aurum
```
Nginx:
```nginx
server {
  server_name yourgym.com;
  client_max_body_size 100m;              # video uploads
  location / { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
}
```
`app.set('trust proxy', 1)` assumes exactly one proxy hop; adjust in `server/src/app.js` if you have more (e.g. Cloudflare → Nginx).

## Option C — Separate static host + API host
Build the client with `VITE_API_URL=https://api.yourgym.com npm run build -w @aurum/client`, host `client/dist` on any static
host with an SPA rewrite to `/index.html`, and run the API with `SERVE_CLIENT=false`, `CLIENT_URL=https://yourgym.com`,
`COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (and `COOKIE_DOMAIN=.yourgym.com` if both share a parent domain).
Same-site (Option A/B, or a `/api` rewrite on the static host) is simpler and avoids third-party-cookie restrictions.

## Production checklist
- [ ] `NODE_ENV=production`, strong unique `JWT_ACCESS_SECRET`, `COOKIE_SECURE=true`, correct `CLIENT_URL`
- [ ] `MONGO_URI` points at a replica set / Atlas cluster with backups enabled
- [ ] `npm run create-admin` → owner account; invite staff from **Admin → Team**
- [ ] Razorpay **live** keys + webhook (`/api/payments/webhook`) with `RAZORPAY_WEBHOOK_SECRET` — see INTEGRATIONS.md.
      The sandbox gateway is disabled automatically in production.
- [ ] SMTP configured (verification, resets, receipts, reminders) — check **Admin → System**
- [ ] Cloudinary configured for uploads
- [ ] Replace demo photos, sample testimonials, contact details, GSTIN and policy text; set **SEO → Public website URL**
- [ ] Optional: VAPID keys for push, `ANTHROPIC_API_KEY` for the AI assistant
- [ ] Run one instance with jobs, or set `DISABLE_JOBS=true` on extra instances (jobs also use DB leases)
- [ ] Submit `https://yourgym.com/sitemap.xml` to Google Search Console

## Backup & recovery
- **Atlas:** enable continuous cloud backup (point-in-time restore).
- **Self-hosted:** schedule `scripts/backup.sh` nightly and copy archives off-site:
  ```bash
  # crontab -e
  30 2 * * * MONGO_URI="mongodb://..." BACKUP_DIR=/var/backups/aurum KEEP_DAYS=14 /opt/aurum/scripts/backup.sh >> /var/log/aurum-backup.log 2>&1
  ```
- **Restore:** `MONGO_URI=... ./scripts/restore.sh /var/backups/aurum/aurum-YYYY-MM-DD_HHMM.archive.gz` (asks for confirmation,
  replaces collections). Practise restores on a staging database each quarter.
- Media lives in Cloudinary (its own redundancy); export it periodically with Cloudinary's backup feature if required.
- Recovery order: restore database → deploy the same app version → verify `/api/health` and **Admin → System** → check
  recent payments against the Razorpay dashboard (webhooks retry automatically for 24 hours).

## Monitoring
- Health check: `GET /api/health` (used by the Docker `HEALTHCHECK`).
- **Admin → System** shows integration status, background-job results and the last 50 server errors.
- Logs contain method, path, status and timing only (no bodies or secrets); ship stdout to your log platform.
