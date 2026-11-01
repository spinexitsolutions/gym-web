"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Clapperboard,
  Dumbbell,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Images,
  LayoutList,
  MessageSquareQuote,
  Monitor,
  Palette,
  Phone,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  CalendarDays,
  Smartphone,
  Users,
  Weight,
  Inbox,
} from "lucide-react";
import type { IntroStyle, ScheduleSlot, SiteContent } from "@/lib/types";
import { PageHeader } from "./AdminShell";
import { Button, Card, ChipsField, ColorField, ImageField, Label, ListEditor, NumberField, Segmented, SelectField, TextField, Toggle, useToast } from "./ui";

type Tab =
  | "brand" | "intro" | "hero" | "sections" | "rules" | "programs" | "trainers" | "schedule"
  | "pricing" | "testimonials" | "gallery" | "faq" | "join" | "contact" | "seo";

const TABS: { id: Tab; label: string; icon: typeof Palette; group: string }[] = [
  { id: "brand", label: "Brand & theme", icon: Palette, group: "Design" },
  { id: "intro", label: "Intro animation", icon: Clapperboard, group: "Design" },
  { id: "sections", label: "Sections & order", icon: LayoutList, group: "Design" },
  { id: "hero", label: "Hero", icon: Sparkles, group: "Content" },
  { id: "rules", label: "House rules & stats", icon: Weight, group: "Content" },
  { id: "programs", label: "Programs", icon: Dumbbell, group: "Content" },
  { id: "trainers", label: "Coaches", icon: Users, group: "Content" },
  { id: "schedule", label: "Schedule", icon: CalendarDays, group: "Content" },
  { id: "pricing", label: "Pricing", icon: Tag, group: "Content" },
  { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote, group: "Content" },
  { id: "gallery", label: "Gallery", icon: Images, group: "Content" },
  { id: "faq", label: "FAQ", icon: HelpCircle, group: "Content" },
  { id: "join", label: "Trial form", icon: Inbox, group: "Content" },
  { id: "contact", label: "Contact & hours", icon: Phone, group: "Settings" },
  { id: "seo", label: "SEO", icon: Search, group: "Settings" },
];

const ACCENTS = [
  { name: "Hazard yellow", hex: "#FFD400" },
  { name: "Volt", hex: "#C6FF00" },
  { name: "Plate red", hex: "#FF2A1F" },
  { name: "Safety orange", hex: "#FF6A00" },
  { name: "Cobalt", hex: "#2D3BFF" },
  { name: "Chalk", hex: "#ECEBE4" },
];

const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export default function ContentEditor({ initial }: { initial: SiteContent }) {
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [tab, setTab] = useState<Tab>("brand");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const frame = useRef<HTMLIFrameElement>(null);
  const { toast, node } = useToast();
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** typed patch helper: up("hero", { image }) */
  const up = <K extends keyof SiteContent>(k: K, patch: Partial<SiteContent[K]> | SiteContent[K]) =>
    setC((x) => ({
      ...x,
      [k]: Array.isArray(patch) || typeof patch !== "object" ? patch : { ...(x[k] as object), ...(patch as object) },
    }));

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    setSaving(false);
    if (!res.ok) return toast("Save failed", "err");
    const next = await res.json();
    setSaved(next);
    setC(next);
    toast("Published — website updated");
    frame.current?.contentWindow?.location.reload();
  }

  async function reset() {
    if (!confirm("Reset ALL website content to the original demo? Leads & members are kept.")) return;
    const res = await fetch("/api/admin/content/reset", { method: "POST" });
    const next = await res.json();
    setSaved(next);
    setC(next);
    toast("Content reset to defaults");
    frame.current?.contentWindow?.location.reload();
  }

  const groups = ["Design", "Content", "Settings"];

  return (
    <div>
      <PageHeader title="Website" desc="Every word, image, colour and animation on your site — edited here, live in one click.">
        <Button variant="secondary" onClick={() => setPreview((p) => !p)} className="hidden xl:inline-flex">
          {preview ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {preview ? "Hide preview" : "Live preview"}
        </Button>
        <a href="/" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-none bg-white/[0.05] px-4 text-[14px] font-medium hover:bg-white/[0.08]">
          <ExternalLink className="size-4" /> Open site
        </a>
      </PageHeader>

      <div className={`grid gap-5 ${preview ? "xl:grid-cols-[220px_1fr_400px]" : "lg:grid-cols-[230px_1fr]"}`}>
        {/* tab list */}
        <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {groups.map((g) => (
            <div key={g} className="contents lg:block">
              <p className="hidden px-3 pb-1.5 pt-4 text-[11.5px] font-semibold uppercase tracking-wider text-white/35 first:pt-0 lg:block">{g}</p>
              {TABS.filter((t) => t.group === g).map((t) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex h-9 shrink-0 items-center gap-2.5 rounded-none px-3.5 text-[13.5px] font-medium lg:w-full lg:rounded-none ${on ? "text-[#ecebe4]" : "text-white/55 hover:text-white"}`}
                  >
                    {on && <motion.span layoutId="cms-tab" className="absolute inset-0 rounded-none bg-[#121212] shadow-[0_1px_3px_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08)] lg:rounded-none" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <t.icon className={`relative size-4 ${on ? "text-accent" : ""}`} />
                    <span className="relative whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="hidden pt-6 lg:block">
            <button onClick={reset} className="flex h-9 w-full items-center gap-2.5 rounded-none px-3.5 text-[13px] font-medium text-[#ff3b30] hover:bg-[#ff3b30]/5">
              <RotateCcw className="size-4" /> Reset to demo content
            </button>
          </div>
        </nav>

        {/* editor */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="space-y-4">
              <Panel tab={tab} c={c} up={up} />
            </motion.div>
          </AnimatePresence>
        </div>

        {preview && (
          <div className="hidden xl:block">
            <div className="sticky top-6">
              <div className="mb-3 flex items-center justify-between">
                <Label>Preview (after publish)</Label>
                <Segmented layoutId="device" value={device} onChange={setDevice} options={[{ value: "mobile", label: <Smartphone className="size-4" /> }, { value: "desktop", label: <Monitor className="size-4" /> }]} />
              </div>
              <div className="overflow-hidden rounded-none bg-black p-2 shadow-xl">
                <div className="relative h-[720px] overflow-hidden rounded-none bg-[#121212]">
                  <iframe
                    ref={frame}
                    src="/"
                    title="Website preview"
                    className="absolute left-0 top-0 origin-top-left border-0"
                    style={device === "mobile" ? { width: 384, height: 720 } : { width: 1440, height: 2700, transform: "scale(0.2667)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="fixed inset-x-3 bottom-[84px] z-50 mx-auto flex max-w-[560px] items-center justify-between gap-3 border border-white/15 bg-[#ecebe4] py-2 pl-5 pr-2 text-[#0b0b0b] shadow-2xl lg:bottom-6 lg:left-[260px]"
          >
            <span className="flex items-center gap-2 text-[14px]">
              <span className="tape-thin h-3 w-6" /> <span className="font-mono uppercase">Unsaved changes</span>
            </span>
            <span className="flex gap-2">
              <button onClick={() => setC(saved)} className="h-10 px-4 font-mono text-[14px] uppercase text-white/60 hover:text-white">
                Discard
              </button>
              <button onClick={save} disabled={saving} className="cut-sm h-10 bg-[#0b0b0b] px-5 font-mono text-[14px] uppercase text-accent disabled:opacity-60">
                {saving ? "Publishing…" : "Publish"}
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {node}
    </div>
  );
}

type Up = <K extends keyof SiteContent>(k: K, patch: Partial<SiteContent[K]> | SiteContent[K]) => void;

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Panel({ tab, c, up }: { tab: Tab; c: SiteContent; up: Up }) {
  switch (tab) {
    case "brand":
      return (
        <>
          <Card title="Identity">
            <Grid>
              <TextField label="Gym name" value={c.brand.name} onChange={(v) => up("brand", { name: v })} />
              <TextField label="Tagline" value={c.brand.tagline} onChange={(v) => up("brand", { tagline: v })} />
              <TextField label="Logo mark" hint="1–2 letters" value={c.brand.shortName} onChange={(v) => up("brand", { shortName: v.slice(0, 2) })} />
            </Grid>
          </Card>
          <Card title="Colour & mood" desc="The accent drives buttons, highlights, the intro curtain and the barbell plates.">
            <div className="space-y-6">
              <ColorField label="Accent colour" value={c.brand.accent} onChange={(v) => up("brand", { accent: v })} presets={ACCENTS} />
              <div>
                <Label>Base theme</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => up("brand", { theme: t })}
                      className={`overflow-hidden rounded-none text-left ring-2 transition ${c.brand.theme === t ? "ring-accent" : "ring-transparent"}`}
                    >
                      <div className={`flex h-24 flex-col justify-end p-3 ${t === "dark" ? "bg-[#0b0b0b] text-[#ecebe4]" : "bg-[#e9e7e1] text-[#0b0b0b]"}`}>
                        <span className="text-[22px] font-semibold leading-none tracking-[-0.04em]">
                          Aa <span className="hl" style={{ color: c.brand.accent }}>Aa</span>
                        </span>
                      </div>
                      <p className="bg-[#0a0a0a] px-3 py-2 text-[13px] font-medium capitalize">{t === "dark" ? "Rubber floor (dark)" : "Chalk wall (light)"}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card title="Experience">
            <div className="divide-y divide-black/[0.06]">
              <Toggle label="Smooth scrolling" desc="Buttery inertia scroll (Lenis)." checked={c.brand.smoothScroll} onChange={(v) => up("brand", { smoothScroll: v })} />
              <div className="pt-3">
                <Toggle label="Custom cursor" desc="Spring-follow cursor on desktop." checked={c.brand.cursor} onChange={(v) => up("brand", { cursor: v })} />
              </div>
            </div>
          </Card>
          <Card title="Announcement bar" action={<Toggle checked={c.brand.announcement.enabled} onChange={(v) => up("brand", { announcement: { ...c.brand.announcement, enabled: v } })} />}>
            <Grid>
              <TextField label="Text" value={c.brand.announcement.text} onChange={(v) => up("brand", { announcement: { ...c.brand.announcement, text: v } })} />
              <TextField label="Link" value={c.brand.announcement.link} onChange={(v) => up("brand", { announcement: { ...c.brand.announcement, link: v } })} />
            </Grid>
          </Card>
        </>
      );

    case "intro": {
      const styles: { id: IntroStyle; name: string; desc: string }[] = [
        { id: "counter", name: "Counter", desc: "Name rises, 000→100 counter, curtain lift." },
        { id: "words", name: "Word flash", desc: "Your words flash one by one, last in accent." },
        { id: "minimal", name: "Monolith", desc: "A slab fills up like a progress bar." },
      ];
      return (
        <>
          <Card title="Intro animation" desc="Plays when a visitor opens the site." action={<Toggle checked={c.intro.enabled} onChange={(v) => up("intro", { enabled: v })} />}>
            <div className={`grid gap-3 sm:grid-cols-3 ${c.intro.enabled ? "" : "pointer-events-none opacity-40"}`}>
              {styles.map((s) => (
                <button key={s.id} onClick={() => up("intro", { style: s.id })} className={`overflow-hidden rounded-none text-left ring-2 transition ${c.intro.style === s.id ? "ring-accent" : "ring-white/[0.06]"}`}>
                  <IntroThumb style={s.id} accent={c.brand.accent} name={c.brand.name} word={c.intro.words.at(-1) ?? ""} />
                  <div className="p-3">
                    <p className="text-[14px] font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-[12px] text-white/50">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Timing & copy">
            <div className="space-y-5">
              <div>
                <Label hint={`${(c.intro.durationMs / 1000).toFixed(1)}s`}>Duration</Label>
                <input type="range" min={1200} max={6000} step={100} value={c.intro.durationMs} onChange={(e) => up("intro", { durationMs: Number(e.target.value) })} className="w-full accent-accent" />
              </div>
              <ChipsField label="Words (used by Word flash & Counter caption)" value={c.intro.words} onChange={(v) => up("intro", { words: v })} />
              <Toggle label="Play once per visit" desc="Skip the intro when the visitor navigates back in the same session." checked={c.intro.oncePerSession} onChange={(v) => up("intro", { oncePerSession: v })} />
            </div>
          </Card>
        </>
      );
    }

    case "sections":
      return (
        <Card title="Homepage sections" desc="Drag to reorder. Toggle to show or hide. Hero & footer are always on.">
          <Reorder.Group axis="y" values={c.sections} onReorder={(v) => up("sections", v)} className="flex flex-col gap-2">
            {c.sections.map((s) => (
              <Reorder.Item key={s.id} value={s} className="flex cursor-grab items-center gap-3 rounded-none bg-[#0a0a0a] p-2 pr-3 ring-1 ring-inset ring-white/[0.05] active:cursor-grabbing">
                <span className="grid size-8 place-items-center text-white/30">
                  <GripVertical className="size-4" />
                </span>
                <span className={`flex-1 text-[14.5px] font-medium ${s.enabled ? "" : "text-white/35"}`}>{s.label}</span>
                <Toggle checked={s.enabled} onChange={(v) => up("sections", c.sections.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))} />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </Card>
      );

    case "hero":
      return (
        <>
          <Card title="Headline">
            <div className="space-y-4">
              <TextField label="Eyebrow" value={c.hero.eyebrow} onChange={(v) => up("hero", { eyebrow: v })} />
              <ChipsField label="Headline lines (each chip = one line)" value={c.hero.lines} onChange={(v) => up("hero", { lines: v })} />
              <TextField label="Highlighted words" hint="shown in italic accent" value={c.hero.highlight} onChange={(v) => up("hero", { highlight: v })} />
              <TextField label="Subtitle" textarea value={c.hero.subtitle} onChange={(v) => up("hero", { subtitle: v })} />
              <Grid>
                <TextField label="Primary button" value={c.hero.primaryCta} onChange={(v) => up("hero", { primaryCta: v })} />
                <TextField label="Secondary button" value={c.hero.secondaryCta} onChange={(v) => up("hero", { secondaryCta: v })} />
              </Grid>
            </div>
          </Card>
          <Card title="Background image">
            <ImageField value={c.hero.image} onChange={(v) => up("hero", { image: v })} />
          </Card>
          <Card title="Marquee ticker">
            <ChipsField label="Words" value={c.hero.marquee} onChange={(v) => up("hero", { marquee: v })} />
          </Card>
        </>
      );

    case "rules":
      return (
        <>
          <Card title="“Load the bar” — house rules" desc="Each rule loads a pair of plates onto the barbell as visitors scroll (max 4).">
            <div className="space-y-4">
              <Grid>
                <TextField label="Eyebrow" value={c.manifesto.eyebrow} onChange={(v) => up("manifesto", { eyebrow: v })} />
                <TextField label="Title" hint="last word in accent" value={c.manifesto.title} onChange={(v) => up("manifesto", { title: v })} />
              </Grid>
              <ListEditor
                items={c.manifesto.principles}
                onChange={(v) => up("manifesto", { principles: v.slice(0, 4) })}
                title={(p) => p.title}
                create={() => ({ id: id("rule"), title: "New rule.", text: "" })}
                addLabel={c.manifesto.principles.length >= 4 ? "Max 4 rules" : "Add rule"}
                render={(p, u) => (
                  <>
                    <TextField label="Rule" value={p.title} onChange={(v) => u({ title: v })} />
                    <TextField label="Explanation" textarea value={p.text} onChange={(v) => u({ text: v })} />
                  </>
                )}
              />
              <TextField label="Closing line" value={c.manifesto.closing} onChange={(v) => up("manifesto", { closing: v })} />
            </div>
          </Card>
          <Card title="Stats">
            <ListEditor
              items={c.stats}
              onChange={(v) => up("stats", v)}
              title={(s) => `${s.value.toLocaleString("en-IN")}${s.suffix} — ${s.label}`}
              create={() => ({ id: id("stat"), value: 100, suffix: "+", label: "New stat" })}
              render={(s, u) => (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="Number" value={s.value} onChange={(v) => u({ value: v })} />
                  <TextField label="Suffix" value={s.suffix} onChange={(v) => u({ suffix: v })} />
                  <TextField label="Label" value={s.label} onChange={(v) => u({ label: v })} />
                </div>
              )}
            />
          </Card>
          <Card title="Facility reveal" desc="The image that grows to full screen on scroll.">
            <div className="space-y-4">
              <Grid>
                <TextField label="Eyebrow" value={c.reveal.eyebrow} onChange={(v) => up("reveal", { eyebrow: v })} />
                <TextField label="Title" value={c.reveal.title} onChange={(v) => up("reveal", { title: v })} />
              </Grid>
              <TextField label="Text" textarea value={c.reveal.text} onChange={(v) => up("reveal", { text: v })} />
              <ImageField value={c.reveal.image} onChange={(v) => up("reveal", { image: v })} />
            </div>
          </Card>
        </>
      );

    case "programs":
      return (
        <Card title="Programs" desc="Cards in the horizontal-scroll section.">
          <ListEditor
            items={c.programs}
            onChange={(v) => up("programs", v)}
            title={(p) => p.title}
            thumb={(p) => p.image}
            create={() => ({ id: id("prog"), title: "New program", tagline: "", description: "", image: c.programs[0]?.image ?? "", duration: "45 min", intensity: 3, tags: [] })}
            render={(p, u) => (
              <>
                <Grid>
                  <TextField label="Title" value={p.title} onChange={(v) => u({ title: v })} />
                  <TextField label="Tagline" value={p.tagline} onChange={(v) => u({ tagline: v })} />
                  <TextField label="Duration" value={p.duration} onChange={(v) => u({ duration: v })} />
                  <NumberField label="Intensity (1–5)" min={1} max={5} value={p.intensity} onChange={(v) => u({ intensity: Math.max(1, Math.min(5, v)) })} />
                </Grid>
                <TextField label="Description" textarea value={p.description} onChange={(v) => u({ description: v })} />
                <ChipsField label="Tags" value={p.tags} onChange={(v) => u({ tags: v })} />
                <ImageField value={p.image} onChange={(v) => u({ image: v })} />
              </>
            )}
          />
        </Card>
      );

    case "trainers":
      return (
        <Card title="Coaches">
          <ListEditor
            items={c.trainers}
            onChange={(v) => up("trainers", v)}
            title={(t) => `${t.name} — ${t.role}`}
            thumb={(t) => t.image}
            create={() => ({ id: id("coach"), name: "New coach", role: "Coach", image: c.trainers[0]?.image ?? "", experience: "1 yr", speciality: "", instagram: "#" })}
            render={(t, u) => (
              <>
                <Grid>
                  <TextField label="Name" value={t.name} onChange={(v) => u({ name: v })} />
                  <TextField label="Role" value={t.role} onChange={(v) => u({ role: v })} />
                  <TextField label="Experience" value={t.experience} onChange={(v) => u({ experience: v })} />
                  <TextField label="Speciality" value={t.speciality} onChange={(v) => u({ speciality: v })} />
                  <TextField label="Instagram URL" value={t.instagram} onChange={(v) => u({ instagram: v })} />
                </Grid>
                <ImageField label="Photo" value={t.image} onChange={(v) => u({ image: v })} />
              </>
            )}
          />
        </Card>
      );

    case "schedule": {
      const days: ScheduleSlot["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return (
        <Card title="Weekly schedule" desc="Visitors see today's classes first.">
          <ListEditor
            items={c.schedule}
            onChange={(v) => up("schedule", v)}
            title={(s) => `${s.day} ${s.time} · ${s.className} (${s.coach})`}
            create={() => ({ id: id("cls"), day: "Mon" as const, time: "07:00", className: "New class", coach: c.trainers[0]?.name.split(" ")[0] ?? "", spots: 12 })}
            render={(s, u) => (
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField label="Day" value={s.day} onChange={(v) => u({ day: v })} options={days.map((d) => ({ value: d, label: d }))} />
                <TextField label="Time" type="time" value={s.time} onChange={(v) => u({ time: v })} />
                <NumberField label="Spots" value={s.spots} onChange={(v) => u({ spots: v })} />
                <TextField label="Class" value={s.className} onChange={(v) => u({ className: v })} />
                <TextField label="Coach" value={s.coach} onChange={(v) => u({ coach: v })} />
              </div>
            )}
          />
        </Card>
      );
    }

    case "pricing":
      return (
        <Card title="Membership plans" action={<div className="w-24"><TextField value={c.currency} onChange={(v) => up("currency", v)} /></div>}>
          <ListEditor
            items={c.plans}
            onChange={(v) => up("plans", v)}
            title={(p) => `${p.name} — ${c.currency}${p.monthly.toLocaleString("en-IN")}/mo${p.featured ? "  ★" : ""}`}
            create={() => ({ id: id("plan"), name: "New plan", monthly: 2999, yearly: 29999, description: "", features: [], featured: false })}
            render={(p, u) => (
              <>
                <Grid>
                  <TextField label="Name" value={p.name} onChange={(v) => u({ name: v })} />
                  <TextField label="Short description" value={p.description} onChange={(v) => u({ description: v })} />
                  <NumberField label="Monthly price" value={p.monthly} onChange={(v) => u({ monthly: v })} />
                  <NumberField label="Yearly price" value={p.yearly} onChange={(v) => u({ yearly: v })} />
                </Grid>
                <ChipsField label="Features" value={p.features} onChange={(v) => u({ features: v })} />
                <Toggle label="Featured (Most popular)" checked={p.featured} onChange={(v) => u({ featured: v })} />
              </>
            )}
          />
        </Card>
      );

    case "testimonials":
      return (
        <Card title="Member stories">
          <ListEditor
            items={c.testimonials}
            onChange={(v) => up("testimonials", v)}
            title={(t) => t.name}
            thumb={(t) => t.avatar}
            create={() => ({ id: id("rev"), name: "New member", role: "", quote: "", avatar: c.testimonials[0]?.avatar ?? "", result: "" })}
            render={(t, u) => (
              <>
                <Grid>
                  <TextField label="Name" value={t.name} onChange={(v) => u({ name: v })} />
                  <TextField label="Role / profession" value={t.role} onChange={(v) => u({ role: v })} />
                  <TextField label="Result badge" value={t.result} onChange={(v) => u({ result: v })} />
                </Grid>
                <TextField label="Quote" textarea value={t.quote} onChange={(v) => u({ quote: v })} />
                <ImageField label="Avatar" value={t.avatar} onChange={(v) => u({ avatar: v })} />
              </>
            )}
          />
        </Card>
      );

    case "gallery":
      return (
        <Card title="Gallery" desc="Bento grid — the 1st and 5th images get the large tiles.">
          <ListEditor
            items={c.gallery}
            onChange={(v) => up("gallery", v)}
            title={(g) => g.caption}
            thumb={(g) => g.image}
            create={() => ({ id: id("img"), image: "", caption: "New photo" })}
            render={(g, u) => (
              <>
                <TextField label="Caption" value={g.caption} onChange={(v) => u({ caption: v })} />
                <ImageField value={g.image} onChange={(v) => u({ image: v })} />
              </>
            )}
          />
        </Card>
      );

    case "faq":
      return (
        <Card title="FAQ">
          <ListEditor
            items={c.faqs}
            onChange={(v) => up("faqs", v)}
            title={(f) => f.q}
            create={() => ({ id: id("faq"), q: "New question?", a: "" })}
            render={(f, u) => (
              <>
                <TextField label="Question" value={f.q} onChange={(v) => u({ q: v })} />
                <TextField label="Answer" textarea value={f.a} onChange={(v) => u({ a: v })} />
              </>
            )}
          />
        </Card>
      );

    case "join":
      return (
        <Card title="Free-trial form" desc="Submissions go straight into Leads (CRM) as “New”.">
          <div className="space-y-4">
            <TextField label="Title" value={c.join.title} onChange={(v) => up("join", { title: v })} />
            <TextField label="Subtitle" textarea value={c.join.subtitle} onChange={(v) => up("join", { subtitle: v })} />
            <ChipsField label="Goal options" value={c.join.goals} onChange={(v) => up("join", { goals: v })} />
            <ImageField value={c.join.image} onChange={(v) => up("join", { image: v })} />
          </div>
        </Card>
      );

    case "contact":
      return (
        <>
          <Card title="Contact">
            <Grid>
              <TextField label="Phone" value={c.contact.phone} onChange={(v) => up("contact", { phone: v })} />
              <TextField label="WhatsApp number" hint="with country code, digits only" value={c.contact.whatsapp} onChange={(v) => up("contact", { whatsapp: v.replace(/\D/g, "") })} />
              <TextField label="Email" value={c.contact.email} onChange={(v) => up("contact", { email: v })} />
              <TextField label="Google Maps link" value={c.contact.mapUrl} onChange={(v) => up("contact", { mapUrl: v })} />
            </Grid>
            <div className="mt-4">
              <TextField label="Address" textarea rows={2} value={c.contact.address} onChange={(v) => up("contact", { address: v })} />
            </div>
          </Card>
          <Card title="Opening hours" desc="Open / closed badge on the site is calculated from these hours.">
            <Grid>
              <TextField label="Weekday hours (display)" value={c.contact.hoursWeekday} onChange={(v) => up("contact", { hoursWeekday: v })} />
              <TextField label="Weekend hours (display)" value={c.contact.hoursWeekend} onChange={(v) => up("contact", { hoursWeekend: v })} />
              <NumberField label="Opens at (hour, 0–23)" min={0} max={23} value={c.contact.openHour} onChange={(v) => up("contact", { openHour: v })} />
              <NumberField label="Closes at (hour, 1–24)" min={1} max={24} value={c.contact.closeHour} onChange={(v) => up("contact", { closeHour: v })} />
            </Grid>
          </Card>
          <Card title="Social">
            <Grid>
              <TextField label="Instagram" value={c.contact.instagram} onChange={(v) => up("contact", { instagram: v })} />
              <TextField label="YouTube" value={c.contact.youtube} onChange={(v) => up("contact", { youtube: v })} />
              <TextField label="Facebook" value={c.contact.facebook} onChange={(v) => up("contact", { facebook: v })} />
            </Grid>
          </Card>
        </>
      );

    case "seo":
      return (
        <Card title="Search & sharing">
          <div className="space-y-4">
            <TextField label="Page title" hint={`${c.seo.title.length}/60`} value={c.seo.title} onChange={(v) => up("seo", { title: v })} />
            <TextField label="Meta description" hint={`${c.seo.description.length}/160`} textarea value={c.seo.description} onChange={(v) => up("seo", { description: v })} />
            <div className="bg-[#121212] p-4">
              <p className="text-[12px] text-black/45">Google preview</p>
              <p className="mt-2 text-[18px] text-[#1a0dab]">{c.seo.title}</p>
              <p className="text-[13px] text-[#006621]">yourgym.com</p>
              <p className="mt-1 text-[13.5px] text-black/70">{c.seo.description}</p>
            </div>
          </div>
        </Card>
      );
  }
}

function IntroThumb({ style, accent, name, word }: { style: IntroStyle; accent: string; name: string; word: string }) {
  return (
    <div className="relative grid h-28 place-items-center overflow-hidden bg-[#0b0b0c] text-[#f2f0eb]">
      {style === "counter" && (
        <>
          <span className="text-[20px] font-semibold tracking-[-0.04em]">{name}</span>
          <span className="absolute bottom-2 left-3 font-mono text-[22px] font-semibold tracking-[-0.05em]">064</span>
          <span className="absolute inset-x-0 bottom-0 h-[3px] w-2/3" style={{ background: accent }} />
        </>
      )}
      {style === "words" && <span className="font-serif text-[30px] italic" style={{ color: accent }}>{word}</span>}
      {style === "minimal" && (
        <div className="flex flex-col items-center gap-2">
          <span className="relative h-10 w-7 overflow-hidden rounded-none border-2 border-white/80">
            <span className="absolute inset-x-0 bottom-0 h-3/5" style={{ background: accent }} />
          </span>
          <span className="text-[11px] font-semibold tracking-tight">{name}</span>
        </div>
      )}
    </div>
  );
}
