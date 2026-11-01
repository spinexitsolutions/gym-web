import type { Database, Lead, Member, SiteContent } from "./types";

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const seedContent: SiteContent = {
  brand: {
    name: "MONOLITH",
    shortName: "M",
    tagline: "Athletic Club",
    accent: "#FFD400",
    theme: "dark",
    announcement: {
      enabled: true,
      text: "New batch starts Monday — first 7 days free",
      link: "#join",
    },
    cursor: true,
    smoothScroll: true,
  },
  intro: {
    enabled: true,
    style: "counter",
    words: ["Sweat.", "Lift.", "Repeat.", "Become."],
    durationMs: 2600,
    oncePerSession: false,
  },
  hero: {
    eyebrow: "Strength & Conditioning · Bandra",
    lines: ["Train like", "it counts."],
    highlight: "counts.",
    subtitle:
      "A training floor engineered for people who show up. Coaching, programming and community — without the noise.",
    image: u("1605296867304-46d5465a13f1", 2400),
    primaryCta: "Start free trial",
    secondaryCta: "Explore programs",
    marquee: [
      "Strength",
      "Conditioning",
      "Boxing",
      "Mobility",
      "Hyrox",
      "Recovery",
      "Nutrition",
      "Community",
    ],
  },
  sections: [
    { id: "manifesto", label: "House rules (barbell)", enabled: true },
    { id: "stats", label: "Stats", enabled: true },
    { id: "programs", label: "Programs", enabled: true },
    { id: "reveal", label: "Facility reveal", enabled: true },
    { id: "trainers", label: "Coaches", enabled: true },
    { id: "schedule", label: "Schedule", enabled: true },
    { id: "pricing", label: "Pricing", enabled: true },
    { id: "bmi", label: "BMI calculator", enabled: true },
    { id: "testimonials", label: "Testimonials", enabled: true },
    { id: "gallery", label: "Gallery", enabled: true },
    { id: "faq", label: "FAQ", enabled: true },
    { id: "join", label: "Join / Trial form", enabled: true },
  ],
  manifesto: {
    eyebrow: "The house rules",
    title: "Load the bar.",
    principles: [
      { id: "m1", title: "Show up.", text: "Consistency beats intensity. Three good sessions a week, every week, changes everything." },
      { id: "m2", title: "Own the basics.", text: "Squat, hinge, push, pull, carry. Master the fundamentals before chasing anything fancy." },
      { id: "m3", title: "Get coached.", text: "Every rep is watched. Honest feedback, precise cues — no ego, no guesswork." },
      { id: "m4", title: "Leave it better.", text: "Rack your plates, cheer the next set. The floor is only as strong as the people on it." },
    ],
    closing: "Your next PR is already loaded.",
  },
  stats: [
    { id: "s1", value: 1200, suffix: "+", label: "Active members" },
    { id: "s2", value: 18, suffix: "", label: "Certified coaches" },
    { id: "s3", value: 9000, suffix: " sq ft", label: "Training floor" },
    { id: "s4", value: 96, suffix: "%", label: "Renewal rate" },
  ],
  programs: [
    {
      id: "p1",
      title: "Strength",
      tagline: "Move heavy. Move well.",
      description:
        "Periodised barbell programming built around the big lifts, with technique coaching every session.",
      image: u("1517836357463-d25dfeac3438", 1200),
      duration: "60 min",
      intensity: 4,
      tags: ["Barbell", "Powerlifting", "Technique"],
    },
    {
      id: "p2",
      title: "Conditioning",
      tagline: "Engine first.",
      description:
        "Intervals, sleds, ropes and erg work designed to raise your ceiling — and your heart rate.",
      image: u("1599058917212-d750089bc07e", 1200),
      duration: "45 min",
      intensity: 5,
      tags: ["HIIT", "Metcon", "Hyrox"],
    },
    {
      id: "p3",
      title: "Boxing",
      tagline: "Hands up. Mind sharp.",
      description:
        "Footwork, combinations and pad work. Learn the craft — leave the stress on the bag.",
      image: u("1549060279-7e168fcee0c2", 1200),
      duration: "50 min",
      intensity: 4,
      tags: ["Pads", "Bag work", "Footwork"],
    },
    {
      id: "p4",
      title: "Mobility",
      tagline: "Range is strength.",
      description:
        "Guided flows that unlock hips, spine and shoulders so everything else feels easier.",
      image: u("1599901860904-17e6ed7083a0", 1200),
      duration: "40 min",
      intensity: 2,
      tags: ["Yoga", "Stretch", "Recovery"],
    },
    {
      id: "p5",
      title: "Functional",
      tagline: "Strong for real life.",
      description:
        "Kettlebells, carries and gymnastics skills that build athletic, useful strength.",
      image: u("1541534741688-6078c6bfb5c5", 1200),
      duration: "55 min",
      intensity: 3,
      tags: ["Kettlebell", "Gymnastics", "Core"],
    },
  ],
  reveal: {
    eyebrow: "The floor",
    title: "9,000 square feet of intent.",
    text: "Competition racks, calibrated plates, a 40 m turf lane and a recovery lounge — every inch designed for training, not for show.",
    image: u("1571902943202-507ec2618e8f", 2400),
  },
  trainers: [
    {
      id: "t1",
      name: "Arjun Mehta",
      role: "Head Coach",
      image: u("1567013127542-490d757e51fc", 900),
      experience: "11 yrs",
      speciality: "Strength & Powerlifting",
      instagram: "#",
    },
    {
      id: "t2",
      name: "Sana Kapoor",
      role: "Conditioning Lead",
      image: u("1550345332-09e3ac987658", 900),
      experience: "8 yrs",
      speciality: "HIIT & Hyrox",
      instagram: "#",
    },
    {
      id: "t3",
      name: "Kabir Rao",
      role: "Hypertrophy Coach",
      image: u("1611672585731-fa10603fb9e0", 900),
      experience: "7 yrs",
      speciality: "Body recomposition",
      instagram: "#",
    },
    {
      id: "t4",
      name: "Meera Iyer",
      role: "Mobility Coach",
      image: u("1594381898411-846e7d193883", 900),
      experience: "6 yrs",
      speciality: "Mobility & Core",
      instagram: "#",
    },
  ],
  schedule: [
    { id: "c1", day: "Mon", time: "06:00", className: "Strength", coach: "Arjun", spots: 12 },
    { id: "c2", day: "Mon", time: "07:30", className: "Conditioning", coach: "Sana", spots: 16 },
    { id: "c3", day: "Mon", time: "19:00", className: "Boxing", coach: "Kabir", spots: 10 },
    { id: "c4", day: "Tue", time: "06:30", className: "Mobility", coach: "Meera", spots: 14 },
    { id: "c5", day: "Tue", time: "18:00", className: "Functional", coach: "Sana", spots: 12 },
    { id: "c6", day: "Tue", time: "20:00", className: "Strength", coach: "Arjun", spots: 8 },
    { id: "c7", day: "Wed", time: "06:00", className: "Conditioning", coach: "Sana", spots: 16 },
    { id: "c8", day: "Wed", time: "19:00", className: "Boxing", coach: "Kabir", spots: 10 },
    { id: "c9", day: "Thu", time: "07:00", className: "Strength", coach: "Arjun", spots: 12 },
    { id: "c10", day: "Thu", time: "18:30", className: "Mobility", coach: "Meera", spots: 14 },
    { id: "c11", day: "Fri", time: "06:00", className: "Functional", coach: "Sana", spots: 12 },
    { id: "c12", day: "Fri", time: "19:00", className: "Conditioning", coach: "Sana", spots: 16 },
    { id: "c13", day: "Sat", time: "08:00", className: "Team WOD", coach: "All coaches", spots: 30 },
    { id: "c14", day: "Sat", time: "10:00", className: "Boxing", coach: "Kabir", spots: 10 },
    { id: "c15", day: "Sun", time: "09:00", className: "Recovery flow", coach: "Meera", spots: 20 },
  ],
  plans: [
    {
      id: "pl1",
      name: "Essential",
      monthly: 2499,
      yearly: 23999,
      description: "Full floor access for self-driven athletes.",
      features: ["Open gym 5am–11pm", "Locker & shower", "Monthly body scan", "App programming"],
      featured: false,
    },
    {
      id: "pl2",
      name: "Performance",
      monthly: 4499,
      yearly: 42999,
      description: "Unlimited classes with coached programming.",
      features: [
        "Everything in Essential",
        "Unlimited group classes",
        "Quarterly coach review",
        "Recovery lounge access",
        "2 guest passes / month",
      ],
      featured: true,
    },
    {
      id: "pl3",
      name: "Elite 1:1",
      monthly: 11999,
      yearly: 119999,
      description: "Personal coaching, nutrition and accountability.",
      features: [
        "Everything in Performance",
        "12 PT sessions / month",
        "Custom nutrition plan",
        "Weekly check-ins",
        "Priority booking",
      ],
      featured: false,
    },
  ],
  currency: "₹",
  testimonials: [
    {
      id: "r1",
      name: "Riya Sharma",
      role: "Product designer",
      quote: "First gym where coaches actually watch your form. Deadlift went from 60 to 110 kg in eight months.",
      avatar: u("1494790108377-be9c29b29330", 200),
      result: "+50 kg deadlift",
    },
    {
      id: "r2",
      name: "Vikram Nair",
      role: "Founder",
      quote: "The 6 am crew is the reason I never skip. It feels like a team, not a membership.",
      avatar: u("1500648767791-00dcc994a43e", 200),
      result: "−14 kg in 6 months",
    },
    {
      id: "r3",
      name: "Ananya Das",
      role: "Doctor",
      quote: "Clean, calm, zero ego. The mobility classes fixed a back issue I had for years.",
      avatar: u("1438761681033-6461ffad8d80", 200),
      result: "Pain-free in 10 weeks",
    },
    {
      id: "r4",
      name: "Rohan Gupta",
      role: "Software engineer",
      quote: "Programming is genuinely smart. I finished my first Hyrox thanks to Sana's conditioning block.",
      avatar: u("1506794778202-cad84cf45f1d", 200),
      result: "First Hyrox finish",
    },
    {
      id: "r5",
      name: "Isha Malhotra",
      role: "Architect",
      quote: "Feels like an Apple store for training. Everything just works and nothing is in your way.",
      avatar: u("1534528741775-53994a69daeb", 200),
      result: "3× a week, 1 year",
    },
  ],
  gallery: [
    { id: "g1", image: u("1534438327276-14e5300c3a48", 1400), caption: "The rack" },
    { id: "g2", image: u("1581009146145-b5ef050c2e1e", 1000), caption: "Pressing day" },
    { id: "g3", image: u("1574680096145-d05b474e2155", 1000), caption: "Squat club" },
    { id: "g4", image: u("1583454110551-21f2fa2afe61", 1000), caption: "Grip work" },
    { id: "g5", image: u("1623874514711-0f321325f318", 1400), caption: "The warehouse" },
    { id: "g6", image: u("1526506118085-60ce8714f8c5", 1000), caption: "Pull-up bar" },
  ],
  faqs: [
    {
      id: "f1",
      q: "I'm a complete beginner. Is this for me?",
      a: "Absolutely. Every new member gets an onboarding session and a coach who scales the program to your level. Most of our members started from zero.",
    },
    {
      id: "f2",
      q: "How does the free trial work?",
      a: "Book through the form below. You get 7 days of full access including classes — no card, no pressure. A coach will call you to set your first session.",
    },
    {
      id: "f3",
      q: "Can I freeze my membership?",
      a: "Yes. Performance and Elite members can freeze for up to 30 days a year for travel, illness or exams.",
    },
    {
      id: "f4",
      q: "Do you offer nutrition guidance?",
      a: "Elite members get a fully custom plan. All members get access to our nutrition workshops and macro templates.",
    },
    {
      id: "f5",
      q: "Is there parking?",
      a: "Yes — 40 dedicated two-wheeler and 20 car spots in the basement, free for members.",
    },
  ],
  join: {
    title: "Your first week is on us.",
    subtitle: "Tell us a little about you. A coach will call within 24 hours to plan your first session.",
    goals: ["Lose fat", "Build muscle", "Get stronger", "Improve fitness", "Learn boxing", "Mobility"],
    image: u("1597452485669-2c7bb5fef90d", 1400),
  },
  contact: {
    phone: "+91 98765 43210",
    whatsapp: "919876543210",
    email: "hello@monolith.club",
    address: "4th Floor, Linking Road, Bandra West, Mumbai 400050",
    mapUrl: "https://maps.google.com/?q=Bandra+West+Mumbai",
    hoursWeekday: "Mon–Fri · 5:00 – 23:00",
    hoursWeekend: "Sat–Sun · 7:00 – 21:00",
    openHour: 5,
    closeHour: 23,
    instagram: "https://instagram.com",
    youtube: "https://youtube.com",
    facebook: "https://facebook.com",
  },
  seo: {
    title: "MONOLITH Athletic Club — Strength & Conditioning, Mumbai",
    description:
      "Coached strength, conditioning, boxing and mobility training in Bandra. Start your free 7-day trial.",
  },
};

/* ───────── demo CRM data so the admin panel looks alive ───────── */

const daysAgo = (d: number, h = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, (d * 17) % 60, 0, 0);
  return t.toISOString();
};
const daysAhead = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

const leadSeed: [string, string, string, Lead["stage"], number, string][] = [
  ["Aarav Singh", "Build muscle", "Evening", "new", 0, "Website"],
  ["Diya Patel", "Lose fat", "Morning", "new", 1, "Instagram"],
  ["Kunal Verma", "Get stronger", "Evening", "contacted", 2, "Website"],
  ["Neha Joshi", "Mobility", "Morning", "trial", 3, "Referral"],
  ["Rahul Bose", "Learn boxing", "Evening", "won", 5, "Website"],
  ["Pooja Reddy", "Improve fitness", "Afternoon", "contacted", 6, "Walk-in"],
  ["Siddharth Jain", "Build muscle", "Morning", "trial", 8, "Google"],
  ["Tanvi Shah", "Lose fat", "Evening", "won", 9, "Instagram"],
  ["Manav Kohli", "Get stronger", "Evening", "lost", 11, "Website"],
  ["Ishaan Khanna", "Improve fitness", "Morning", "new", 0, "Website"],
  ["Prachi Desai", "Mobility", "Afternoon", "won", 12, "Referral"],
  ["Yash Agarwal", "Build muscle", "Evening", "contacted", 4, "Google"],
];

const leads: Lead[] = leadSeed.map(([name, goal, time, stage, ago, source], i) => ({
  id: `lead_${i + 1}`,
  name,
  phone: `+91 98${(20000000 + i * 734521).toString().slice(0, 8)}`,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  goal,
  preferredTime: time,
  message: i % 3 === 0 ? "Looking to start next week." : "",
  source,
  stage,
  value: stage === "won" ? 4499 : [2499, 4499, 11999][i % 3],
  notes:
    stage === "new"
      ? []
      : [{ id: `n${i}`, text: "Called — interested, wants evening slot.", at: daysAgo(Math.max(ago - 1, 0), 15) }],
  createdAt: daysAgo(ago, 9 + (i % 8)),
  updatedAt: daysAgo(Math.max(ago - 1, 0)),
}));

const memberSeed: [string, string, Member["status"], number, number, string][] = [
  ["Rahul Bose", "Performance", "active", 5, 25, "Kabir"],
  ["Tanvi Shah", "Essential", "active", 9, 21, "Sana"],
  ["Prachi Desai", "Elite 1:1", "active", 12, 18, "Meera"],
  ["Aditya Kulkarni", "Performance", "active", 140, 40, "Arjun"],
  ["Sneha Pillai", "Performance", "frozen", 220, 12, "Sana"],
  ["Harsh Vardhan", "Essential", "expired", 400, -20, "—"],
  ["Nikita Rao", "Elite 1:1", "active", 60, 120, "Arjun"],
  ["Farhan Qureshi", "Essential", "active", 30, 3, "—"],
  ["Gauri Menon", "Performance", "active", 95, 6, "Meera"],
];

const members: Member[] = memberSeed.map(([name, plan, status, joined, exp, trainer], i) => ({
  id: `mem_${i + 1}`,
  name,
  phone: `+91 99${(30000000 + i * 912377).toString().slice(0, 8)}`,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  plan,
  status,
  joinedAt: daysAgo(joined).slice(0, 10),
  expiresAt: daysAhead(exp),
  trainer,
  checkIns: Math.max(4, Math.round(joined * 0.6)) % 180,
  notes: "",
}));

export const seedDatabase = (): Database => ({
  content: structuredClone(seedContent),
  leads,
  members,
});
