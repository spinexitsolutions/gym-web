"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, GripVertical, ImageIcon, Plus, Trash2, X } from "lucide-react";

/* Apple-flavoured admin UI kit */

export const inputCls =
  "w-full rounded-xl bg-[#f5f5f7] px-3.5 py-2.5 text-[14.5px] text-[#1d1d1f] outline-none ring-1 ring-inset ring-black/[0.06] transition placeholder:text-black/30 focus:bg-white focus:ring-2 focus:ring-[#0a84ff]";

export function Card({ children, className = "", title, desc, action }: { children: ReactNode; className?: string; title?: string; desc?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] md:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">{title}</h3>}
            {desc && <p className="mt-1 text-[13px] text-black/50">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const v = {
    primary: "bg-[#0a84ff] text-white hover:bg-[#0077ed]",
    dark: "bg-[#1d1d1f] text-white hover:bg-black",
    secondary: "bg-black/[0.05] text-[#1d1d1f] hover:bg-black/[0.08]",
    ghost: "text-[#1d1d1f] hover:bg-black/[0.05]",
    danger: "bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-[13px] gap-1.5" : "h-10 px-4 text-[14px] gap-2";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-[-0.01em] transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-black/60">
      {children}
      {hint && <span className="font-normal text-black/35">{hint}</span>}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  textarea,
  placeholder,
  hint,
  type = "text",
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
  hint?: string;
  type?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      {label && <Label hint={hint}>{label}</Label>}
      {textarea ? (
        <textarea className={`${inputCls} resize-y leading-relaxed`} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputCls} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      <input className={inputCls} type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="block">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <select className={`${inputCls} appearance-none pr-9`} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/40" />
      </div>
    </label>
  );
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label?: string; desc?: string }) {
  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-[#34c759]" : "bg-black/[0.12]"}`}
    >
      <motion.span
        className="absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[14.5px] font-medium text-[#1d1d1f]">{label}</p>
        {desc && <p className="mt-0.5 text-[12.5px] text-black/50">{desc}</p>}
      </div>
      {sw}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, layoutId }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; layoutId: string }) {
  return (
    <div className="inline-flex rounded-[10px] bg-black/[0.06] p-[3px]">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className="relative flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium">
          {value === o.value && (
            <motion.span layoutId={layoutId} className="absolute inset-0 rounded-[8px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className={`relative flex items-center gap-1.5 ${value === o.value ? "text-[#1d1d1f]" : "text-black/55"}`}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ImageField({ label = "Image URL", value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  return (
    <div>
      <Label hint="Unsplash / any https URL">{label}</Label>
      <div className="flex gap-3">
        <div className="relative size-[74px] shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7] ring-1 ring-inset ring-black/[0.06]">
          {value && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <ImageIcon className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-black/25" />
          )}
        </div>
        <textarea className={`${inputCls} h-[74px] resize-none font-mono !text-[12px]`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://images.unsplash.com/…" />
      </div>
    </div>
  );
}

export function ColorField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets: { name: string; hex: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2.5">
        {presets.map((p) => (
          <button
            key={p.hex}
            type="button"
            title={p.name}
            onClick={() => onChange(p.hex)}
            className={`size-9 rounded-full ring-offset-2 transition-transform hover:scale-110 ${value.toLowerCase() === p.hex.toLowerCase() ? "ring-2 ring-[#0a84ff]" : "ring-1 ring-black/10"}`}
            style={{ background: p.hex }}
          />
        ))}
        <label className="relative flex h-9 items-center gap-2 rounded-full bg-[#f5f5f7] pl-1 pr-3 ring-1 ring-inset ring-black/[0.06]">
          <span className="relative size-7 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: value }}>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </span>
          <input value={value} onChange={(e) => onChange(e.target.value)} className="w-[76px] bg-transparent font-mono text-[12.5px] uppercase outline-none" />
        </label>
      </div>
    </div>
  );
}

/** Editable list of strings shown as chips. */
export function ChipsField({ label, value, onChange, placeholder = "Add and press Enter" }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className={`${inputCls} flex min-h-[46px] flex-wrap items-center gap-1.5 !py-2`}>
        {value.map((v, i) => (
          <span key={`${v}-${i}`} className="flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1.5 text-[13px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
            {v}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded-full text-black/40 hover:bg-black/5 hover:text-black">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-black/30"
        />
      </div>
    </div>
  );
}

/** Drag-reorderable, collapsible list of objects. */
export function ListEditor<T extends { id: string }>({
  items,
  onChange,
  render,
  title,
  thumb,
  create,
  addLabel = "Add item",
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  title: (item: T) => string;
  thumb?: (item: T) => string | undefined;
  create: () => T;
  addLabel?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <Reorder.Group axis="y" values={items} onReorder={onChange} className="flex flex-col gap-2">
        {items.map((item) => (
          <ListRow
            key={item.id}
            item={item}
            open={open === item.id}
            onToggle={() => setOpen(open === item.id ? null : item.id)}
            title={title(item)}
            thumb={thumb?.(item)}
            onRemove={() => {
              if (confirm(`Remove “${title(item)}”?`)) onChange(items.filter((x) => x.id !== item.id));
            }}
          >
            {render(item, (patch) => onChange(items.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
          </ListRow>
        ))}
      </Reorder.Group>
      <button
        type="button"
        onClick={() => {
          const n = create();
          onChange([...items, n]);
          setOpen(n.id);
        }}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 text-[14px] font-medium text-[#0a84ff] transition hover:border-[#0a84ff]/50 hover:bg-[#0a84ff]/[0.04]"
      >
        <Plus className="size-4" /> {addLabel}
      </button>
    </div>
  );
}

function ListRow<T>({ item, open, onToggle, title, thumb, onRemove, children }: { item: T; open: boolean; onToggle: () => void; title: string; thumb?: string; onRemove: () => void; children: ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} className="rounded-2xl bg-[#f5f5f7] ring-1 ring-inset ring-black/[0.05]">
      <div className="flex items-center gap-2 p-2 pr-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-black/30 hover:bg-black/5 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-9 rounded-lg object-cover" />
        )}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left">
          <span className="truncate text-[14.5px] font-medium text-[#1d1d1f]">{title || "Untitled"}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="size-4 text-black/40" />
          </motion.span>
        </button>
        <button type="button" onClick={onRemove} className="grid size-8 place-items-center rounded-lg text-black/30 hover:bg-[#ff3b30]/10 hover:text-[#ff3b30]" aria-label="Remove">
          <Trash2 className="size-4" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-black/[0.06] bg-white/60 p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

export function Modal({ open, onClose, title, children, footer, side }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; side?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 backdrop-blur-[3px] md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={side ? { justifyContent: "flex-end", alignItems: "stretch" } : undefined}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={side ? { x: "100%" } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: "100%" } : { y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={`flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-2xl ${side ? "max-h-none max-w-[520px] md:rounded-l-[24px]" : "rounded-t-[24px] md:max-w-[560px] md:rounded-[24px]"}`}
          >
            <header className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h3>
              <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-black/[0.05] text-black/60 hover:bg-black/10" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && <footer className="flex justify-end gap-2 border-t border-black/[0.06] px-5 py-4">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Badge({ children, tone = "#8e8e93" }: { children: ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `${tone}1a`, color: tone }}>
      <span className="size-1.5 rounded-full" style={{ background: tone }} />
      {children}
    </span>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err"; key: number } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div
          key={msg.key}
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-full px-5 py-3 text-[14px] font-medium text-white shadow-xl md:bottom-8 ${msg.tone === "ok" ? "bg-[#1d1d1f]" : "bg-[#ff3b30]"}`}
        >
          {msg.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { toast: (text: string, tone: "ok" | "err" = "ok") => setMsg({ text, tone, key: Date.now() }), node };
}

export const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hues = [211, 280, 30, 145, 340, 190, 260];
  const h = hues[name.length % hues.length];
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold" style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${h} 90% 94%)`, color: `hsl(${h} 70% 38%)` }}>
      {initials(name)}
    </span>
  );
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
};
