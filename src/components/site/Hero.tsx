"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { useSite } from "./context";
import { EASE, EASE_IO, Magnetic, PillButton, SplitReveal, useIsOpen } from "./primitives";

export default function Hero() {
  const { content, ready, scrollTo } = useSite();
  const { hero, contact, brand } = content;
  const ref = useRef<HTMLElement>(null);
  const status = useIsOpen(contact.openHour, contact.closeHour);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const radius = useTransform(scrollYProgress, [0, 1], [0, 48]);

  return (
    <section ref={ref} id="top" data-nav="top" className="relative h-[100svh] min-h-[640px] w-full">
      {/* media frame — opens from a rounded window to full bleed */}
      <motion.div
        className="absolute inset-0 overflow-hidden bg-[#0b0b0c]"
        initial={{ clipPath: "inset(18% 8% 18% 8% round 40px)" }}
        animate={ready ? { clipPath: "inset(0% 0% 0% 0% round 0px)" } : undefined}
        transition={{ duration: 1.6, ease: EASE_IO, delay: 0.1 }}
        style={{ borderBottomLeftRadius: radius, borderBottomRightRadius: radius }}
      >
        <motion.img
          src={hero.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ scale: imgScale, y: imgY }}
          initial={{ filter: "brightness(0.4) saturate(0)" }}
          animate={ready ? { filter: "brightness(0.62) saturate(0.85)" } : undefined}
          transition={{ duration: 2, ease: EASE }}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(11,11,12,0.95)_0%,rgba(11,11,12,0.2)_60%,transparent_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
        <div className="grain absolute inset-0" />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: fade }}
        className="container-x relative z-10 flex h-full flex-col justify-end pb-[calc(110px+env(safe-area-inset-bottom))] text-[#f2f0eb] md:pb-16"
      >
        {/* top meta row */}
        <motion.div
          className="absolute inset-x-5 top-6 flex items-center justify-between md:inset-x-10 md:top-28"
          initial={{ opacity: 0, y: -12 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 1, duration: 0.8, ease: EASE }}
        >
          <span className="text-[15px] font-semibold tracking-[-0.03em] md:hidden">{brand.name}</span>
          <span className="eyebrow hidden !text-white/60 md:block">{hero.eyebrow}</span>
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] backdrop-blur-md">
            <span className={`live-dot size-1.5 rounded-full ${status?.open ? "bg-[#30d158]" : "bg-white/40"}`} />
            {status?.label ?? " "}
          </span>
        </motion.div>

        <p className="eyebrow mb-5 !text-white/60 md:hidden">{hero.eyebrow}</p>

        <h1 className="display text-[clamp(64px,17.5vw,232px)]">
          {hero.lines.map((line, i) => (
            <SplitReveal
              key={i}
              text={line}
              play={ready}
              delay={0.45 + i * 0.14}
              className="block"
              highlight={hero.highlight}
            />
          ))}
        </h1>

        <div className="mt-8 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between">
          <motion.p
            className="max-w-md text-[16px] leading-relaxed text-white/70 md:text-[17px]"
            initial={{ opacity: 0, y: 20 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 1.05, duration: 1, ease: EASE }}
          >
            {hero.subtitle}
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 1.2, duration: 1, ease: EASE }}
          >
            <Magnetic>
              <PillButton onClick={() => scrollTo("#join")}>{hero.primaryCta}</PillButton>
            </Magnetic>
            <Magnetic>
              <PillButton
                variant="glass"
                className="!text-white"
                onClick={() => scrollTo("#programs")}
              >
                {hero.secondaryCta}
              </PillButton>
            </Magnetic>
          </motion.div>
        </div>

        <motion.button
          onClick={() => scrollTo("#manifesto")}
          className="absolute bottom-16 right-10 hidden size-14 place-items-center rounded-full ring-1 ring-white/25 lg:grid"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : undefined}
          transition={{ delay: 1.6 }}
          aria-label="Scroll down"
          data-cursor="hover"
        >
          <motion.span animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}>
            <ArrowDown className="size-5" />
          </motion.span>
        </motion.button>
      </motion.div>
    </section>
  );
}

export function Ticker() {
  const { content } = useSite();
  const items = content.hero.marquee;
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="marquee relative overflow-hidden border-y border-line py-5 md:py-7">
      <div className="marquee-track" style={{ "--marquee-speed": "45s" } as React.CSSProperties}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, i) => (
              <span key={i} className="flex items-center">
                <span
                  className={`px-6 text-[clamp(28px,5vw,64px)] font-semibold tracking-[-0.04em] md:px-10 ${
                    i % 2 ? "serif-i font-normal text-muted" : ""
                  }`}
                >
                  {t}
                </span>
                <span className="text-accent text-[clamp(18px,2.4vw,30px)]">✺</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
