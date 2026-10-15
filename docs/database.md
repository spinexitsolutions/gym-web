# Database overview

MongoDB with Mongoose (`server/src/models`). All collections have `createdAt`/`updatedAt`.
Money is stored as **integer minor units (paise)** with a `currency` field (`INR`).

## Accounts

| Collection | Purpose | Key fields / indexes |
| --- | --- | --- |
| `users` | All accounts (admin, trainer, member) | `email` unique; `role`; `permissions[]` (granted to non-admins); `status` (active/suspended/pending); `passwordHash` (bcrypt, 12 rounds, `select:false`); reset/verify token **hashes** with expiry; lockout counters; `qrToken` (unique, rotatable, for check-in) |
| `sessions` | Refresh-token sessions | `tokenHash` unique (SHA-256 of the cookie value); `family` (rotation chain, reuse ⇒ revoke family); TTL index on `expiresAt` |
| `memberprofiles` | Member details | `user` unique; `assignedTrainer` (→ users); goals (subdocs); health notes; `loyaltyPoints`; `referralCode` unique; `referredBy`; `trialUsed`; photo-sharing consent |
| `trainerprofiles` | Trainer public profile + availability | `user` unique; `slug` unique; weekly `availability[]`; `showOnWebsite` |

## Memberships & payments

| Collection | Purpose | Key fields / indexes |
| --- | --- | --- |
| `membershipplans` | Sellable plans | `slug` unique; `priceMinor`; `durationDays`; limits (classes/week, PT sessions); `isTrial`; `active` (plans are archived, never deleted) |
| `memberships` | A member's entitlement period | `user`, `plan`, `planSnapshot` (name/price/duration at purchase); `status` (upcoming/active/expired/cancelled/upgraded/refunded); `startDate`/`endDate`; `source` (online/offline/admin/trial); **unique partial index on `payment`** (one membership per payment); `{user,status,endDate}`, `{status,endDate}` |
| `payments` | Every payment attempt | `provider` (razorpay/sandbox/offline); **unique partial indexes on `orderId`, `providerPaymentId`, `receiptNumber`**; amounts (base/discount/charged); `status`; `verifiedVia`; refund subdocument; `recordedBy` for offline payments |
| `coupons` / `couponredemptions` | Discounts | `code` unique (uppercase); usage/per-user limits; plan restrictions; redemption unique per payment |
| `webhookevents` | Processed webhook ids | unique `{provider, eventId}` |
| `counters` | Receipt number sequences | `receipt-<year>` |

## Training & operations

| Collection | Purpose | Key fields / indexes |
| --- | --- | --- |
| `gymclasses` | Scheduled class sessions | `startsAt/endsAt`; `capacity`, `bookedCount`, `waitlistCount` (atomic counters); `trainer`; `seriesId` for weekly series |
| `bookings` | Class, personal-training and trial bookings | `type`; `status`; `active` flag; **unique partial `{user,gymClass}` where active class booking** (no duplicates); **unique partial `{trainer,startsAt}` for active PT**; guest details for public trial requests |
| `attendances` | Check-ins | **unique `{user, day, gymClass}`** (one general check-in per day; one per class); `method` qr/manual/class |
| `exercises`, `workoutplans`, `workoutlogs` | Exercise library, assigned plans, training history | plans owned by `trainer`, assigned to `member`; templates |
| `progressentries`, `progressphotos` | Body metrics and private photos | photos reference private `mediaassets` |
| `trainernotes` | Notes & follow-up reminders | `{trainer, done, followUpAt}` |
| `notifications` | In-app notifications + delivery log | `{user, createdAt}`; **unique partial `dedupeKey`** (prevents duplicate reminders) |
| `supporttickets` | Member support threads | `user`, `status`, `messages[]` |
| `loyaltytransactions` | Points ledger | unique `key` (idempotent awards) |
| `jobstates` | Scheduled job leases + last result | unique `name` |

## CMS

| Collection | Purpose |
| --- | --- |
| `websitesettings` | Singleton (`key: 'site'`), validated by `siteSettingsSchema` (brand, contact, hours, SEO, notifications, privacy, booking policy, loyalty) |
| `themeconfigurations` | Singleton theme: `draft`, `published`, last 10 published versions |
| `pages` | Page metadata + editable `draft` (title, SEO, ordered `sections[]`) + pointer to the published version |
| `pageversions` | Immutable published snapshots; unique `{page, version}` |
| `mediaassets` | Uploaded images/models: storage driver, key, public URL, responsive variants, dimensions, `visibility` (public/private), `owner`, model review status |
| `programs`, `faqs`, `galleryitems`, `facilities`, `testimonials`, `promotions` | Public content collections (`published`, `order`). Gallery items for member stories require recorded **consent** to be published or served. |
| `blogposts` | Articles (Markdown, rendered without raw HTML), categories, tags, SEO |
| `reviews` | Member reviews; public only after approval |
| `newslettersubscribers`, `contactmessages` | Public forms |
| `auditlogs` | Sensitive admin actions: actor, action, entity, summary, masked diff, coarse IP |

## Transactions

`withTransaction()` (`server/src/config/db.ts`) wraps operations that must stay consistent:
payment capture + membership activation + coupon redemption + referral reward, class booking + seat claim,
page publishing (version + pointer). Where transactions are unavailable (standalone dev MongoDB), the same
code paths remain safe because they rely on atomic conditional updates and unique indexes.
