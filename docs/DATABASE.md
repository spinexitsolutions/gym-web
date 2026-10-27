# Database schema (MongoDB / Mongoose)

All money is **integer paise** (₹1 = 100 paise). Every model has `createdAt`/`updatedAt` unless noted. Relations are `ObjectId`
references; no data is duplicated except intentional snapshots (e.g. a payment keeps the amounts it was charged).

| Collection | Purpose | Key fields | Indexes / constraints |
| --- | --- | --- | --- |
| **User** | Account for every role | name, email, password (bcrypt, hidden), role (owner/admin/staff/trainer/member), status, avatar, emailVerified, hashed verify/reset tokens, lockout fields, deletion request | email unique, role, status, text |
| **Session** | Refresh-token rotation | user, tokenHash, family, expiresAt, revokedAt | tokenHash unique, TTL |
| **MemberProfile** | Member details (1:1) | DOB, gender, address, height, goals, level, emergency contact, medical notes, referral code, referredBy, assignedTrainer, notificationPrefs | user unique, referralCode unique |
| **ProgressEntry** | Weight & measurements | user, date, weightKg, bodyFatPct, measurements | user+date |
| **MembershipPlan** | Basic → Elite | slug, tier, benefits, comparison rows, pricing[period, pricePaise, discountPercent], joiningFeePaise, limits, status, isActive | slug unique |
| **Membership** | A paid/assigned period | user, plan, period, start/endDate, status (pending/active/expired/cancelled/suspended), payment, renewalOf, assignedBy, cancellation, remindersSent | user+status+endDate, status+endDate |
| **Payment** | Online & offline payments | amounts (base, joining, discount, total), coupon, status, method, Razorpay ids, invoiceNumber, refund, recordedBy | Razorpay ids & invoice unique |
| **Trainer** | Public profile + optional login | slug, photo, bio, specialisations, qualifications, certifications, availability[day,start,end], session length, PT price, rating | slug unique, user unique |
| **WorkoutProgram** | Programs | category (9), difficulty, duration, image, trainers[], eligiblePlans[] | slug unique |
| **WorkoutPlan** | Coach-written plan | member, trainer, program, days[label, exercises[]] | member+status |
| **ClassSchedule** | Group class instance | trainer, program, start/end, capacity, bookedCount, waitlistLimit, eligiblePlans, status, seriesId | startAt+status, trainer+startAt |
| **Booking** | PT or class seat | member, type, trainer, classSchedule, start/end, status (booked/waitlisted/cancelled/completed/no_show), waitlistedAt | **unique live booking per member+class**, **unique booked PT per trainer+start** |
| **Attendance** | Visit | member, day (gym-local), checkIn/Out, method, recordedBy, corrections[], lastTokenId | **unique member+day** |
| **Coupon** | Promo/referral codes | code, kind, discountType, value, caps, validity, usage limits, applicablePlans, owner | code unique |
| **Testimonial** / **Gallery** | Stories & photos | consentConfirmed, isDemo, isPublished | publish blocked without consent |
| **Review** | Ratings | user, targetType, target, rating, status | unique per user+target |
| **BlogPost** | Articles (Markdown) | slug, content, tags, status, publishedAt, seo | slug unique, text |
| **ContactInquiry** | Leads | contact info, interest, status, notes, ipHash | status, createdAt |
| **Notification** | In-app | user, type, title, body, link, readAt | TTL 180 days |
| **SupportTicket** | Support threads | user, subject, category, priority, status, messages[internal flag] | status, user |
| **WebsiteSettings** | CMS singleton | draft, published, version | key unique |
| **Announcement** | Banners & broadcasts | audience, showAsBanner, link, schedule, status, deliveredAt | |
| **Challenge** | Events & challenges | kind, dates, metric (none/attendance/manual), participants[user, score] | slug unique |
| **Faq**, **NewsletterSubscriber** | | | |
| **AuditLog** | Admin actions | actor, action, entity, entityId, summary, redacted changes, ip | createdAt, entity, actor |
| **Counter** | Gap-free invoice sequence | `_id`, seq | |
| **SystemState** | Job leases & last results | key, lockedUntil, lastRunAt, lastResult, lastError | key unique |
| **ErrorLog** | Recent 5xx errors (capped 5 MB) | method, path, message, stack | capped |
| **PushSubscription** | Web-push endpoints (after consent) | user, endpoint, keys | endpoint unique |
