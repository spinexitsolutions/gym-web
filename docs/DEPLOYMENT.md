# Deployment

Recommended: serve the website and API from the **same site** so cookies stay first-party.

## Option A — one domain behind a reverse proxy (recommended)
1. `npm ci && npm run build` → static site in `client/dist`.
2. Run the API: `NODE_ENV=production npm start` (use PM2 or systemd), with `server/.env` containing production
   values, `COOKIE_SECURE=true`, `CLIENT_URL=https://yourgym.com`.
3. Nginx: serve `client/dist` at `/` with SPA fallback (`try_files $uri /index.html`), proxy `/api/` to
   `http://127.0.0.1:5000`, enable HTTPS (Let's Encrypt).

## Option B — static host + API host
- Website on Vercel/Netlify/Cloudflare Pages (build `npm run build -w client`, output `client/dist`, SPA
  rewrite to `/index.html`). Proxy/rewrite `/api/*` to the API so requests remain same-site; or set
  `VITE_API_URL=https://api.yourgym.com` with `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` and
  `COOKIE_DOMAIN=.yourgym.com`.
- API on Render/Railway/Fly/EC2 with Node 20+, `npm ci --omit=dev -w server`, start `npm start`.
- Database on MongoDB Atlas (enable backups).

## Production checklist
- Strong unique `JWT_ACCESS_SECRET`; `NODE_ENV=production`; `COOKIE_SECURE=true`; correct `CLIENT_URL`.
- `npm run seed` only if you want demo content; then `npm run create-admin` to create the owner.
- Replace demo photos, sample testimonials, placeholder contact details and the policy texts in the CMS.
- Configure SMTP, Cloudinary and Razorpay (live keys + webhook) — see INTEGRATIONS.md.
- Backups: Atlas continuous backup or a nightly `mongodump --uri "$MONGO_URI" --gzip --archive=backup-$(date +%F).gz`
  to off-site storage; test `mongorestore` regularly (full backup/recovery guide in Phase 7).
