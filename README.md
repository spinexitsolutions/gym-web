# MONOLITH — Gym website + Admin (CRM & CMS)

A demo-ready gym website built with **Next.js 16**, **Tailwind CSS v4**, **Motion** and **Lenis**.
Mobile-first, animation-heavy, and fully controlled from a built-in admin panel.

## Run it

```bash
npm install
npm run dev
```

- Website → http://localhost:3000
- Admin → http://localhost:3000/admin (`admin@monolith.club` / `monolith123`)

Copy `.env.example` to `.env.local` and set your own admin password and secret before deploying.

## What's inside

**Website**
- Intro animation — 3 styles (Counter, Word flash, Monolith), set from the admin
- "Island" navbar — a single black capsule: bottom of the screen on phones (thumb zone), floating top on desktop, with a scroll-progress ring, live section name, and a menu that morphs open
- Hero that opens from a rounded window to full-bleed, masked headline reveal, live "Open now" badge
- **Load the bar** — house rules told as a barbell: scroll loads plates, weight counter climbs 20 → 160 kg
- Pinned horizontal-scroll programs, an Apple-style full-screen image reveal, coaches, day-tab schedule,
  pricing with monthly/yearly toggle, BMI calculator, testimonial marquees, bento gallery with lightbox, FAQ
- Free-trial form → goes straight into the CRM
- Custom cursor, smooth scroll, magnetic buttons, WhatsApp button

**Admin (`/admin`)**
- Dashboard — leads trend, pipeline, revenue from active plans, win rate, renewals due (with WhatsApp reminder)
- Leads CRM — drag-and-drop kanban + list view, lead drawer (call/WhatsApp/email, stages, notes timeline, convert to member)
- Members — status filters, check-in, one-click renew, add/edit
- Website CMS — brand name, accent colour, dark/light theme, intro animation, section order & visibility (drag),
  every text/image/list on the site, contact, hours, SEO; live preview and one-click publish

## Data

Content, leads and members are stored in `data/db.json` (created automatically from the demo seed).
That's fine for a single gym on a VPS. On serverless hosts (e.g. Vercel) the filesystem is read-only,
so swap `src/lib/db.ts` for Postgres / Supabase — every read and write goes through that one file.

Images are Unsplash URLs; replace them from the CMS with the gym's own photos.
