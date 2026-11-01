"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useSite } from "./context";
import { CountUp, EASE, FadeUp, SplitReveal } from "./primitives";

/* ───────────── Stats ───────────── */
export function Stats() {
  const { content } = useSite();
  return (
    <section data-nav="stats" className="container-x pb-24 md:pb-36">
      <div className="grid grid-cols-2 border-t border-line lg:grid-cols-4">
        {content.stats.map((s, i) => (
          <FadeUp
            key={s.id}
            delay={i * 0.08}
            className={`border-b border-line py-8 pr-4 md:py-12 ${i % 2 === 0 ? "border-r lg:border-r" : "lg:border-r"} ${
              i === content.stats.length - 1 ? "lg:border-r-0" : ""
            } ${i % 2 === 1 ? "pl-5 md:pl-8" : i > 0 ? "lg:pl-8" : ""}`}
          >
            <div className="text-[clamp(40px,7vw,96px)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
              <CountUp value={s.value} />
              <span className="text-accent">{s.suffix.trim().length > 2 ? <span className="ml-1 text-[0.4em] tracking-[-0.02em]">{s.suffix}</span> : s.suffix}</span>
            </div>
            <p className="mt-4 text-[14px] text-muted">{s.label}</p>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Programs: pinned horizontal scroll on desktop, swipe on mobile ───────────── */
export function Programs() {
  const { content } = useSite();
  const programs = content.programs;
  const outer = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!track.current) return;
      const d = track.current.scrollWidth - window.innerWidth;
      setDistance(window.innerWidth >= 1024 ? Math.max(0, d) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [programs.length]);

  const { scrollYProgress } = useScroll({ target: outer, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const Header = (
    <div className="flex w-full shrink-0 flex-col justify-between gap-8 lg:w-[34vw] lg:py-4 lg:pr-10">
      <div>
        <p className="eyebrow mb-5 flex items-center gap-3">
          <span className="size-2 rounded-[2px] bg-accent" />
          Programs
        </p>
        <SplitReveal
          as="h2"
          text="Built for every kind of strong."
          highlight="strong."
          className="display block text-[clamp(44px,6.4vw,104px)]"
        />
      </div>
      <p className="max-w-sm text-[15px] leading-relaxed text-muted">
        Five coached disciplines, one philosophy: master the basics, then progress with intent.{" "}
        <span className="hidden lg:inline">Scroll to explore →</span>
        <span className="lg:hidden">Swipe to explore →</span>
      </p>
    </div>
  );

  return (
    <section
      ref={outer}
      id="programs"
      data-nav="programs"
      className="relative"
      style={{ height: distance ? `calc(100vh + ${distance}px)` : undefined }}
    >
      <div className={distance ? "sticky top-0 flex h-screen items-center overflow-hidden" : "py-20"}>
        <motion.div
          ref={track}
          style={{ x }}
          className="flex w-full flex-col gap-10 lg:w-max lg:flex-row lg:items-stretch lg:gap-5 lg:pl-10 lg:pr-10"
        >
          <div className="container-x lg:!max-w-none lg:!p-0">{Header}</div>
          <div className="no-scrollbar -mt-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:px-10 lg:m-0 lg:gap-5 lg:overflow-visible lg:p-0">
            {programs.map((p, i) => (
              <ProgramCard key={p.id} p={p} i={i} total={programs.length} />
            ))}
          </div>
        </motion.div>

        {distance > 0 && (
          <div className="absolute bottom-10 left-10 right-10 h-px bg-line">
            <motion.div className="h-full bg-accent" style={{ width: bar }} />
          </div>
        )}
      </div>
    </section>
  );
}

function ProgramCard({ p, i, total }: { p: ReturnType<typeof useSite>["content"]["programs"][number]; i: number; total: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px -5% -10% 0px" }}
      transition={{ duration: 0.9, delay: (i % 3) * 0.08, ease: EASE }}
      className="group relative h-[68svh] max-h-[620px] min-h-[440px] w-[82vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-[28px] bg-card text-[#f2f0eb] lg:h-[72vh] lg:w-[30vw] lg:max-w-[460px]"
      data-cursor="view"
    >
      <img
        src={p.image}
        alt={p.title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-[var(--ease-out)] group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30" />

      <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[12px] text-white/60">
            {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] backdrop-blur-md">
            <Clock className="size-3.5" /> {p.duration}
          </span>
        </div>

        <div>
          <p className="mb-1.5 text-[15px] font-semibold uppercase tracking-[0.02em] text-white/75 [font-stretch:115%]">{p.tagline}</p>
          <h3 className="text-[clamp(44px,5vw,64px)] font-semibold leading-[0.9] tracking-[-0.05em]">{p.title}</h3>

          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-700 ease-[var(--ease-out)] group-hover:grid-rows-[1fr] max-lg:grid-rows-[1fr]">
            <p className="overflow-hidden text-[14.5px] leading-relaxed text-white/70">
              <span className="block pt-4">{p.description}</span>
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full border border-white/20 px-2.5 py-1 text-[11.5px] text-white/80">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="eyebrow !text-[9.5px] !text-white/50">Intensity</span>
              <div className="flex items-end gap-[3px]">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`w-[5px] rounded-full ${n <= p.intensity ? "bg-accent" : "bg-white/20"}`}
                    style={{ height: 6 + n * 3 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ───────────── Reveal: Apple-style image that grows to full-bleed ───────────── */
export function Reveal() {
  const { content } = useSite();
  const r = content.reveal;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const clip = useTransform(
    scrollYProgress,
    [0, 0.5],
    ["inset(22% 14% 22% 14% round 36px)", "inset(0% 0% 0% 0% round 0px)"],
  );
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.35, 1, 1.08]);
  const headOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);
  const headY = useTransform(scrollYProgress, [0, 0.22], ["0%", "-40%"]);
  const textOpacity = useTransform(scrollYProgress, [0.48, 0.66], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.48, 0.66], [60, 0]);
  const shade = useTransform(scrollYProgress, [0.35, 0.6], [0, 0.55]);

  return (
    <section ref={ref} id="reveal" data-nav="reveal" className="relative h-[280vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div
          style={{ opacity: headOpacity, y: headY }}
          className="pointer-events-none absolute inset-x-0 top-[9%] z-10 text-center"
        >
          <p className="eyebrow">{r.eyebrow}</p>
        </motion.div>

        <motion.div style={{ clipPath: clip }} className="absolute inset-0 bg-[#0b0b0c]">
          <motion.img
            src={r.image}
            alt=""
            loading="lazy"
            style={{ scale: imgScale }}
            className="h-full w-full object-cover"
          />
          <motion.div style={{ opacity: shade }} className="absolute inset-0 bg-black" />
        </motion.div>

        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="container-x absolute inset-x-0 bottom-[16%] z-10 text-[#f2f0eb] md:bottom-[12%]"
        >
          <h2 className="display max-w-[14ch] text-[clamp(44px,8vw,128px)]">{r.title}</h2>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/75 md:text-[18px]">{r.text}</p>
        </motion.div>
      </div>
    </section>
  );
}
