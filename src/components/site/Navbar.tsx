"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Phone, X } from "lucide-react";
import { MENU_SECTIONS, SECTION_NAV, useSite } from "./context";
import Led from "./Led";
import { EASE, EASE_IO, SocialIcon, useIsOpen } from "./primitives";

/**
 * "Timer bar" navigation — styled like the wall-mounted interval timer
 * of a strength gym: hard edges, numbered stations, a live LED clock,
 * caution-tape scroll progress. The menu opens as a full-screen
 * "whiteboard" with every station listed like a workout.
 */
export default function Navbar() {
  const { content, scrollTo, lenis, ready } = useSite();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState("top");
  const [hover, setHover] = useState<string | null>(null);
  const [bar, setBar] = useState(content.brand.announcement.enabled);
  const [atTop, setAtTop] = useState(true);
  const clock = useClock();
  const status = useIsOpen(content.contact.openHour, content.contact.closeHour);

  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  const enabled = new Set(content.sections.filter((s) => s.enabled).map((s) => s.id as string));
  const menu = MENU_SECTIONS.filter((id) => enabled.has(id));
  const inline = ["programs", "trainers", "schedule", "pricing"].filter((id) => enabled.has(id));

  const meta = useMemo(() => {
    const min = Math.min(...content.plans.map((p) => p.monthly));
    return {
      programs: { note: `${content.programs.length} disciplines`, img: content.programs[0]?.image },
      reveal: { note: "the floor", img: content.reveal.image },
      trainers: { note: `${content.trainers.length} coaches`, img: content.trainers[0]?.image },
      schedule: { note: `${content.schedule.length} classes / wk`, img: content.programs[1]?.image },
      pricing: { note: Number.isFinite(min) ? `from ${content.currency}${min.toLocaleString("en-IN")}` : "plans", img: content.programs[2]?.image },
      testimonials: { note: `${content.testimonials.length} stories`, img: content.gallery[1]?.image },
      faq: { note: `${content.faqs.length} answers`, img: content.gallery[2]?.image },
      join: { note: "7 days free", img: content.join.image },
    } as Record<string, { note: string; img?: string }>;
  }, [content]);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setAtTop(y < 30);
    if (open) return;
    if (y > 500 && y > prev + 4) setHidden(true);
    else if (y < prev - 4) setHidden(false);
  });

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.getAttribute("data-nav")!)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [content.sections]);

  useEffect(() => {
    if (!lenis) return;
    if (open) lenis.stop();
    else lenis.start();
  }, [open, lenis]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (id: string) => {
    const wasOpen = open;
    setOpen(false);
    setTimeout(() => scrollTo(id === "top" ? 0 : `#${id}`), wasOpen ? 450 : 0);
  };

  const showBar = bar && atTop;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-[90] text-[#ecebe4]"
        initial={{ y: "-100%" }}
        animate={{ y: !ready || (hidden && !open) ? "-100%" : "0%" }}
        transition={{ duration: 0.7, ease: EASE, delay: ready && !hidden ? 0.4 : 0 }}
      >
        {/* announcement strip */}
        <AnimatePresence initial={false}>
          {showBar && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 34 }}
              exit={{ height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative overflow-hidden bg-accent text-accent-ink"
            >
              <a href={content.brand.announcement.link || "#join"} className="flex h-[34px] items-center justify-center gap-3 px-10 font-mono text-[13px] uppercase">
                <span className="tape-thin hidden h-3 w-10 sm:block" />
                <span className="truncate">{content.brand.announcement.text}</span>
                <span className="tape-thin hidden h-3 w-10 sm:block" />
              </a>
              <button onClick={() => setBar(false)} aria-label="Dismiss" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center">
                <X className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative border-b border-white/10 bg-[#0b0b0b]/92 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 pl-3 pr-3 md:h-[72px] md:gap-6 md:pl-5 md:pr-5">
            {/* logo block */}
            <button onClick={() => go("top")} className="flex items-center gap-3" aria-label="Home" data-cursor="hover">
              <span className="cut-sm grid size-10 place-items-center bg-accent text-accent-ink md:size-11">
                <span className="display text-[26px] leading-none md:text-[28px]">{content.brand.shortName}</span>
              </span>
              <span className="text-left leading-none">
                <span className="display block text-[22px] tracking-[0.01em] md:text-[26px]">{content.brand.name}</span>
                <span className="mt-1 hidden font-mono text-[10.5px] uppercase text-white/45 sm:block">{content.brand.tagline}</span>
              </span>
            </button>

            {/* stations */}
            <nav className="ml-4 hidden h-full items-stretch lg:flex" aria-label="Main">
              {inline.map((id, i) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`group relative flex items-center gap-2 border-l border-white/10 px-5 font-mono text-[15px] uppercase transition-colors last:border-r ${
                    active === id ? "text-accent" : "text-white/75 hover:text-white"
                  }`}
                  data-cursor="hover"
                >
                  <span className="text-[11px] text-white/35">{String(i + 1).padStart(2, "0")}</span>
                  {SECTION_NAV[id]}
                  <span
                    className={`absolute inset-x-0 bottom-0 h-[3px] origin-left bg-accent transition-transform duration-500 ease-[var(--ease-out)] ${
                      active === id ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              {/* live LED clock */}
              <div className="hidden items-center gap-3 border border-white/10 bg-black px-3 py-2 md:flex" title="Local time">
                <span className="flex flex-col font-mono text-[9.5px] uppercase leading-tight text-white/40">
                  <span>{status?.open ? "Open" : "Closed"}</span>
                  <span className={status?.open ? "text-[var(--led-go)]" : "text-[var(--led)]"}>● live</span>
                </span>
                <Led text={clock ?? "--:--"} className="h-6" blinkColon />
              </div>

              {enabled.has("join") && (
                <button
                  onClick={() => go("join")}
                  className="cut-sm h-10 bg-accent px-4 font-mono text-[14px] uppercase text-accent-ink transition-transform active:scale-95 md:h-11 md:px-5"
                  data-cursor="hover"
                >
                  Join<span className="hidden sm:inline"> free</span>
                </button>
              )}

              <button
                onClick={() => setOpen((o) => !o)}
                className="grid size-10 place-items-center border border-white/15 transition-colors hover:border-accent md:size-11"
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                data-cursor="hover"
              >
                <BarbellIcon open={open} />
              </button>
            </div>
          </div>

          {/* caution-tape scroll progress */}
          <motion.div className="tape-thin absolute inset-x-0 -bottom-px h-[3px] origin-left" style={{ scaleX: progress }} />
        </div>
      </motion.header>

      {/* ── whiteboard menu ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="concrete fixed inset-0 z-[85] overflow-y-auto text-[#ecebe4]"
            style={{ ["--bg" as string]: "#0b0b0b", ["--fg" as string]: "#ecebe4" }}
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.75, ease: EASE_IO }}
          >
            <div className="tape h-2.5 w-full" />
            <div className="mx-auto grid min-h-[calc(100svh-10px)] max-w-[1600px] gap-8 px-5 pb-10 pt-24 md:grid-cols-[1.3fr_1fr] md:px-10 md:pt-32">
              <div className="flex flex-col justify-between">
                <p className="font-mono text-[13px] uppercase text-white/40">Today&apos;s session — pick a station</p>
                <ul className="mt-6 border-t border-white/10" onMouseLeave={() => setHover(null)}>
                  {menu.map((id, i) => (
                    <motion.li
                      key={id}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05, duration: 0.6, ease: EASE }}
                      className="border-b border-white/10"
                    >
                      <button
                        onClick={() => go(id)}
                        onMouseEnter={() => setHover(id)}
                        className="group flex w-full items-baseline gap-4 py-2.5 text-left md:py-3"
                        data-cursor="hover"
                      >
                        <span className="w-8 font-mono text-[13px] text-white/35">{String(i + 1).padStart(2, "0")}</span>
                        <span
                          className={`display text-[clamp(40px,9vw,92px)] leading-[0.9] transition-all duration-300 group-hover:translate-x-2 group-hover:text-accent ${
                            active === id ? "text-accent" : ""
                          }`}
                        >
                          {SECTION_NAV[id]}
                        </span>
                        <span className="ml-auto hidden font-mono text-[13px] uppercase text-white/40 sm:block">{meta[id]?.note}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <motion.aside
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7, ease: EASE }}
                className="flex flex-col gap-4"
              >
                <div className="relative hidden aspect-[4/3] overflow-hidden bg-[#141414] md:block">
                  <AnimatePresence mode="popLayout">
                    <motion.img
                      key={hover ?? "default"}
                      src={meta[hover ?? "programs"]?.img ?? content.hero.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover grayscale contrast-125"
                      initial={{ opacity: 0, scale: 1.08 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                    />
                  </AnimatePresence>
                  <div className="tape absolute bottom-0 left-0 h-3 w-1/2" />
                </div>
                <div className="border border-white/10 bg-black p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] uppercase text-white/45">{status?.label ?? "—"}</span>
                    <Led text={clock ?? "--:--"} className="h-9" blinkColon />
                  </div>
                  <p className="mt-4 flex gap-2 text-[15px] text-white/70">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-accent" /> {content.contact.address}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <a href={`tel:${content.contact.phone.replace(/\s/g, "")}`} className="flex h-14 items-center justify-center gap-2 border border-white/15 font-mono text-[15px] uppercase">
                    <Phone className="size-4" /> Call
                  </a>
                  <a href={`https://wa.me/${content.contact.whatsapp}`} target="_blank" rel="noreferrer" className="cut-sm flex h-14 items-center justify-center gap-2 bg-accent font-mono text-[15px] uppercase text-accent-ink">
                    <SocialIcon name="whatsapp" /> WhatsApp
                  </a>
                </div>
              </motion.aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Menu icon drawn as a barbell; swaps to a hard X when open. */
function BarbellIcon({ open }: { open: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }}>
          <X className="size-5" strokeWidth={2.5} />
        </motion.span>
      ) : (
        <motion.svg key="bar" viewBox="0 0 24 24" className="size-6" initial={{ scaleX: 0.4, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0.4, opacity: 0 }} transition={{ duration: 0.25 }} fill="currentColor">
          <rect x="2" y="11" width="20" height="2" />
          <rect x="5" y="7" width="2.5" height="10" />
          <rect x="16.5" y="7" width="2.5" height="10" />
          <rect x="3" y="9" width="1.5" height="6" />
          <rect x="19.5" y="9" width="1.5" height="6" />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

function useClock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setT(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 10_000);
    return () => clearInterval(i);
  }, []);
  return t;
}
