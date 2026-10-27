# Third-party services

All keys live in `server/.env`. The app runs without any of them; features that need a key say so clearly.

## MongoDB
Local (`mongodb://127.0.0.1:27017/aurum_gym`), Docker (`docker run -d -p 27017:27017 mongo:7`) or
[MongoDB Atlas](https://www.mongodb.com/atlas): create a free cluster → Database Access (user) → Network Access
(your server IP) → Connect → Drivers, and paste the URI into `MONGO_URI`.

## Cloudinary (images & video)
1. Sign up at cloudinary.com → Dashboard → copy **Cloud name, API key, API secret**.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (and optionally `CLOUDINARY_FOLDER`).
3. Uploads are validated on the server, stored under `<folder>/<area>`, resized to ≤2400 px and served with
   `f_auto,q_auto` (WebP/AVIF). Without keys, upload endpoints return 503 with an explanatory message.

## SMTP / Nodemailer (emails)
Any SMTP provider works (Gmail with an App Password, Zoho, Amazon SES, Brevo, Mailgun…). Set `SMTP_HOST`,
`SMTP_PORT` (587 STARTTLS or 465 with `SMTP_SECURE=true`), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
Without `SMTP_HOST`, emails are logged to the API console including their action link.

## Razorpay (Phase 5)
Dashboard → Settings → API Keys → generate **Key ID / Key Secret** (test mode first) → `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`. Webhooks → add `https://<your-api>/api/payments/webhook` with events
`payment.captured`, `payment.failed`, `refund.processed`, choose a secret → `RAZORPAY_WEBHOOK_SECRET`.

## Google Maps
The contact map uses the keyless Google Maps embed with the admin-entered `contact.mapQuery`. No API key needed.

## WhatsApp
The floating button opens `https://wa.me/<number>` with a prefilled message; set the number (with country code,
digits only) in the CMS.
