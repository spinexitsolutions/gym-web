# Database schema (MongoDB / Mongoose)

All money is stored as **integer paise** (₹1 = 100 paise). Timestamps (`createdAt`, `updatedAt`) on every model.
Related data uses `ObjectId` references rather than copies.

| Collection | Purpose | Key fields | Indexes |
| --- | --- | --- | --- |
| **User** | Login account for every role | name, email (unique), password (bcrypt, `select:false`), role, status, avatar, emailVerified, hashed verify/reset tokens + expiry, failed-login lockout, deletionRequestedAt | email unique, role, status, text(name,email) |
| **Session** | Refresh-token rotation | user, tokenHash (unique), family, expiresAt, revokedAt | TTL on expiresAt, user, family |
| **MemberProfile** | Member details (1:1 User) | dateOfBirth, gender, address, heightCm, fitnessGoals[], fitnessLevel, emergencyContact, medicalNotes, referralCode (unique), referredBy→User, assignedTrainer→Trainer, notificationPrefs | user unique, referralCode unique sparse |
| **ProgressEntry** | Weight & measurements | user, date, weightKg, bodyFatPct, measurements{} | user+date |
| **MembershipPlan** | Basic/Standard/Premium/Elite | name, slug, tier, benefits[], comparison[], pricing[{period, pricePaise, discountPercent}], joiningFeePaise, limits{}, isFeatured, isActive, status, order | slug unique, status+isActive+order |
| **Membership** | A member's plan period | user, plan, period, startDate, endDate, status, amountPaidPaise, payment, renewalOf, cancellation{}, remindersSent[] | user+status+endDate, status+endDate |
| **Payment** | Razorpay / offline payments | user, plan, membership, base/joining/discount/amount paise, coupon, status, razorpayOrderId/PaymentId (unique), invoiceNumber (unique), refund{} | user+createdAt, status+paidAt, plan+paidAt |
| **Trainer** | Public profile (+ optional login) | user, name, slug, title, photo, bio, specializations[], qualifications[], certifications[], experienceYears, availability[{dayOfWeek,start,end}], ptPricePaise, rating | slug unique, isActive+order, specializations, text |
| **WorkoutProgram** | Public programs | title, slug, category (9 types), difficulty, durationWeeks, sessionsPerWeek, image, trainers[], eligiblePlans[] | slug unique, category, isActive+order |
| **WorkoutPlan** | Personal plan from a trainer | member, trainer, program, days[{label, exercises[]}], status | member+status |
| **ClassSchedule** | Group class instance | title, program, trainer, startAt, endAt, capacity, bookedCount, waitlistLimit, eligiblePlans, status, seriesId | startAt+status, trainer+startAt |
| **Booking** | PT or class booking / waitlist | member, type, trainer, classSchedule, startAt, endAt, status, waitlistedAt, cancel/reschedule fields | member+startAt, trainer+startAt+status, unique live booking per member+class |
| **Attendance** | Check-in/out | member, day (YYYY-MM-DD), checkInAt, checkOutAt, method, recordedBy, corrections[] (audit) | **unique member+day** (duplicate prevention) |
| **Coupon** | Promo & referral codes | code (unique), discountType, value, maxDiscountPaise, validity, usageLimit, usedCount, perUserLimit, applicablePlans, owner | code unique |
| **Testimonial** | Homepage stories | name, quote, rating, photo, consentConfirmed, isDemo, isPublished | isPublished+order; publishing requires consent |
| **Review** | Member ratings | user, targetType, target, rating, comment, status | unique user+target |
| **Gallery** | Photos & transformations | category, image, beforeImage/afterImage, consentConfirmed, isDemo, isPublished | category+isPublished+order; transformations need consent |
| **BlogPost** | Articles | title, slug, content (Markdown), coverImage, tags, author, status, publishedAt, seo | slug unique, status+publishedAt, text |
| **ContactInquiry** | Contact form leads | name, email, phone, message, interest, source, status, assignedTo, notes[], ipHash | status, createdAt |
| **Notification** | In-app notifications | user, type, title, body, link, readAt | user+readAt+createdAt, TTL 180 days |
| **SupportTicket** | Member support | user, subject, category, priority, status, messages[{author, body, internal}] | status, user+createdAt |
| **WebsiteSettings** | CMS singleton | key, draft, published, publishedAt/By, version | key unique |
| **Announcement** | Notices & promo banners | title, body, audience, showAsBanner, link, startsAt/endsAt, status | status+audience+dates |
| **AuditLog** | Admin action trail | actor, action, entity, entityId, summary, changes (redacted), ip | createdAt, entity+entityId, actor |
| **Faq** | FAQs | question, answer, category, isPublished, order | isPublished+order |
| **Challenge** | Events & fitness challenges | title, slug, kind, dates, metric, participants[{user, score}] | slug unique, isPublished+startDate |
| **NewsletterSubscriber** | Newsletter | email (unique), status, source | email unique |

`WebsiteSettings.draft/published` are validated by `server/src/validators/settings.validator.js` (brand, theme,
announcement bar, hero, stats, about, facilities, certifications, safety, contact & hours, social, footer,
newsletter, membership policies, section toggles, SEO).
