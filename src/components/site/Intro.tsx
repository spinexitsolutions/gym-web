"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { IntroSettings } from "@/lib/types";
import { EASE, EASE_IO } from "./primitives";
import Led from "./Led";

const KEY = "gym_intro_seen";

export default function Intro({
  settings,
  brand,
  tagline,
  onDone,
}: {
  settings: IntroSettings;
  brand: string;
  tagline: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [count, setCount] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const duration = Math.max(1200, Math.min(settings.durationMs, 8000));

  // skip logic
  useEffect(() => {
    let seen = false;
    try {
      seen = settings.oncePerSession && sessionStorage.getItem(KEY) === "1";
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen) {
      setVisible(false);
      onDone();
      return;
    }
    const total = reduced ? 600 : duration;

    // counter 0 → 100 with an eased curve
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / total);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      setCount(Math.round(eased * 100));
      setWordIdx(Math.min(settings.words.length - 1, Math.floor(p * settings.words.length)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const t1 = setTimeout(() => setVisible(false), total + 250);
    const t2 = setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      onDone();
    }, total + 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    setVisible(false);
    setTimeout(onDone, 400);
  };

  const letters = brand.split("");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[200]"
          exit={{ pointerEvents: "none" }}
          transition={{ duration: 1.2 }}
        >
          {/* accent curtain beneath */}
          <motion.div
            className="tape absolute inset-0"
            initial={{ clipPath: "inset(0 0 0 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 1, ease: EASE_IO, delay: 0.12 } }}
          />
          {/* main curtain */}
          <motion.div
            className="absolute inset-0 overflow-hidden bg-[#0b0b0c] text-[#f2f0eb]"
            initial={{ clipPath: "inset(0 0 0 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.95, ease: EASE_IO } }}
          >
            <div className="grain absolute inset-0" />

            {settings.style === "counter" && (
              <>
                <div className="absolute inset-0 grid place-items-center px-6">
                  <div className="text-center">
                    <div className="flex justify-center overflow-hidden">
                      {letters.map((l, i) => (
                        <motion.span
                          key={i}
                          className="display inline-block text-[clamp(52px,15vw,190px)]"
                          initial={{ y: "105%" }}
                          animate={{ y: "0%" }}
                          transition={{ duration: 1, ease: EASE, delay: 0.15 + i * 0.06 }}
                        >
                          {l === " " ? " " : l}
                        </motion.span>
                      ))}
                    </div>
                    <motion.p
                      className="eyebrow mt-4 !text-[#f2f0eb]/60"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.8, ease: EASE }}
                    >
                      {tagline}
                    </motion.p>
                  </div>
                </div>
                <div className="absolute inset-x-5 bottom-6 flex items-end justify-between md:inset-x-10 md:bottom-10">
                  <Led text={String(count).padStart(3, "0")} className="h-[clamp(70px,16vw,190px)]" />
                  <span className="eyebrow mb-2 hidden text-right !text-[#f2f0eb]/50 sm:block">
                    {settings.words[wordIdx] ?? "Loading"}
                    <br />
                    Warming up the floor
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                  <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${count / 100})` }} />
                </div>
              </>
            )}

            {settings.style === "words" && (
              <div className="absolute inset-0 grid place-items-center px-6">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={wordIdx}
                    className={`display text-center text-[clamp(64px,20vw,260px)] ${
                      wordIdx === settings.words.length - 1 ? "hl text-accent" : ""
                    }`}
                    initial={{ opacity: 0, scale: 0.86, filter: "blur(12px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.08, filter: "blur(10px)" }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    {settings.words[wordIdx]}
                  </motion.span>
                </AnimatePresence>
                <span className="eyebrow absolute bottom-8 left-1/2 -translate-x-1/2 !text-[#f2f0eb]/50">
                  {brand} — {String(count).padStart(3, "0")}
                </span>
              </div>
            )}

            {settings.style === "minimal" && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-6">
                  <svg viewBox="0 0 60 90" className="h-24 w-16" fill="none">
                    <motion.rect
                      x="4"
                      y="4"
                      width="52"
                      height="82"
                      rx="6"
                      stroke="currentColor"
                      strokeWidth="3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: duration / 1000 - 0.3, ease: EASE }}
                    />
                    <rect
                      x="4"
                      y="4"
                      width="52"
                      height="82"
                      rx="6"
                      className="fill-accent"
                      style={{ clipPath: `inset(${100 - count}% 0 0 0)` }}
                    />
                  </svg>
                  <motion.span
                    className="display text-3xl tracking-[-0.03em]"
                    initial={{ opacity: 0, letterSpacing: "0.3em" }}
                    animate={{ opacity: 1, letterSpacing: "-0.03em" }}
                    transition={{ duration: 1.4, ease: EASE }}
                  >
                    {brand}
                  </motion.span>
                </div>
              </div>
            )}

            <button
              onClick={skip}
              className="eyebrow absolute right-5 top-5 rounded-full px-3 py-2 !text-[#f2f0eb]/50 transition hover:!text-[#f2f0eb] md:right-10 md:top-8"
            >
              Skip
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
