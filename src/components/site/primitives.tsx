"use client";

import { motion, useInView, useMotionValue, useSpring, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_IO = [0.76, 0, 0.24, 1] as const;

/* ── Masked word-by-word reveal ─────────────────────────────── */
export function SplitReveal({
  text,
  className = "",
  wordClassName = "",
  delay = 0,
  stagger = 0.06,
  play,
  as: Tag = "span",
  highlight,
  highlightClassName = "hl text-accent",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  /** controlled play; when undefined plays on view */
  play?: boolean;
  as?: "span" | "h1" | "h2" | "h3" | "p";
  highlight?: string;
  highlightClassName?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const show = play ?? inView;
  const hl = new Set((highlight ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  const words = text.split(" ");
  const MotionTag = motion[Tag] as typeof motion.span;

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      initial="hidden"
      animate={show ? "show" : "hidden"}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom"
        >
          <motion.span
            className={`inline-block will-change-transform ${wordClassName} ${
              hl.has(w.toLowerCase()) ? highlightClassName : ""
            }`}
            variants={{
              hidden: { y: "110%", rotate: 4 },
              show: { y: "0%", rotate: 0, transition: { duration: 1, ease: EASE } },
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/* ── Fade + rise on view ─────────────────────────────────── */
export function FadeUp({
  children,
  delay = 0,
  className = "",
  y = 28,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
export const riseChild: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

/* ── Magnetic hover (pointer devices only) ───────────────── */
export function Magnetic({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      className="inline-block"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Pill CTA with rolling label + arrow ─────────────────── */
export function PillButton({
  children,
  onClick,
  href,
  variant = "accent",
  className = "",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "accent" | "glass" | "solid";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles = {
    accent: "bg-accent text-accent-ink",
    glass:
      "bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] text-fg backdrop-blur-xl ring-1 ring-inset ring-line",
    solid: "bg-fg text-bg",
  }[variant];
  const inner = (
    <>
      <span className="relative block overflow-hidden">
        <span className="block transition-transform duration-500 ease-[var(--ease-out)] group-hover:-translate-y-full">
          {children}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-[var(--ease-out)] group-hover:translate-y-0"
        >
          {children}
        </span>
      </span>
      <span
        className={`grid size-8 place-items-center rounded-full transition-transform duration-500 ease-[var(--ease-out)] group-hover:rotate-45 ${
          variant === "accent" ? "bg-accent-ink text-accent" : "bg-fg text-bg"
        } ${variant === "solid" ? "!bg-bg !text-fg" : ""}`}
      >
        <ArrowUpRight className="size-4" strokeWidth={2.2} />
      </span>
    </>
  );
  const cls = `group inline-flex h-12 items-center gap-3 rounded-full pl-6 pr-2 text-[15px] font-medium tracking-tight transition-[transform,opacity] active:scale-[0.97] disabled:opacity-60 ${styles} ${className}`;
  if (href)
    return (
      <a href={href} className={cls} data-cursor="hover" onClick={onClick}>
        {inner}
      </a>
    );
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} data-cursor="hover">
      {inner}
    </button>
  );
}

/* ── Count up when visible ───────────────────────────────── */
export function CountUp({ value, duration = 1.8 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return <span ref={ref}>{n.toLocaleString("en-IN")}</span>;
}

/* ── Section heading block ───────────────────────────────── */
export function SectionHead({
  eyebrow,
  title,
  highlight,
  aside,
  className = "",
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-6 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="max-w-3xl">
        <FadeUp>
          <p className="eyebrow mb-5 flex items-center gap-3">
            <span className="size-2 rounded-[2px] bg-accent" />
            {eyebrow}
          </p>
        </FadeUp>
        <SplitReveal
          as="h2"
          text={title}
          highlight={highlight}
          className="display block text-[clamp(40px,8.5vw,104px)]"
        />
      </div>
      {aside && <FadeUp delay={0.2} className="max-w-sm text-[15px] leading-relaxed text-muted">{aside}</FadeUp>}
    </div>
  );
}

/* ── Simple social glyphs (brand icons aren't in lucide) ─── */
export function SocialIcon({ name, className = "size-4" }: { name: "instagram" | "youtube" | "facebook" | "whatsapp"; className?: string }) {
  const paths: Record<string, ReactNode> = {
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </>
    ),
    youtube: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
      </>
    ),
    facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8z" />,
    whatsapp: (
      <>
        <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
        <path d="M9 8.5c0 3.5 2.5 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.4-2.6-1.8-3-3l1-1-1-2z" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function useIsOpen(openHour: number, closeHour: number) {
  const [state, setState] = useState<{ open: boolean; label: string } | null>(null);
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      const open = h >= openHour && h < closeHour;
      setState({
        open,
        label: open ? `Open now · closes ${closeHour}:00` : `Closed · opens ${openHour}:00`,
      });
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [openHour, closeHour]);
  return state;
}
