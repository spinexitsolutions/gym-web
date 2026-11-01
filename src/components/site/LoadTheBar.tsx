"use client";

import {
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useSite } from "./context";
import { EASE } from "./primitives";

/*
 * "Load the bar" — the house rules, told as a barbell being loaded.
 * The section pins; every scroll step slides a pair of plates onto the bar
 * with a little clank, the weight counter climbs, and the next rule appears.
 */

const PLATES = [
  { kg: 25, h: 262, w: 30, fill: "var(--accent)", ink: "var(--accent-ink)" },
  { kg: 20, h: 228, w: 27, fill: "var(--fg)", ink: "var(--bg)" },
  { kg: 15, h: 190, w: 24, fill: "#3a3a3f", ink: "#f2f0eb" },
  { kg: 10, h: 150, w: 21, fill: "color-mix(in oklab, var(--accent) 55%, #0b0b0c)", ink: "#f2f0eb" },
];
const BAR_KG = 20;
const CY = 160; // vertical centre of the bar in the SVG
const COLLAR_L = 262;
const COLLAR_R = 738;
const GAP = 4;

export default function LoadTheBar() {
  const { content } = useSite();
  const m = content.manifesto;
  const rules = m.principles.slice(0, PLATES.length);
  const n = rules.length;

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const seg = 1 / (n + 1);

  const [step, setStep] = useState(0); // 0..n  (n = closing state)
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    // a plate counts as "loaded" once its slide is ~finished
    const loaded = Math.max(0, Math.min(n, Math.floor((p - seg * 0.1) / seg + 0.05)));
    setStep(loaded);
  });

  const weight = BAR_KG + PLATES.slice(0, Math.min(step, n)).reduce((a, p) => a + p.kg * 2, 0);
  const weightSpring = useSpring(BAR_KG, { stiffness: 90, damping: 18 });
  useEffect(() => weightSpring.set(weight), [weight, weightSpring]);
  const weightText = useTransform(weightSpring, (v) => Math.round(v).toString());

  // clank: the bar dips when a plate locks in
  const [scope, animate] = useAnimate();
  const prev = useRef(0);
  useEffect(() => {
    if (step > prev.current && scope.current) {
      animate(scope.current, { y: [0, 7, -2, 0] }, { duration: 0.55, ease: "easeOut" });
    }
    prev.current = step;
  }, [step, animate, scope]);

  const active = Math.max(0, step - 1); // rule shown for the plate just loaded
  const isClosing = step >= n && n > 0;

  // cumulative x positions for each plate (outward from the collars)
  let acc = 0;
  const layout = PLATES.slice(0, n).map((p) => {
    const offset = acc;
    acc += p.w + GAP;
    return { ...p, left: COLLAR_L - GAP - offset - p.w, right: COLLAR_R + 16 + GAP + offset };
  });

  return (
    <section
      ref={ref}
      id="manifesto"
      data-nav="manifesto"
      className="relative"
      style={{ height: `${(n + 2) * 85}vh` }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pb-[110px] pt-20 md:pb-12 md:pt-32">
        {/* header */}
        <div className="container-x flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" />
              {m.eyebrow}
            </p>
            <h2 className="display text-[clamp(44px,8vw,112px)]">
              {m.title.split(" ").map((w, i, a) =>
                i === a.length - 1 ? (
                  <span key={i} className="serif-i text-accent">
                    {w}
                  </span>
                ) : (
                  <span key={i}>{w} </span>
                ),
              )}
            </h2>
          </div>
          <div className="hidden text-right md:block">
            <p className="eyebrow mb-2">On the bar</p>
            <p className="text-[56px] font-semibold leading-none tracking-[-0.05em] tabular-nums">
              <motion.span>{weightText}</motion.span>
              <span className="ml-1 font-mono text-[16px] tracking-normal text-muted">kg</span>
            </p>
          </div>
        </div>

        {/* the bar */}
        <div className="relative flex flex-1 items-center justify-center">
          {/* ghost weight behind the bar */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <motion.span className="text-outline select-none text-[clamp(150px,38vw,460px)] font-semibold leading-none tracking-[-0.07em] opacity-[0.16]">
              {weightText}
            </motion.span>
          </div>

          <svg viewBox="0 0 1000 320" className="relative w-[112%] max-w-none shrink-0 sm:w-full sm:max-w-[1180px]" aria-hidden>
            <defs>
              <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d9d9de" />
                <stop offset="0.45" stopColor="#8d8d94" />
                <stop offset="1" stopColor="#4a4a50" />
              </linearGradient>
              <pattern id="knurl" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
              </pattern>
            </defs>

            {/* floor shadow */}
            <ellipse cx="500" cy="300" rx="430" ry="9" fill="black" opacity="0.25" />

            <g ref={scope}>
              {/* shaft */}
              <rect x="40" y={CY - 6} width="920" height="12" rx="6" fill="url(#steel)" />
              <rect x="300" y={CY - 6} width="400" height="12" fill="url(#knurl)" />
              {/* sleeves */}
              <rect x="56" y={CY - 13} width={COLLAR_L - 56} height="26" rx="4" fill="url(#steel)" />
              <rect x={COLLAR_R + 16} y={CY - 13} width={944 - COLLAR_R - 16} height="26" rx="4" fill="url(#steel)" />
              {/* collars */}
              <rect x={COLLAR_L} y={CY - 32} width="16" height="64" rx="4" fill="url(#steel)" />
              <rect x={COLLAR_R} y={CY - 32} width="16" height="64" rx="4" fill="url(#steel)" />

              {layout.map((p, i) => (
                <PlatePair key={i} i={i} p={p} progress={scrollYProgress} seg={seg} />
              ))}
            </g>
          </svg>
        </div>

        {/* rule + progress */}
        <div className="container-x">
          <div className="grid gap-5 border-t border-line pt-6 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-12">
            <span className="font-mono text-[12px] text-muted md:pb-2">
              {isClosing ? "SET COMPLETE" : step === 0 ? "WARM-UP SET" : `RULE ${String(active + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`}
            </span>

            <div className="relative min-h-[96px] md:min-h-[84px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isClosing ? "closing" : active}
                  initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="flex flex-col gap-2 md:flex-row md:items-end md:gap-10"
                >
                  {isClosing ? (
                    <h3 className="serif-i text-[clamp(32px,4.6vw,60px)] leading-[0.95] text-accent">{m.closing}</h3>
                  ) : step === 0 ? (
                    <h3 className="text-[clamp(30px,4.2vw,56px)] font-semibold leading-[0.95] tracking-[-0.045em] text-muted">
                      Empty bar. 20 kg.
                      <span className="mt-2 block text-[15px] font-normal tracking-normal">Scroll to load it ↓</span>
                    </h3>
                  ) : (
                    <>
                      <h3 className="shrink-0 text-[clamp(32px,4.6vw,60px)] font-semibold leading-[0.95] tracking-[-0.045em]">
                        {rules[active]?.title}
                      </h3>
                      <p className="max-w-md text-[15px] leading-relaxed text-muted md:pb-1.5">{rules[active]?.text}</p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-4 md:justify-end">
              <span className="text-[34px] font-semibold tracking-[-0.05em] tabular-nums md:hidden">
                <motion.span>{weightText}</motion.span>
                <span className="ml-1 font-mono text-[13px] tracking-normal text-muted">kg</span>
              </span>
              <div className="flex items-center gap-1.5">
                {layout.map((p, i) => (
                  <span
                    key={i}
                    className="h-6 rounded-[3px] transition-all duration-500"
                    style={{
                      width: i < step ? 8 : 5,
                      background: i < step ? p.fill : "var(--faint)",
                      height: 12 + (PLATES.length - i) * 4,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatePair({
  i,
  p,
  progress,
  seg,
}: {
  i: number;
  p: (typeof PLATES)[number] & { left: number; right: number };
  progress: MotionValue<number>;
  seg: number;
}) {
  const start = seg * (i + 0.3);
  const end = seg * (i + 0.95);
  const t = useTransform(progress, [start, end], [0, 1], { clamp: true });
  const eased = useTransform(t, (v) => 1 - Math.pow(1 - v, 3));
  const xl = useTransform(eased, [0, 1], [-560, 0]);
  const xr = useTransform(eased, [0, 1], [560, 0]);
  const opacity = useTransform(t, [0, 0.25], [0, 1]);
  const y = CY - p.h / 2;

  const plate = (x: number) => (
    <>
      <rect x={x} y={y} width={p.w} height={p.h} rx="7" style={{ fill: p.fill }} />
      <rect x={x + 3} y={y + 10} width={p.w - 6} height={p.h - 20} rx="4" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
      <text
        x={x + p.w / 2}
        y={CY}
        transform={`rotate(-90 ${x + p.w / 2} ${CY})`}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono"
        style={{ fill: p.ink, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em" }}
      >
        {p.kg} KG
      </text>
    </>
  );

  return (
    <>
      <motion.g style={{ x: xl, opacity }}>{plate(p.left)}</motion.g>
      <motion.g style={{ x: xr, opacity }}>{plate(p.right)}</motion.g>
    </>
  );
}
