"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Users } from "lucide-react";
import type { ScheduleSlot } from "@/lib/types";
import { useSite } from "./context";
import { EASE, EASE_IO, Magnetic, PillButton, useIsOpen } from "./primitives";

/*
 * Hero — editorial, photo-in-type layout.
 * No full-bleed stock photo: the headline itself carries the imagery
 * through capsule "windows" that open between the words and cycle
 * through the programs. Below it, two live utility cards
 * (floor busyness + next class countdown) make it feel like a real club.
 */

const DAYS: ScheduleSlot["day"][] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Hero() {
  const { content, ready } = useSite();
  const { hero, programs, contact } = content;
  const ref = useRef<HTMLElement>(null);
  const status = useIsOpen(contact.openHour, contact.closeHour);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const row1X = useTransform(scrollYProgress, [0, 1], ["0%", "-9%"]);
  const row2X = useTransform(scrollYProgress, [0, 1], ["0%", "9%"]);
  const fade = useTransform(scrollYProgress, [0.35, 0.85], [1, 0]);

  // pill A cycles through programs, pill B holds the brand image
  const reel = useMemo(() => programs.filter((p) => p.image), [programs]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!ready || reel.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % reel.length), 2600);
    return () => clearInterval(t);
  }, [ready, reel.length]);

  const [line1 = "", line2 = ""] = hero.lines;
  const hl = new Set(hero.highlight.toLowerCase().split(/\s+/).filter(Boolean));

  return (
    <section
      ref={ref}
      id="top"
      data-nav="top"
      className="relative flex flex-col overflow-hidden pb-10 pt-6 md:pb-14 md:pt-28"
    >
      {/* meta row */}
      <motion.div
        className="container-x flex items-center justify-between gap-4"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : undefined}
        transition={{ duration: 1, delay: 0.2 }}
      >
        <p className="eyebrow">
          <span className="text-fg md:hidden">{content.brand.name}</span>
          <span className="hidden md:inline">{hero.eyebrow}</span>
        </p>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset ring-line">
          <span className={`live-dot size-1.5 rounded-full ${status?.open ? "bg-[#1fbf5c]" : "bg-[#9a9a9a]"}`} />
          {status?.label ?? " "}
        </span>
      </motion.div>

      {/* headline with photo capsules */}
      <motion.h1
        style={{ opacity: fade }}
        className="display mt-8 px-5 text-[clamp(44px,13vw,96px)] uppercase leading-[0.86] tracking-[-0.04em] md:mt-10 md:px-10 md:text-[clamp(56px,8.4vw,172px)] [font-stretch:118%]"
        aria-label={hero.lines.join(" ")}
      >
        <motion.span style={{ x: row1X }} className="flex flex-wrap items-center gap-x-[0.18em] gap-y-[0.12em]">
          <Words text={line1} hl={hl} play={ready} delay={0.35} />
          <Capsule play={ready} delay={0.75} className="block h-[26vw] w-full md:inline-block md:h-[0.78em] md:w-[2.9em]">
            <AnimatePresence initial={false}>
              {reel[i] && (
                <motion.img
                  key={reel[i].id}
                  src={reel[i].image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0, scale: 1.12 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
              )}
            </AnimatePresence>
            <span className="absolute bottom-[10%] left-[5%] flex items-center gap-2 rounded-full bg-black/45 py-1 pl-1.5 pr-3 text-[11px] font-semibold normal-case tracking-normal text-white backdrop-blur-md [font-stretch:100%] md:bottom-[12%] md:left-[4%] md:text-[12px]">
              <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-ink">
                {String((i % Math.max(1, reel.length)) + 1).padStart(2, "0")}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={reel[i]?.id} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.35 }}>
                  {reel[i]?.title}
                </motion.span>
              </AnimatePresence>
            </span>
          </Capsule>
        </motion.span>

        <motion.span style={{ x: row2X }} className="mt-[0.06em] flex flex-wrap items-center gap-x-[0.18em] md:justify-end">
          <Capsule play={ready} delay={0.95} className="hidden h-[0.78em] w-[1.9em] md:inline-block">
            <motion.img
              src={hero.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ scale: 1.3 }}
              animate={ready ? { scale: 1 } : undefined}
              transition={{ duration: 1.8, ease: EASE, delay: 0.95 }}
            />
          </Capsule>
          <Words text={line2} hl={hl} play={ready} delay={0.5} />
        </motion.span>
      </motion.h1>

      {/* lower band */}
      <div className="container-x mt-10 grid gap-3 md:mt-20 md:grid-cols-12 md:items-end md:gap-4">
        <Rise play={ready} delay={1.1} className="md:col-span-5 md:pr-8">
          <p className="max-w-[34ch] text-[17px] leading-[1.45] text-muted md:text-[18px]">{hero.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Magnetic>
              <PillButton href="#join">{hero.primaryCta}</PillButton>
            </Magnetic>
            <a
              href="#programs"
              className="group inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium ring-1 ring-inset ring-line transition-colors hover:bg-fg hover:text-bg"
              data-cursor="hover"
            >
              {hero.secondaryCta}
              <ArrowUpRight className="size-4 transition-transform duration-500 group-hover:rotate-45" />
            </a>
          </div>
        </Rise>
        <div className="grid grid-cols-2 gap-3 md:col-span-7 md:gap-4">
          <Rise play={ready} delay={1.25}>
            <FloorCard open={!!status?.open} openHour={contact.openHour} closeHour={contact.closeHour} />
          </Rise>
          <Rise play={ready} delay={1.35}>
            <NextClassCard />
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ── pieces ─────────────────────────────────────────────── */

function Words({ text, hl, play, delay }: { text: string; hl: Set<string>; play: boolean; delay: number }) {
  return (
    <>
      {text.split(" ").filter(Boolean).map((w, k) => (
        <span key={k} className="inline-block overflow-hidden py-[0.04em]">
          <motion.span
            className={`inline-block will-change-transform ${hl.has(w.toLowerCase()) ? "text-accent" : ""}`}
            initial={{ y: "105%" }}
            animate={play ? { y: "0%" } : undefined}
            transition={{ duration: 1.1, ease: EASE, delay: delay + k * 0.08 }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </>
  );
}

function Capsule({ children, play, delay, className }: { children: React.ReactNode; play: boolean; delay: number; className: string }) {
  return (
    <motion.span
      className={`relative shrink-0 overflow-hidden rounded-[999px] bg-bg-2 align-middle ${className}`}
      initial={{ clipPath: "inset(0% 50% 0% 50% round 999px)" }}
      animate={play ? { clipPath: "inset(0% 0% 0% 0% round 999px)" } : undefined}
      transition={{ duration: 1.3, ease: EASE_IO, delay }}
    >
      {children}
    </motion.span>
  );
}

function Rise({ children, play, delay, className = "" }: { children: React.ReactNode; play: boolean; delay: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={play ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Rough crowd curve: peaks around 7:00 and 19:00. */
function busyness(h: number) {
  const g = (c: number, w: number) => Math.exp(-((h - c) ** 2) / (2 * w * w));
  return Math.round(14 + 72 * Math.max(g(7, 1.4), g(19, 1.8), 0.45 * g(13, 1.5)));
}

function FloorCard({ open, openHour, closeHour }: { open: boolean; openHour: number; closeHour: number }) {
  const [now, setNow] = useState<{ pct: number; quiet: number } | null>(null);
  useEffect(() => {
    const calc = () => {
      const d = new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      let quiet = openHour + 1;
      let best = 101;
      for (let t = Math.max(Math.ceil(h), openHour); t < closeHour; t++) {
        const b = busyness(t);
        if (b < best) {
          best = b;
          quiet = t;
        }
      }
      setNow({ pct: open ? busyness(h) : 0, quiet });
    };
    calc();
    const t = setInterval(calc, 60_000);
    return () => clearInterval(t);
  }, [open, openHour, closeHour]);

  const pct = now?.pct ?? 0;
  const bars = 12;
  const lit = Math.round((pct / 100) * bars);
  const label = !open ? "Closed" : pct < 35 ? "Quiet" : pct < 65 ? "Steady" : "Busy";

  return (
    <div className="flex h-full flex-col justify-between rounded-[22px] bg-card p-4 ring-1 ring-inset ring-line md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">Floor right now</p>
        <span className="text-[12px] font-semibold text-accent">{label}</span>
      </div>
      <div className="mt-5">
        <p className="text-[34px] font-bold leading-none tracking-[-0.04em] tabular-nums md:text-[44px]">
          {pct}
          <span className="text-[16px] font-semibold text-muted">%</span>
        </p>
        <div className="mt-3 flex h-7 items-end gap-[3px]">
          {Array.from({ length: bars }).map((_, k) => (
            <motion.span
              key={k}
              className="flex-1 rounded-[3px]"
              initial={{ scaleY: 0.2 }}
              animate={{ scaleY: 1, backgroundColor: k < lit ? "var(--accent)" : "var(--faint)" }}
              transition={{ delay: 1.4 + k * 0.04, duration: 0.6, ease: EASE }}
              style={{ height: `${40 + (k / bars) * 60}%`, originY: 1 }}
            />
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-muted">
          {now ? `Quietest today: ${String(now.quiet).padStart(2, "0")}:00` : " "}
        </p>
      </div>
    </div>
  );
}

function NextClassCard() {
  const { content, scrollTo, setPrefill } = useSite();
  const [next, setNext] = useState<{ slot: ScheduleSlot; mins: number } | null>(null);

  useEffect(() => {
    const find = () => {
      const d = new Date();
      const nowMin = d.getHours() * 60 + d.getMinutes();
      for (let off = 0; off < 7; off++) {
        const day = DAYS[(d.getDay() + off) % 7];
        const slots = content.schedule
          .filter((s) => s.day === day)
          .map((s) => {
            const [hh, mm] = s.time.split(":").map(Number);
            return { s, start: hh * 60 + (mm || 0) };
          })
          .filter((x) => off > 0 || x.start > nowMin)
          .sort((a, b) => a.start - b.start);
        if (slots[0]) {
          setNext({ slot: slots[0].s, mins: off * 1440 + slots[0].start - nowMin });
          return;
        }
      }
      setNext(null);
    };
    find();
    const t = setInterval(find, 30_000);
    return () => clearInterval(t);
  }, [content.schedule]);

  const when = next
    ? next.mins < 60
      ? `in ${next.mins} min`
      : next.mins < 1440
        ? `in ${Math.floor(next.mins / 60)}h ${next.mins % 60}m`
        : `${next.slot.day} · ${next.slot.time}`
    : "";

  return (
    <div className="flex h-full flex-col justify-between rounded-[22px] bg-fg p-4 text-bg md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow !text-[color-mix(in_oklab,var(--bg)_60%,transparent)]">Next class</p>
        <span className="font-mono text-[12px] tabular-nums">{next?.slot.time}</span>
      </div>
      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={next?.slot.id ?? "none"}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            className="text-[22px] font-bold leading-[1.02] tracking-[-0.035em] [font-stretch:110%] md:text-[28px]"
          >
            {next?.slot.className ?? "Open gym"}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] opacity-60">
          <Users className="size-3.5" /> {next ? `${next.slot.coach} · ${next.slot.spots} spots` : "No classes scheduled"}
        </p>
        <button
          onClick={() => {
            if (next) setPrefill({ goal: next.slot.className });
            scrollTo("#join");
          }}
          className="mt-4 flex h-10 w-full items-center justify-between rounded-full bg-accent pl-4 pr-1.5 text-[13px] font-semibold text-accent-ink transition-transform active:scale-[0.98]"
          data-cursor="hover"
        >
          <span className="tabular-nums">{when || "Book a trial"}</span>
          <span className="grid size-7 place-items-center rounded-full bg-accent-ink text-accent">
            <ArrowUpRight className="size-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ── Ticker under the hero ─────────────────────────────── */
export function Ticker() {
  const { content } = useSite();
  const items = content.hero.marquee;
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="marquee relative mt-4 overflow-hidden bg-accent py-4 text-accent-ink md:py-5">
      <div className="marquee-track" style={{ "--marquee-speed": "50s" } as React.CSSProperties}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, n) => (
              <span key={n} className="flex items-center">
                <span className="px-5 text-[clamp(22px,3.4vw,44px)] font-extrabold uppercase tracking-[-0.03em] [font-stretch:120%] md:px-8">
                  {t}
                </span>
                <span className="size-2.5 rotate-45 bg-accent-ink/80" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
