"use client";

import Lenis from "lenis";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { SiteContext } from "./context";
import Intro from "./Intro";
import Navbar from "./Navbar";
import { SocialIcon } from "./primitives";

function readableInk(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0b0b0c" : "#ffffff";
}

export default function SiteShell({ content, children }: { content: SiteContent; children: ReactNode }) {
  const [ready, setReady] = useState(!content.intro.enabled);
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [prefill, setPrefill] = useState<{ goal?: string; plan?: string }>({});
  const [bar, setBar] = useState(content.brand.announcement.enabled);
  const [showFab, setShowFab] = useState(false);

  // smooth scroll
  useEffect(() => {
    if (!content.brand.smoothScroll) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1 });
    setLenis(l);
    return () => l.destroy();
  }, [content.brand.smoothScroll]);

  // freeze page during intro
  useEffect(() => {
    if (ready) {
      lenis?.start();
      document.documentElement.style.overflow = "";
    } else {
      lenis?.stop();
      document.documentElement.style.overflow = "hidden";
    }
  }, [ready, lenis]);

  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  const scrollTo = useCallback(
    (target: string | number) => {
      if (lenis) lenis.scrollTo(target as never, { duration: 1.6, offset: 0 });
      else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
      else document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
    },
    [lenis],
  );

  // intercept in-page anchor links so they glide
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")!;
      if (id.length < 2 || !document.querySelector(id)) return;
      e.preventDefault();
      scrollTo(id);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [scrollTo]);

  const style = {
    "--accent": content.brand.accent,
    "--accent-ink": readableInk(content.brand.accent),
  } as React.CSSProperties;

  return (
    <SiteContext.Provider value={{ content, ready, lenis, scrollTo, prefill, setPrefill }}>
      <div data-theme={content.brand.theme} style={style} className="relative min-h-screen bg-bg text-fg">
        {content.intro.enabled && (
          <Intro
            settings={content.intro}
            brand={content.brand.name}
            tagline={content.brand.tagline}
            onDone={() => setReady(true)}
          />
        )}

        <AnimatePresence>
          {bar && (
            <motion.div
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-[60] h-11 overflow-hidden bg-accent text-accent-ink"
            >
              <a href={content.brand.announcement.link || "#join"} className="marquee flex h-full items-center overflow-hidden">
                <div className="marquee-track" style={{ "--marquee-speed": "40s" } as React.CSSProperties}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="flex items-center gap-6 whitespace-nowrap pr-6 text-[13px] font-medium tracking-tight">
                      {content.brand.announcement.text}
                      <span aria-hidden className="size-1.5 rotate-45 bg-accent-ink/70" />
                    </span>
                  ))}
                </div>
              </a>
              <button
                onClick={() => setBar(false)}
                aria-label="Dismiss"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-accent shadow-[-12px_0_12px_var(--accent)]"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Navbar announcement={bar} />
        {content.brand.cursor && <Cursor />}

        <main>{children}</main>

        {/* WhatsApp quick action (desktop – mobile has it inside the island) */}
        {content.contact.whatsapp && (
          <motion.a
            href={`https://wa.me/${content.contact.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            initial={{ scale: 0 }}
            animate={{ scale: ready && showFab ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="fixed bottom-6 right-6 z-[70] hidden size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_14px_40px_-10px_rgba(37,211,102,0.7)] md:grid"
            data-cursor="hover"
          >
            <SocialIcon name="whatsapp" className="size-6" />
          </motion.a>
        )}
      </div>
    </SiteContext.Provider>
  );
}

/* Spring-follow cursor; expands with a label over [data-cursor] targets. */
function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.5 });
  const [mode, setMode] = useState<"idle" | "hover" | "view" | "drag">("idle");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("has-custom-cursor");
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = (e.target as HTMLElement)?.closest?.("[data-cursor], a, button, input, textarea, select, label");
      const m = t?.getAttribute("data-cursor");
      setMode(m === "view" ? "view" : m === "drag" ? "drag" : t ? "hover" : "idle");
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [x, y]);

  if (!enabled) return null;
  const size = mode === "view" || mode === "drag" ? 88 : mode === "hover" ? 44 : 10;
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[300] mix-blend-difference"
      style={{ x: sx, y: sy }}
    >
      <motion.div
        className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[11px] font-semibold uppercase tracking-[0.12em] text-black"
        animate={{ width: size, height: size }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {(mode === "view" || mode === "drag") && <span>{mode}</span>}
      </motion.div>
    </motion.div>
  );
}
