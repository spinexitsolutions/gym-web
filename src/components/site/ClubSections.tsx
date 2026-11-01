"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Check, Users } from "lucide-react";
import type { ScheduleSlot } from "@/lib/types";
import { useSite } from "./context";
import { EASE, FadeUp, PillButton, SectionHead, SocialIcon } from "./primitives";

/* ───────────── Coaches ───────────── */
export function Trainers() {
  const { content } = useSite();
  return (
    <section id="trainers" data-nav="trainers" className="py-24 md:py-40">
      <div className="container-x">
        <SectionHead
          eyebrow="Coaches"
          title="People who've done the work."
          highlight="work."
          aside="Every coach is certified, still competes or trains daily, and is obsessed with your technique — not their own reflection."
        />
      </div>
      <div className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 md:mt-20 md:px-10 lg:container-x lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
        {content.trainers.map((t, i) => (
          <motion.article
            key={t.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 1, delay: i * 0.08, ease: EASE }}
            className="group relative aspect-[3/4] w-[72vw] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[24px] bg-card text-[#f2f0eb] lg:w-auto lg:max-w-none"
          >
            <motion.img
              src={t.image}
              alt={t.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-[1.2s] ease-[var(--ease-out)] group-hover:scale-105 group-hover:grayscale-0"
              whileInView={{ filter: "grayscale(0)" }}
              viewport={{ amount: 0.8 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <span className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1.5 font-mono text-[11px] backdrop-blur-md">
              {t.experience}
            </span>
            <a
              href={t.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label={`${t.name} on Instagram`}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-md transition-transform hover:scale-110"
            >
              <SocialIcon name="instagram" />
            </a>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="eyebrow !text-[10px] !text-accent">{t.role}</p>
              <h3 className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em]">{t.name}</h3>
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-700 ease-[var(--ease-out)] group-hover:grid-rows-[1fr]">
                <p className="overflow-hidden text-[13.5px] text-white/70">
                  <span className="block pt-2">{t.speciality}</span>
                </p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Schedule ───────────── */
const DAYS: ScheduleSlot["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Schedule() {
  const { content, scrollTo, setPrefill } = useSite();
  const [day, setDay] = useState<ScheduleSlot["day"]>("Mon");
  useEffect(() => {
    setDay(DAYS[(new Date().getDay() + 6) % 7]);
  }, []);
  const slots = useMemo(
    () => content.schedule.filter((s) => s.day === day).sort((a, b) => a.time.localeCompare(b.time)),
    [content.schedule, day],
  );

  return (
    <section id="schedule" data-nav="schedule" className="surface-invert py-24 md:py-40">
      <div className="container-x">
        <SectionHead eyebrow="This week" title="Find your hour." highlight="hour." aside="Classes are capped so every rep gets coached. Pick a slot and we'll hold a spot for your free trial." />

        <LayoutGroup>
          <div className="no-scrollbar mt-12 overflow-x-auto md:mt-16">
            <div className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] p-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className="relative h-10 min-w-[52px] rounded-full px-4 text-[14px] font-medium tracking-tight md:h-11 md:min-w-[72px]"
                  data-cursor="hover"
                >
                  {day === d && (
                    <motion.span
                      layoutId="day-pill"
                      className="absolute inset-0 rounded-full bg-fg shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className={`relative transition-colors ${day === d ? "text-bg" : "text-muted"}`}>{d}</span>
                </button>
              ))}
            </div>
          </div>
        </LayoutGroup>

        <div className="mt-8 border-t border-line">
          <AnimatePresence mode="popLayout" initial={false}>
            {slots.length === 0 && (
              <motion.p key={`empty-${day}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 text-muted">
                Open gym all day — no group classes scheduled.
              </motion.p>
            )}
            {slots.map((s, i) => (
              <motion.div
                key={`${day}-${s.id}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.6, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="group grid grid-cols-[72px_1fr_auto] items-center gap-4 border-b border-line py-5 md:grid-cols-[140px_1fr_200px_160px_auto] md:py-7"
              >
                <span className="font-mono text-[15px] tabular-nums md:text-[17px]">{s.time}</span>
                <div>
                  <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.035em] transition-transform duration-500 ease-[var(--ease-out)] group-hover:translate-x-2 md:text-[32px]">
                    {s.className}
                  </h3>
                  <p className="text-[13px] text-muted md:hidden">
                    with {s.coach} · {s.spots} spots
                  </p>
                </div>
                <span className="hidden text-[15px] text-muted md:block">with {s.coach}</span>
                <span className="hidden items-center gap-2 text-[14px] text-muted md:flex">
                  <Users className="size-4" /> {s.spots} spots
                </span>
                <button
                  onClick={() => {
                    setPrefill({ goal: s.className });
                    scrollTo("#join");
                  }}
                  className="h-10 rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] px-4 text-[13.5px] font-medium transition-colors hover:bg-accent hover:text-accent-ink"
                  data-cursor="hover"
                >
                  Book
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Pricing ───────────── */
export function Pricing() {
  const { content, scrollTo, setPrefill } = useSite();
  const [yearly, setYearly] = useState(false);
  const save = useMemo(() => {
    const p = content.plans.find((x) => x.featured) ?? content.plans[0];
    if (!p) return 0;
    return Math.round((1 - p.yearly / (p.monthly * 12)) * 100);
  }, [content.plans]);

  return (
    <section id="pricing" data-nav="pricing" className="py-24 md:py-40">
      <div className="container-x">
        <SectionHead
          eyebrow="Membership"
          title="Simple plans. Serious results."
          highlight="Serious"
          aside={
            <div className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] p-1">
              {["Monthly", "Yearly"].map((l, i) => {
                const on = (i === 1) === yearly;
                return (
                  <button
                    key={l}
                    onClick={() => setYearly(i === 1)}
                    className="relative h-11 rounded-full px-5 text-[14px] font-medium"
                    data-cursor="hover"
                  >
                    {on && (
                      <motion.span
                        layoutId="bill-pill"
                        className="absolute inset-0 rounded-full bg-fg"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span className={`relative ${on ? "text-bg" : "text-fg"}`}>
                      {l}
                      {i === 1 && save > 0 && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-accent text-accent-ink" : "bg-accent/15 text-accent"}`}>
                          −{save}%
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          }
        />

        <div className="mt-14 grid gap-4 md:mt-20 lg:grid-cols-3 lg:gap-5">
          {content.plans.map((p, i) => {
            const price = yearly ? Math.round(p.yearly / 12) : p.monthly;
            return (
              <FadeUp key={p.id} delay={i * 0.1}>
                <div
                  className={`relative flex h-full flex-col rounded-[28px] p-7 md:p-8 ${
                    p.featured ? "conic-border bg-card shadow-[0_40px_100px_-40px_var(--accent)]" : "bg-card ring-1 ring-inset ring-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{p.name}</h3>
                    {p.featured && (
                      <span className="rounded-full bg-accent px-3 py-1 text-[11.5px] font-semibold text-accent-ink">Most popular</span>
                    )}
                  </div>
                  <p className="mt-2 text-[14.5px] text-muted">{p.description}</p>

                  <div className="mt-8 flex items-end gap-1">
                    <span className="mb-2 text-[22px] font-medium text-muted">{content.currency}</span>
                    <div className="relative h-[64px] overflow-hidden md:h-[76px]">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={price}
                          initial={{ y: yearly ? 60 : -60, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: yearly ? -60 : 60, opacity: 0 }}
                          transition={{ duration: 0.5, ease: EASE }}
                          className="block text-[60px] font-semibold leading-none tracking-[-0.06em] tabular-nums md:text-[72px]"
                        >
                          {price.toLocaleString("en-IN")}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <span className="mb-2 text-[14px] text-muted">/mo</span>
                  </div>
                  <p className="h-5 text-[12.5px] text-muted">
                    {yearly ? `Billed ${content.currency}${p.yearly.toLocaleString("en-IN")} yearly` : "Billed monthly · cancel anytime"}
                  </p>

                  <ul className="mt-8 flex flex-1 flex-col gap-3.5 border-t border-line pt-7">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-[15px]">
                        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${p.featured ? "bg-accent text-accent-ink" : "bg-faint"}`}>
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <PillButton
                    variant={p.featured ? "accent" : "solid"}
                    className="mt-9 w-full justify-between"
                    onClick={() => {
                      setPrefill({ plan: p.name });
                      scrollTo("#join");
                    }}
                  >
                    Choose {p.name}
                  </PillButton>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────── BMI calculator ───────────── */
const BANDS = [
  { max: 18.5, label: "Underweight", goal: "Build muscle", tip: "Focus on progressive strength work and a calorie surplus." },
  { max: 25, label: "Healthy", goal: "Get stronger", tip: "Great base. Time to chase performance — strength and engine." },
  { max: 30, label: "Overweight", goal: "Lose fat", tip: "Conditioning + strength 4×/week and simple nutrition habits." },
  { max: 99, label: "Obese", goal: "Lose fat", tip: "Start low-impact with a coach and build consistency first." },
];

export function Bmi() {
  const { scrollTo, setPrefill } = useSite();
  const [h, setH] = useState(172);
  const [w, setW] = useState(72);
  const bmi = w / Math.pow(h / 100, 2);
  const band = BANDS.find((b) => bmi < b.max) ?? BANDS[3];
  // map bmi 15 → 35 onto -90° → 90°
  const angle = Math.max(-90, Math.min(90, ((bmi - 15) / 20) * 180 - 90));

  return (
    <section id="bmi" data-nav="bmi" className="container-x py-24 md:py-36">
      <div className="grid overflow-hidden rounded-[32px] bg-card ring-1 ring-inset ring-line lg:grid-cols-2">
        <div className="p-7 md:p-12">
          <p className="eyebrow mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-accent" /> Quick check
          </p>
          <h2 className="display text-[clamp(40px,5.6vw,80px)]">
            Know your <span className="serif-i text-accent">number.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[15px] text-muted">A starting point, not a verdict. Slide to calculate your BMI.</p>

          <div className="mt-10 space-y-9">
            <Slider label="Height" unit="cm" min={140} max={210} value={h} onChange={setH} />
            <Slider label="Weight" unit="kg" min={40} max={150} value={w} onChange={setW} />
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-center gap-6 bg-bg-2 p-7 md:p-12">
          <svg viewBox="0 0 220 124" className="w-full max-w-[360px]">
            <defs>
              <linearGradient id="bmi-g" x1="0" x2="1">
                <stop offset="0%" stopColor="#64d2ff" />
                <stop offset="35%" stopColor="#30d158" />
                <stop offset="68%" stopColor="#ffd60a" />
                <stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
            <path d="M 14 112 A 96 96 0 0 1 206 112" fill="none" stroke="var(--faint)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 14 112 A 96 96 0 0 1 206 112" fill="none" stroke="url(#bmi-g)" strokeWidth="14" strokeLinecap="round" opacity="0.9" />
            <motion.g
              animate={{ rotate: angle }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
              style={{ originX: "110px", originY: "112px" }}
            >
              <line x1="110" y1="112" x2="110" y2="34" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
            </motion.g>
            <circle cx="110" cy="112" r="8" fill="var(--fg)" />
          </svg>
          <div className="text-center">
            <div className="text-[72px] font-semibold leading-none tracking-[-0.06em] tabular-nums">{bmi.toFixed(1)}</div>
            <AnimatePresence mode="wait">
              <motion.div key={band.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="mt-2 text-[18px] font-medium">{band.label}</p>
                <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">{band.tip}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <PillButton
            onClick={() => {
              setPrefill({ goal: band.goal });
              scrollTo("#join");
            }}
          >
            Get a plan for this
          </PillButton>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-[15px] text-muted">{label}</span>
        <span className="text-[28px] font-semibold tracking-[-0.04em] tabular-nums">
          {value}
          <span className="ml-1 text-[14px] font-normal text-muted">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        data-cursor="drag"
      />
    </label>
  );
}
