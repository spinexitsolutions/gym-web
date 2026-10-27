# Third-party services

All keys live in `server/.env`. The app runs without any of them; features that need a key explain what is missing
(and **Admin → System** shows what is configured).

## MongoDB
Local (`mongodb://127.0.0.1:27017/aurum_gym`), Docker (`docker run -d -p 27017:27017 mongo:7`) or
[MongoDB Atlas](https://www.mongodb.com/atlas): create a cluster → Database Access (user) → Network Access (server IP) → Connect →
Drivers, then paste the URI into `MONGO_URI`.

## Razorpay (membership payments)
1. Dashboard → Settings → API Keys → generate **Key ID / Key Secret** (start in Test Mode) → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Settings → Webhooks → add `https://yourgym.com/api/payments/webhook`, events `payment.captured`, `payment.failed`,
   `refund.processed`, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Enable **automatic capture** (Settings → Payment capture) so payments are captured immediately.

How it works: the server prices the order (plan, period, joining fee, coupon), creates a Razorpay order, and the browser opens
Razorpay Checkout. A payment is marked paid only after the server verifies the HMAC signature **and** fetches the payment from
Razorpay to confirm it is captured for the same order and amount; the webhook covers closed browsers. Processing is idempotent,
invoice numbers are gap-free, receipts are emailed with a PDF. Card data never reaches this server.

**Sandbox:** without Razorpay keys and outside production, a clearly labelled test gateway lets you complete checkout locally
(`PAYMENT_SANDBOX=false` disables it). It can never run when `NODE_ENV=production`.

## Cloudinary (images & video)
Dashboard → copy Cloud name, API key, API secret → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Uploads are type/size/magic-byte checked, stored under `CLOUDINARY_FOLDER/<area>`, resized to ≤2400 px and served with
`f_auto,q_auto` (WebP/AVIF). Admins can alternatively paste a licensed image URL.

## SMTP / Nodemailer (email)
Any provider (Gmail App Password, Zoho, Amazon SES, Brevo, Mailgun…): `SMTP_HOST`, `SMTP_PORT` (587, or 465 with
`SMTP_SECURE=true`), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Without `SMTP_HOST`, emails are printed to the API console with their
links. Emails: verification, password reset/changed, invites, inquiry acknowledgement, receipts with invoice PDF, renewal
reminders (7 days and 1 day), expiry notices, booking changes, refunds, support replies, announcements.

## Web push (optional)
`npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@yourgym.com`.
Members opt in from **Profile & settings → Push notifications**; nothing is requested without that click.

## AI fitness assistant (optional)
Create an API key at console.anthropic.com → `ANTHROPIC_API_KEY`. `ASSISTANT_MODEL` defaults to `claude-opus-5-5`; answers use
low effort for speed and cost. Signed-in users get 20 questions per hour. The system prompt restricts the assistant to general
fitness guidance, forbids diagnoses, medication or extreme-diet advice, and tells users with pain or medical conditions to see a
professional. Every answer is shown with a disclaimer. Safety-declined requests fall back automatically via the API's
`fallbacks: "default"` option.

## Google Maps & WhatsApp
The map uses the keyless Google Maps embed with **Website → Contact → Google Maps search text**. The WhatsApp button opens
`wa.me/<number>` with the configured message.
