"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useSite } from "./context";
import Led from "./Led";
import { EASE, EASE_IO, Magnetic, PillButton } from "./primitives";

/*
 * Hero = a live interval timer.
 * The red LED clock runs a real EMOM-style loop (work → rest → next round).
 * Every round is a station: the photo, program name and tags change with it.
 */

const WORK = 20;
const REST = 10;

export default function Hero() {
  const { content, ready } = useSite();
  const { hero, programs, stats } = content;
  const stations = programs;
  const n = Math.max(1, stations.length);

  const [t, setT] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const i = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [ready]);

  const cycle = WORK + REST;
  const round = Math.floor(t / cycle) % n;
  const inCycle = t % cycle;
  const working = inCycle < WORK;
  const remaining = working ? WORK - inCycle : cycle - inCycle;
  const station = stations[round];
  const next = stations[(round + 1) % n];
  const pct = working ? (inCycle + 1) / WORK : (inCycle - WORK + 1) / REST;

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const headY = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);

  const [line1 = "", line2 = ""] = hero.lines;
  const hl = new Set(hero.highlight.toLowerCase().split(/\s+/).filter(Boolean));

  return (
    <section ref={ref} id="top" data-nav="top" className="concrete relative overflow-hidden pb-12 pt-[84px] md:pb-16 md:pt-[124px]">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-3 md:px-5 lg:grid-cols-12 lg:gap-5">
        {/* ── station photo ── */}
        <motion.div
          className="relative h-[62svh] min-h-[420px] overflow-hidden bg-[#141414] lg:col-span-7 lg:h-[calc(100svh-170px)] lg:min-h-[560px]"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={ready ? { clipPath: "inset(0 0% 0 0)" } : undefined}
          transition={{ duration: 1.2, ease: EASE_IO, delay: 0.15 }}
        >
          <motion.div className="absolute inset-0" style={{ y: photoY }}>
            <AnimatePresence initial={false}>
              <motion.img
                key={station?.id ?? "hero"}
                src={station?.image ?? hero.image}
                alt={station?.title ?? ""}
                className="absolute inset-0 h-[112%] w-full object-cover grayscale contrast-[1.2]"
                initial={{ clipPath: "inset(0 0 0 100%)", scale: 1.15 }}
                animate={{ clipPath: "inset(0 0 0 0%)", scale: 1 }}
                exit={{ opacity: 0.6 }}
                transition={{ duration: 0.9, ease: EASE_IO }}
              />
            </AnimatePresence>
          </motion.div>
          {/* rest = lights dim */}
          <motion.div className="absolute inset-0 bg-black" animate={{ opacity: working ? 0.2 : 0.6 }} transition={{ duration: 0.6 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          {/* go flash */}
          <AnimatePresence>
            {ready && inCycle === 0 && (
              <motion.div key={`flash-${t}`} className="absolute inset-0 bg-accent mix-blend-multiply" initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} />
            )}
          </AnimatePresence>

          {/* station label */}
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between font-mono text-[13px] uppercase text-white md:left-6 md:right-6 md:top-6">
            <span className="bg-black/70 px-2.5 py-1.5">
              Station <span className="text-accent">{String(round + 1).padStart(2, "0")}</span> / {String(n).padStart(2, "0")}
            </span>
            <span className="hidden gap-1.5 sm:flex">
              {station?.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="border border-white/30 bg-black/40 px-2 py-1 text-[11.5px]">
                  {tag}
                </span>
              ))}
            </span>
          </div>

          {/* headline on the photo */}
          <motion.h1
            style={{ y: headY }}
            className="display absolute bottom-6 left-4 right-4 text-[clamp(60px,17vw,120px)] text-white md:bottom-9 md:left-6 lg:text-[clamp(96px,10.2vw,184px)]"
            aria-label={hero.lines.join(" ")}
          >
            {[line1, line2].map((line, li) => (
              <span key={li} className="block">
                {line
                  .split(" ")
                  .filter(Boolean)
                  .map((w, k) => (
                    <span key={k} className="mr-[0.18em] inline-block overflow-hidden align-bottom last:mr-0">
                      <motion.span
                        className={`inline-block ${hl.has(w.toLowerCase()) ? "hl text-accent" : ""}`}
                        initial={{ y: "102%" }}
                        animate={ready ? { y: "0%" } : undefined}
                        transition={{ duration: 0.9, ease: EASE, delay: 0.55 + li * 0.12 + k * 0.06 }}
                      >
                        {w}
                      </motion.span>
                    </span>
                  ))}
              </span>
            ))}
          </motion.h1>
          <div className="tape absolute bottom-0 right-0 h-3 w-1/3" />
        </motion.div>

        {/* ── right column: timer + pitch ── */}
        <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
          <motion.div
            className="relative border border-white/10 bg-black p-4 text-[#ecebe4] md:p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
          >
            {/* screws */}
            {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((p) => (
              <span key={p} className={`absolute ${p} grid size-2.5 place-items-center rounded-full bg-white/15`}>
                <span className="h-px w-1.5 rotate-45 bg-black/70" />
              </span>
            ))}

            <div className="flex items-center justify-between px-1 font-mono text-[12px] uppercase text-white/45">
              <span>{content.brand.name} interval</span>
              <span>EMOM · {n} rds</span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 border border-white/[0.06] bg-[#050505] px-4 py-4 md:px-6 md:py-6">
              <Led
                text={`00:${String(remaining).padStart(2, "0")}`}
                color={working ? "var(--led)" : "var(--led-go)"}
                className="h-[clamp(64px,17vw,96px)] lg:h-[clamp(72px,7vw,124px)]"
                label={`${remaining} seconds ${working ? "work" : "rest"}`}
              />
              <div className="flex flex-col items-end gap-2">
                <span className="px-2.5 py-1 font-mono text-[14px] uppercase text-black transition-colors" style={{ background: working ? "var(--led)" : "var(--led-go)" }}>
                  {working ? "Work" : "Rest"}
                </span>
                <span className="font-mono text-[12px] uppercase text-white/45">
                  Rd {round + 1}/{n}
                </span>
              </div>
            </div>

            {/* phase progress */}
            <div className="mt-3 h-1.5 bg-white/[0.06]">
              <div
                className="h-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.min(100, pct * 100)}%`, background: working ? "var(--led)" : "var(--led-go)" }}
              />
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[12px] uppercase text-white/45">{working ? "Now training" : "Up next"}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${working}-${working ? station?.id : next?.id}`}
                    className="display mt-1 truncate text-[clamp(40px,10vw,64px)]"
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -24, opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    {(working ? station?.title : next?.title) ?? "Open gym"}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="flex shrink-0 gap-1">
                {stations.map((s, k) => (
                  <span
                    key={s.id}
                    className="h-8 w-2.5 transition-colors duration-500"
                    style={{ background: k < round ? "#ecebe4" : k === round ? "var(--accent)" : "rgba(255,255,255,0.1)" }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="flex flex-1 flex-col justify-between gap-6 border border-line p-4 md:p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
          >
            <div>
              <p className="eyebrow flex items-center gap-2">
                <span className="tape-thin h-2.5 w-8" /> {hero.eyebrow}
              </p>
              <p className="mt-4 max-w-[40ch] text-[17px] leading-[1.5] text-muted md:text-[18px]">{hero.subtitle}</p>
            </div>
            <div className="grid grid-cols-3 border-y border-line">
              {stats.slice(0, 3).map((s, k) => (
                <div key={s.id} className={`py-3 ${k ? "border-l border-line pl-3" : ""}`}>
                  <p className="display text-[clamp(28px,7vw,40px)]">
                    {s.value.toLocaleString("en-IN")}
                    <span className="text-accent">{s.suffix.trim().length > 2 ? "" : s.suffix}</span>
                  </p>
                  <p className="font-mono text-[11.5px] uppercase text-muted">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Magnetic>
                <PillButton href="#join">{hero.primaryCta}</PillButton>
              </Magnetic>
              <PillButton href="#programs" variant="glass">
                {hero.secondaryCta}
              </PillButton>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── caution-tape ticker under the hero ─────────────────── */
export function Ticker() {
  const { content } = useSite();
  const items = content.hero.marquee;
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden bg-accent text-accent-ink">
      <div className="tape h-2" />
      <div className="marquee overflow-hidden py-3 md:py-4">
        <div className="marquee-track" style={{ "--marquee-speed": "45s" } as React.CSSProperties}>
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {row.map((t, i) => (
                <span key={i} className="flex items-center">
                  <span className={`display px-5 text-[clamp(30px,4.6vw,60px)] md:px-8 ${i % 2 ? "hl" : ""}`}>{t}</span>
                  <svg viewBox="0 0 24 12" className="h-4 w-8" aria-hidden>
                    <rect x="0" y="5" width="24" height="2" fill="currentColor" />
                    <rect x="3" y="0" width="3" height="12" fill="currentColor" />
                    <rect x="18" y="0" width="3" height="12" fill="currentColor" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="tape h-2" />
    </div>
  );
}
