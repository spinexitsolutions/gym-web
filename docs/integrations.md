# Integrations

Every integration is optional at boot. When one is not configured the related feature degrades
clearly (for example "online payments are not available — pay at the front desk"), and
**Admin → Settings → System status** shows what is configured. Secret values are never sent to the browser.

## Razorpay (membership payments)

1. Create a Razorpay account and switch the dashboard to **Test mode**.
2. Settings → API Keys → generate a key. Put them in `server/.env`:
   ```
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=xxx          # server only — never in client/.env
   ```
3. Settings → Webhooks → add `https://<your-domain>/api/v1/payments/webhook/razorpay` with a secret, and
   subscribe to `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
   ```
   RAZORPAY_WEBHOOK_SECRET=xxx
   ```
   For local webhook testing use a tunnel (e.g. `cloudflared tunnel --url http://localhost:4000`).
4. Use Razorpay's test cards/UPI ids to pay.

### How the flow is secured

| Step | Where | Notes |
| --- | --- | --- |
| Price | server | `POST /payments/checkout` loads the plan and coupon from MongoDB. Amounts from the browser are ignored. |
| Order | server → Razorpay | `POST /v1/orders` with `payment_capture=1`; a `Payment` document (status `created`) stores the order id. |
| Checkout | browser | Razorpay Checkout opens with the public key id only. |
| Verify | server | `POST /payments/verify` checks `HMAC_SHA256(order_id + "|" + payment_id, key_secret)`, then **fetches the payment from Razorpay** and checks order id, status and amount. |
| Webhook | server | Raw-body HMAC (`X-Razorpay-Signature`) verified with the webhook secret; each `X-Razorpay-Event-Id` is processed once (`WebhookEvent` unique index). |
| Activation | server | An atomic status transition (`created/pending → captured`) inside a transaction guarantees exactly one membership per payment, even if the browser callback and webhook race. A unique index on `Membership.payment` is a second guard. |

Failed, dismissed and pending payments are recorded; unpaid orders expire after `PAYMENT_ORDER_TTL_MIN`.
Refunds are issued from **Admin → Payments** via the Razorpay refunds API and updated by refund webhooks.
Card details never touch our servers.

## Email (SMTP)

Any SMTP provider works (Amazon SES, Postmark, SendGrid SMTP, Google Workspace, Mailpit for local testing):

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=Apex Athletics <no-reply@your-domain.com>
```

Local testing: `docker compose --profile mail up -d mailpit`, then `SMTP_HOST=localhost SMTP_PORT=1025` and open http://localhost:8025.
Emails sent: verification, password reset, booking/payment/renewal notifications, trial confirmations,
admin alerts. Delivery results are stored on each `Notification` (sent / failed / skipped) with one retry.

## WhatsApp (approved Business provider)

WhatsApp messages are only sent when **all** of these are true: a provider is configured, WhatsApp is enabled in
Admin → Settings → Notifications, and the member opted in (Settings → notification preferences) with a phone number.

- **Meta WhatsApp Cloud API**: `WHATSAPP_PROVIDER=meta`, `WHATSAPP_META_TOKEN`, `WHATSAPP_META_PHONE_NUMBER_ID`.
  Business-initiated messages must use an **approved template**. Create a template named `apex_notification` with a
  single body variable `{{1}}`; the API sends the notification text as that variable.
- **Twilio**: `WHATSAPP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (an approved sender).

## Media storage

- **Local** (default): files go to `server/uploads/public` (served at `/uploads/public/...` with `nosniff` and a
  restrictive CSP) and `server/uploads/private` (never served statically). Use a persistent volume in production.
- **Cloudinary**: `STORAGE_DRIVER=cloudinary` plus `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
  Public images use normal delivery; private progress photos use `authenticated` delivery and are served through
  short-lived signed URLs after the API's ownership check.

Uploads are validated by magic bytes (not the browser's MIME type), extension, size (`MAX_IMAGE_MB`) and
dimensions; images are re-encoded to WebP (which strips EXIF/GPS metadata) with 480/1024/1920 px variants.
SVG uploads are rejected. 3D models: see [3d.md](3d.md).

## Google Maps

The location section uses a Google Maps **embed URL** (no API key, no third-party script). Paste one from
Google Maps → Share → Embed a map into Admin → Settings → Contact & location. Only
`https://www.google.com/maps/embed?...` URLs are accepted.
