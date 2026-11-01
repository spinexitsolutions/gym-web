"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { MENU_SECTIONS, SECTION_NAV, useSite } from "./context";
import { EASE, SocialIcon, useIsOpen } from "./primitives";

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

/**
 * "Island" navigation — a single black capsule that lives at the
 * bottom of the screen on phones (thumb zone) and floats at the top on
 * desktop. It shows the section you're in, a scroll-progress ring,
 * and morphs into a full menu card when opened.
 */
export default function Navbar({ announcement }: { announcement: boolean }) {
  const { content, scrollTo, lenis, ready } = useSite();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState("top");
  const [hover, setHover] = useState<string | null>(null);
  const desktop = useMedia("(min-width: 768px)");
  const status = useIsOpen(content.contact.openHour, content.contact.closeHour);

  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const topOffset = useTransform(scrollY, [0, 44], announcement ? [56, 16] : [16, 16]);
  const navTop = useTransform(topOffset, (v) => `${v}px`);

  const enabled = new Set(content.sections.filter((s) => s.enabled).map((s) => s.id as string));
  const menu = MENU_SECTIONS.filter((id) => enabled.has(id));
  const inline = ["programs", "trainers", "schedule", "pricing"].filter((id) => enabled.has(id));

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (open) return;
    setHidden(desktop && y > 400 && y > prev + 2 ? true : y < prev - 2 ? false : hidden);
  });

  // which section is on screen
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.getAttribute("data-nav")!));
      },
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
    setOpen(false);
    setTimeout(() => scrollTo(id === "top" ? 0 : `#${id}`), open ? 350 : 0);
  };

  const label = SECTION_NAV[active] ?? "Home";
  const circ = 2 * Math.PI * 21;
  const dash = useTransform(progress, (v) => circ * (1 - v));

  return (
    <>
      {/* dim + blur the page while the island is expanded */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.header
        className="pointer-events-none fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-[90] flex justify-center px-3 md:bottom-auto md:top-[var(--nav-top)]"
        style={{ "--nav-top": navTop } as unknown as React.CSSProperties}
        initial={{ y: desktop ? -120 : 120, opacity: 0 }}
        animate={{
          y: !ready ? (desktop ? -120 : 120) : hidden ? -140 : 0,
          opacity: ready ? 1 : 0,
        }}
        transition={{ duration: 0.9, ease: EASE, delay: ready && !hidden ? 0.5 : 0 }}
      >
        <motion.nav
          layout
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          style={{ borderRadius: open ? 30 : 999 }}
          className={`pointer-events-auto relative flex overflow-hidden bg-[#0d0d0f]/85 text-[#f2f0eb] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150 ${
            open ? "w-[min(94vw,520px)] flex-col-reverse md:flex-col" : "w-full max-w-[440px] flex-col md:w-auto md:max-w-none"
          }`}
          aria-label="Main"
        >
          {/* ── capsule row ── */}
          <motion.div layout="position" className="flex h-[60px] items-center gap-2 pl-2 pr-2">
            <button
              onClick={() => go("top")}
              className="relative grid size-11 shrink-0 place-items-center"
              aria-label="Back to top"
              data-cursor="hover"
            >
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                <motion.circle
                  cx="22"
                  cy="22"
                  r="21"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  style={{ strokeDashoffset: dash }}
                />
              </svg>
              <span className="grid size-[34px] place-items-center rounded-full bg-accent text-[13px] font-bold tracking-tight text-accent-ink">
                {content.brand.shortName}
              </span>
            </button>

            {/* mobile: live section label */}
            <div className="relative h-5 min-w-0 flex-1 overflow-hidden md:hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={open ? "menu" : label}
                  className="absolute inset-0 truncate text-[14px] font-medium tracking-tight"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  {open ? content.brand.name : label}
                  {!open && <span className="ml-2 text-white/40">· {content.brand.name}</span>}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* desktop: brand + inline links */}
            {!open && (
              <div className="hidden items-center md:flex" onMouseLeave={() => setHover(null)}>
                <span className="px-3 text-[14px] font-semibold tracking-[-0.02em]">{content.brand.name}</span>
                <span className="mx-1 h-5 w-px bg-white/10" />
                {inline.map((id) => (
                  <button
                    key={id}
                    onClick={() => go(id)}
                    onMouseEnter={() => setHover(id)}
                    className="relative px-4 py-2 text-[13.5px] text-white/70 transition-colors hover:text-white"
                    data-cursor="hover"
                  >
                    {hover === id && (
                      <motion.span
                        layoutId="nav-hover"
                        className="absolute inset-0 rounded-full bg-white/10"
                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="relative">{SECTION_NAV[id]}</span>
                    {active === id && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            {open && <div className="hidden flex-1 md:block" />}

            {enabled.has("join") && !open && (
              <button
                onClick={() => go("join")}
                className="h-11 shrink-0 rounded-full bg-accent px-5 text-[13.5px] font-semibold tracking-tight text-accent-ink transition-transform active:scale-95 md:ml-2"
                data-cursor="hover"
              >
                Join<span className="hidden sm:inline"> free</span>
              </button>
            )}

            <button
              onClick={() => setOpen((o) => !o)}
              className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${
                open ? "ml-auto bg-white/10" : "bg-white/[0.06] hover:bg-white/10"
              }`}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              data-cursor="hover"
            >
              <span className="relative block h-3 w-[18px]">
                <motion.span
                  className="absolute left-0 h-[1.5px] w-full rounded bg-current"
                  animate={open ? { top: 5, rotate: 45 } : { top: 0, rotate: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
                <motion.span
                  className="absolute left-0 h-[1.5px] rounded bg-current"
                  animate={open ? { top: 5, rotate: -45, width: "100%" } : { top: 10, rotate: 0, width: "60%" }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              </span>
            </button>
          </motion.div>

          {/* ── expanded menu ── */}
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="menu"
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.12 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="px-3 pt-3 md:pb-3"
              >
                <ul className="flex flex-col">
                  {menu.map((id, i) => (
                    <motion.li
                      key={id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.04, duration: 0.6, ease: EASE }}
                    >
                      <button
                        onClick={() => go(id)}
                        className="group flex w-full items-baseline gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                        data-cursor="hover"
                      >
                        <span className="font-mono text-[11px] text-white/35">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-[30px] font-semibold leading-none tracking-[-0.04em] transition-transform duration-500 ease-[var(--ease-out)] group-hover:translate-x-1.5 sm:text-[34px]">
                          {SECTION_NAV[id]}
                        </span>
                        {active === id && <span className="ml-auto size-1.5 self-center rounded-full bg-accent" />}
                      </button>
                    </motion.li>
                  ))}
                </ul>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pb-3 pt-4"
                >
                  <div className="col-span-2 flex items-center justify-between px-3 text-[12px] text-white/50">
                    <span className="flex items-center gap-2">
                      <span className={`live-dot size-1.5 rounded-full ${status?.open ? "bg-[#30d158]" : "bg-white/40"}`} />
                      {status?.label ?? "—"}
                    </span>
                    <span className="flex gap-3">
                      <a href={content.contact.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><SocialIcon name="instagram" /></a>
                      <a href={content.contact.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><SocialIcon name="youtube" /></a>
                    </span>
                  </div>
                  <a
                    href={`tel:${content.contact.phone.replace(/\s/g, "")}`}
                    className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-medium"
                  >
                    <Phone className="size-4" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${content.contact.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-semibold text-accent-ink"
                  >
                    <SocialIcon name="whatsapp" /> WhatsApp
                  </a>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      </motion.header>
    </>
  );
}
