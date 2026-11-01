"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Clock, Mail, MapPin, Phone, Plus, X } from "lucide-react";
import { useSite } from "./context";
import { EASE, EASE_IO, FadeUp, Magnetic, PillButton, SectionHead, SocialIcon, SplitReveal, useIsOpen } from "./primitives";

/* ───────────── Testimonials: twin marquees ───────────── */
export function Testimonials() {
  const { content } = useSite();
  const list = content.testimonials;
  if (!list.length) return null;
  const half = Math.ceil(list.length / 2);
  const rows = [list, [...list.slice(half), ...list.slice(0, half)]];

  return (
    <section id="testimonials" data-nav="testimonials" className="surface-invert overflow-hidden py-24 md:py-40">
      <div className="container-x">
        <SectionHead eyebrow="Member stories" title="Results speak quietly." highlight="quietly." aside="Real members. Real numbers. No before-and-after filters." />
      </div>
      <div className="mt-14 flex flex-col gap-4 md:mt-20 md:gap-5">
        {rows.map((row, r) => (
          <div key={r} className="marquee overflow-hidden">
            <div
              className={`marquee-track ${r ? "marquee-reverse" : ""}`}
              style={{ "--marquee-speed": `${60 + r * 12}s` } as React.CSSProperties}
            >
              {[...row, ...row].map((t, i) => (
                <figure
                  key={`${t.id}-${i}`}
                  className="mr-4 flex w-[84vw] max-w-[440px] shrink-0 flex-col justify-between rounded-[26px] bg-card p-6 ring-1 ring-inset ring-line md:mr-5 md:p-8"
                >
                  <div>
                    <span className="inline-block rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-accent-ink">{t.result}</span>
                    <blockquote className="mt-5 text-[18px] leading-snug tracking-[-0.015em] md:text-[21px]">“{t.quote}”</blockquote>
                  </div>
                  <figcaption className="mt-8 flex items-center gap-3">
                    <img src={t.avatar} alt="" loading="lazy" className="size-11 rounded-full object-cover" />
                    <div>
                      <p className="text-[15px] font-semibold tracking-tight">{t.name}</p>
                      <p className="text-[13px] text-muted">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Gallery: bento + shared-element lightbox ───────────── */
const SPANS = [
  "col-span-2 row-span-2",
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-1",
];

export function Gallery() {
  const { content, lenis } = useSite();
  const [open, setOpen] = useState<string | null>(null);
  const item = content.gallery.find((g) => g.id === open);

  useEffect(() => {
    if (open) lenis?.stop();
    else lenis?.start();
  }, [open, lenis]);

  return (
    <section id="gallery" data-nav="gallery" className="container-x py-24 md:py-40">
      <SectionHead eyebrow="Inside the club" title="No filters. Just the floor." highlight="floor." />
      <div className="mt-14 grid auto-rows-[38vw] grid-cols-2 gap-3 md:mt-20 md:auto-rows-[19vw] md:grid-cols-4 md:gap-4 xl:auto-rows-[260px]">
        {content.gallery.map((g, i) => (
          <motion.button
            key={g.id}
            onClick={() => setOpen(g.id)}
            className={`group relative overflow-hidden rounded-[22px] bg-card ${SPANS[i % SPANS.length]}`}
            initial={{ clipPath: "inset(100% 0% 0% 0% round 22px)" }}
            whileInView={{ clipPath: "inset(0% 0% 0% 0% round 22px)" }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 1.2, delay: (i % 4) * 0.08, ease: EASE_IO }}
            data-cursor="view"
          >
            <motion.img
              layoutId={`g-${g.id}`}
              src={g.image}
              alt={g.caption}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[var(--ease-out)] group-hover:scale-105"
            />
            <span className="absolute bottom-3 left-3 translate-y-2 rounded-full bg-black/50 px-3 py-1.5 text-[12px] text-white opacity-0 backdrop-blur-md transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              {g.caption}
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {item && (
          <motion.div
            className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.img
              layoutId={`g-${item.id}`}
              src={item.image}
              alt={item.caption}
              className="max-h-[82vh] w-auto max-w-full rounded-[22px] object-contain"
            />
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[14px] text-white/80">{item.caption}</p>
            <button className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-white/10 text-white" aria-label="Close">
              <X className="size-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ───────────── FAQ ───────────── */
export function Faq() {
  const { content } = useSite();
  const [open, setOpen] = useState<string | null>(content.faqs[0]?.id ?? null);
  return (
    <section id="faq" data-nav="faq" className="container-x py-24 md:py-40">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHead eyebrow="FAQ" title="Good questions." highlight="questions." />
          <FadeUp delay={0.2}>
            <p className="mt-6 max-w-sm text-[15px] text-muted">
              Still unsure? Message us on WhatsApp — a coach replies within the hour.
            </p>
          </FadeUp>
        </div>
        <div className="border-t border-line">
          {content.faqs.map((f, i) => {
            const on = open === f.id;
            return (
              <FadeUp key={f.id} delay={i * 0.05} y={16}>
                <div className="border-b border-line">
                  <button
                    onClick={() => setOpen(on ? null : f.id)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left md:py-8"
                    aria-expanded={on}
                    data-cursor="hover"
                  >
                    <span className="text-[19px] font-medium tracking-[-0.025em] md:text-[24px]">{f.q}</span>
                    <motion.span
                      animate={{ rotate: on ? 45 : 0, backgroundColor: on ? "var(--accent)" : "var(--faint)" }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${on ? "text-accent-ink" : ""}`}
                    >
                      <Plus className="size-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-xl pb-8 text-[15.5px] leading-relaxed text-muted">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Join: free-trial form → CRM ───────────── */
const TIMES = ["Morning", "Afternoon", "Evening"];

export function Join() {
  const { content, prefill } = useSite();
  const j = content.join;
  const [goal, setGoal] = useState<string>("");
  const [time, setTime] = useState("Evening");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  useEffect(() => {
    if (prefill.goal) setGoal(prefill.goal);
  }, [prefill]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    const message = [prefill.plan ? `Interested in ${prefill.plan} plan.` : "", String(fd.get("message") ?? "")]
      .filter(Boolean)
      .join(" ");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          message,
          goal,
          preferredTime: time,
          company: fd.get("company"),
          source: "Website",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  return (
    <section ref={ref} id="join" data-nav="join" className="container-x py-24 md:py-36">
      <div className="grid overflow-hidden rounded-[32px] bg-card ring-1 ring-inset ring-line lg:grid-cols-[1fr_1.1fr]">
        <div className="relative min-h-[300px] overflow-hidden lg:min-h-full">
          <motion.img src={j.image} alt="" loading="lazy" style={{ y: imgY, scale: 1.2 }} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-[#f2f0eb] md:p-10">
            <p className="eyebrow !text-white/60">Free 7-day trial</p>
            <SplitReveal as="h2" text={j.title} highlight="us." className="display mt-4 block text-[clamp(40px,5.6vw,84px)]" />
          </div>
        </div>

        <div className="p-6 md:p-12">
          <AnimatePresence mode="wait">
            {state === "done" ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex min-h-[460px] flex-col items-center justify-center text-center"
              >
                <svg viewBox="0 0 80 80" className="size-24">
                  <motion.circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: EASE }} />
                  <motion.path d="M25 41 l10 10 l20 -22" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6, duration: 0.5, ease: EASE }} />
                </svg>
                <h3 className="mt-8 text-[34px] font-semibold tracking-[-0.04em]">You&apos;re in.</h3>
                <p className="mt-3 max-w-xs text-muted">A coach will call you within 24 hours to lock in your first session.</p>
                <button onClick={() => setState("idle")} className="mt-8 text-[14px] text-muted underline underline-offset-4">
                  Submit another
                </button>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
                <p className="text-[15px] leading-relaxed text-muted">{j.subtitle}</p>
                {prefill.plan && (
                  <p className="flex items-center gap-2 rounded-2xl bg-accent/10 px-4 py-3 text-[14px] text-fg">
                    <Check className="size-4 text-accent" /> Selected plan: <b>{prefill.plan}</b>
                  </p>
                )}
                <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="name" label="Full name" required autoComplete="name" />
                  <Field name="phone" label="Phone" type="tel" required autoComplete="tel" />
                </div>
                <Field name="email" label="Email (optional)" type="email" autoComplete="email" />

                <div>
                  <p className="mb-3 text-[13px] text-muted">Your main goal</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set([...j.goals, ...(goal && !j.goals.includes(goal) ? [goal] : [])])).map((g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setGoal(goal === g ? "" : g)}
                        className={`h-10 rounded-full px-4 text-[14px] transition-all duration-300 ${
                          goal === g ? "bg-fg text-bg" : "ring-1 ring-inset ring-line hover:ring-fg/40"
                        }`}
                        data-cursor="hover"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[13px] text-muted">Preferred time</p>
                  <div className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] p-1">
                    {TIMES.map((t) => (
                      <button type="button" key={t} onClick={() => setTime(t)} className="relative h-10 rounded-full px-4 text-[14px]" data-cursor="hover">
                        {time === t && <motion.span layoutId="time-pill" className="absolute inset-0 rounded-full bg-fg" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                        <span className={`relative ${time === t ? "text-bg" : ""}`}>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Field name="message" label="Anything we should know? (injuries, experience…)" textarea />

                {state === "error" && <p className="text-[14px] text-[#ff453a]">{error}</p>}

                <PillButton type="submit" className="w-full justify-between sm:w-auto sm:self-start" disabled={state === "sending"}>
                  {state === "sending" ? "Sending…" : "Claim my free week"}
                </PillButton>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  textarea,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  autoComplete?: string;
}) {
  const cls =
    "peer w-full rounded-2xl bg-transparent px-4 pb-2.5 pt-6 text-[16px] outline-none ring-1 ring-inset ring-line transition-shadow placeholder-transparent focus:ring-2 focus:ring-accent";
  return (
    <label className="relative block">
      {textarea ? (
        <textarea name={name} placeholder={label} rows={3} className={`${cls} resize-none`} />
      ) : (
        <input name={name} type={type} placeholder={label} required={required} autoComplete={autoComplete} className={cls} />
      )}
      <span className="pointer-events-none absolute left-4 top-2 text-[11.5px] text-muted transition-all duration-300 peer-placeholder-shown:top-[17px] peer-placeholder-shown:text-[15px] peer-focus:top-2 peer-focus:text-[11.5px] peer-focus:text-accent">
        {label}
      </span>
    </label>
  );
}

/* ───────────── Footer ───────────── */
export function Footer() {
  const { content, scrollTo } = useSite();
  const c = content.contact;
  const status = useIsOpen(c.openHour, c.closeHour);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["40%", "0%"]);

  return (
    <footer ref={ref} data-nav="footer" className="surface-invert relative overflow-hidden rounded-t-[36px] pb-36 pt-20 md:rounded-t-[56px] md:pb-10 md:pt-28">
      <div className="container-x">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <SplitReveal as="h2" text="Ready when you are." highlight="you" className="display block max-w-[12ch] text-[clamp(48px,8vw,128px)]" />
          <Magnetic strength={0.25}>
            <button onClick={() => scrollTo("#join")} className="relative grid size-36 place-items-center md:size-44" data-cursor="hover" aria-label="Book a free trial">
              <motion.svg viewBox="0 0 200 200" className="absolute inset-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: "linear" }}>
                <defs>
                  <path id="circ" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                </defs>
                <text className="fill-current font-mono text-[13px] uppercase tracking-[0.32em]">
                  <textPath href="#circ">Book a free trial • Book a free trial • </textPath>
                </text>
              </motion.svg>
              <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-500 hover:rotate-45 md:size-20">
                <ArrowUpRight className="size-7" />
              </span>
            </button>
          </Magnetic>
        </div>

        <div className="mt-16 grid gap-10 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="eyebrow mb-4">Visit</p>
            <a href={c.mapUrl} target="_blank" rel="noreferrer" className="flex gap-2 text-[15px] leading-relaxed hover:text-accent">
              <MapPin className="mt-1 size-4 shrink-0" /> {c.address}
            </a>
          </div>
          <div>
            <p className="eyebrow mb-4">Hours</p>
            <p className="flex items-center gap-2 text-[15px]">
              <Clock className="size-4" /> {c.hoursWeekday}
            </p>
            <p className="mt-1 pl-6 text-[15px]">{c.hoursWeekend}</p>
            <p className="mt-3 flex items-center gap-2 pl-6 text-[13px] text-muted">
              <span className={`live-dot size-1.5 rounded-full ${status?.open ? "bg-[#30d158]" : "bg-[#8e8e93]"}`} /> {status?.label}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-4">Contact</p>
            <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-[15px] hover:text-accent">
              <Phone className="size-4" /> {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="mt-2 flex items-center gap-2 text-[15px] hover:text-accent">
              <Mail className="size-4" /> {c.email}
            </a>
          </div>
          <div>
            <p className="eyebrow mb-4">Follow</p>
            <div className="flex gap-2">
              {(["instagram", "youtube", "facebook", "whatsapp"] as const).map((s) => {
                const href = s === "whatsapp" ? `https://wa.me/${c.whatsapp}` : c[s];
                if (!href) return null;
                return (
                  <a key={s} href={href} target="_blank" rel="noreferrer" aria-label={s} className="grid size-11 place-items-center rounded-full ring-1 ring-inset ring-line transition-colors hover:bg-fg hover:text-bg" data-cursor="hover">
                    <SocialIcon name={s} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <motion.div style={{ y }} className="mt-16 select-none overflow-hidden px-3 text-center md:mt-24">
        <span className="display block text-[clamp(64px,20.5vw,360px)] leading-[0.78] tracking-[-0.07em]">{content.brand.name}</span>
      </motion.div>

      <div className="container-x mt-8 flex flex-col justify-between gap-2 text-[12.5px] text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} {content.brand.name} {content.brand.tagline}. All rights reserved.</span>
        <span className="flex gap-4">
          <a href="/admin" className="hover:text-fg">Admin</a>
          <button onClick={() => scrollTo(0)} className="hover:text-fg">Back to top ↑</button>
        </span>
      </div>
    </footer>
  );
}
