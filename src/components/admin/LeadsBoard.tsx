"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Kanban, List, Mail, MessageCircle, Phone, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/lib/types";
import { PageHeader } from "./AdminShell";
import { Avatar, Badge, Button, Card, inputCls, Modal, NumberField, Segmented, SelectField, TextField, timeAgo, useToast } from "./ui";

const stageOf = (id: LeadStage) => LEAD_STAGES.find((s) => s.id === id)!;

export default function LeadsBoard({ initial, plans, goals }: { initial: Lead[]; plans: string[]; goals: string[] }) {
  const [leads, setLeads] = useState(initial);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const { toast, node } = useToast();
  const params = useSearchParams();

  useEffect(() => {
    const id = params.get("open");
    if (id) setOpenId(id);
  }, [params]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return leads;
    return leads.filter((l) => [l.name, l.phone, l.email, l.goal, l.source].some((x) => x.toLowerCase().includes(t)));
  }, [leads, q]);

  async function patch(id: string, body: Partial<Lead> & { note?: string }) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...body } : l)));
    const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setLeads(prev);
      toast("Couldn't save", "err");
      return;
    }
    const updated: Lead = await res.json();
    setLeads((ls) => ls.map((l) => (l.id === id ? updated : l)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this lead permanently?")) return;
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    setLeads((ls) => ls.filter((l) => l.id !== id));
    setOpenId(null);
    toast("Lead deleted");
  }

  const open = leads.find((l) => l.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Leads" desc={`${leads.length} total · ${leads.filter((l) => l.stage === "new").length} new`}>
        <Segmented
          layoutId="lead-view"
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: <><Kanban className="size-4" /> Board</> },
            { value: "list", label: <><List className="size-4" /> List</> },
          ]}
        />
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> New lead
        </Button>
      </PageHeader>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
        <input className={`${inputCls} !bg-[#121212] pl-10`} placeholder="Search name, phone, goal, source…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {view === "board" ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible">
          {LEAD_STAGES.map((st) => {
            const col = filtered.filter((l) => l.stage === st.id);
            const value = col.reduce((a, l) => a + (l.value || 0), 0);
            return (
              <div
                key={st.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(st.id);
                }}
                onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
                onDrop={() => {
                  if (dragId) {
                    const l = leads.find((x) => x.id === dragId);
                    if (l && l.stage !== st.id) {
                      patch(dragId, { stage: st.id, note: `Moved to ${st.label}` });
                      toast(`${l.name} → ${st.label}`);
                    }
                  }
                  setDragId(null);
                  setOver(null);
                }}
                className={`flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-none p-2 transition-colors xl:w-auto xl:max-w-none ${over === st.id ? "bg-accent/10 ring-2 ring-accent/40" : "bg-white/[0.035]"}`}
              >
                <div className="flex items-center justify-between px-2 pb-3 pt-2">
                  <span className="flex items-center gap-2 font-mono text-[14px] uppercase tracking-[0.06em]">
                    <span className="size-2 rounded-none" style={{ background: st.tone }} />
                    {st.label}
                    <span className="rounded-none bg-[#121212] px-2 py-0.5 text-[11.5px] font-medium text-white/50">{col.length}</span>
                  </span>
                  {value > 0 && <span className="text-[11.5px] text-white/40">₹{(value / 1000).toFixed(1)}k</span>}
                </div>
                <div className="flex min-h-[120px] flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {col.map((l) => (
                      <motion.button
                        layout
                        layoutId={l.id}
                        key={l.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: dragId === l.id ? 0.4 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        draggable
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setOpenId(l.id)}
                        className="cursor-grab rounded-none bg-[#121212] p-3.5 text-left shadow-[0_1px_2px_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.1)] active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.name} size={30} />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[15px] uppercase tracking-[0.02em]">{l.name}</p>
                            <p className="truncate text-[12px] text-white/45">{l.phone}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {l.goal && <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11.5px]">{l.goal}</span>}
                          {l.preferredTime && <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11.5px]">{l.preferredTime}</span>}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11.5px] text-white/40">
                          <span>{l.source}</span>
                          <span>{timeAgo(l.createdAt)}</span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {!col.length && <p className="px-2 py-6 text-center text-[12.5px] text-white/30">Drop leads here</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] gap-4 border-b border-white/10 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-white/45 md:grid">
            <span>Name</span>
            <span>Goal</span>
            <span>Stage</span>
            <span>Source</span>
            <span className="text-right">Created</span>
          </div>
          {filtered.map((l) => {
            const st = stageOf(l.stage);
            return (
              <button key={l.id} onClick={() => setOpenId(l.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 text-left last:border-0 hover:bg-white/[0.02] md:grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] md:gap-4">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={l.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{l.name}</span>
                    <span className="block truncate text-[12.5px] text-white/45">{l.phone}</span>
                  </span>
                </span>
                <span className="hidden text-[14px] md:block">{l.goal || "—"}</span>
                <span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
                <span className="hidden text-[14px] text-white/60 md:block">{l.source}</span>
                <span className="hidden text-right text-[13px] text-white/45 md:block">{timeAgo(l.createdAt)}</span>
              </button>
            );
          })}
          {!filtered.length && <p className="p-8 text-center text-white/40">No leads match.</p>}
        </Card>
      )}

      <LeadDrawer
        lead={open}
        plans={plans}
        onClose={() => setOpenId(null)}
        onPatch={(b) => open && patch(open.id, b)}
        onDelete={() => open && remove(open.id)}
        onConverted={(name) => {
          if (open) setLeads((ls) => ls.map((l) => (l.id === open.id ? { ...l, stage: "won" } : l)));
          toast(`${name} is now a member 🎉`);
        }}
      />

      <AddLead
        open={adding}
        goals={goals}
        onClose={() => setAdding(false)}
        onAdded={(l) => {
          setLeads((ls) => [l, ...ls]);
          toast("Lead added");
        }}
      />
      {node}
    </div>
  );
}

function LeadDrawer({
  lead,
  plans,
  onClose,
  onPatch,
  onDelete,
  onConverted,
}: {
  lead: Lead | null;
  plans: string[];
  onClose: () => void;
  onPatch: (b: Partial<Lead> & { note?: string }) => void;
  onDelete: () => void;
  onConverted: (name: string) => void;
}) {
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState(plans[1] ?? plans[0] ?? "");
  const [converting, setConverting] = useState(false);
  const digits = lead?.phone.replace(/\D/g, "") ?? "";

  async function convert() {
    if (!lead) return;
    setConverting(true);
    await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lead.name, phone: lead.phone, email: lead.email, plan, fromLeadId: lead.id }),
    });
    setConverting(false);
    onConverted(lead.name);
  }

  return (
    <Modal open={!!lead} onClose={onClose} title="Lead" side>
      {lead && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={lead.name} size={56} />
            <div>
              <h2 className="display text-[36px]">{lead.name}</h2>
              <p className="text-[13px] text-white/45">
                {lead.source} · created {timeAgo(lead.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a href={`tel:${lead.phone}`} className="flex flex-col items-center gap-1 rounded-none bg-accent/10 py-3 text-[12.5px] font-medium text-accent">
              <Phone className="size-5" /> Call
            </a>
            <a href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${lead.name.split(" ")[0]}! Thanks for booking a free trial.`)}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-none bg-[#34c759]/10 py-3 text-[12.5px] font-medium text-[#248a3d]">
              <MessageCircle className="size-5" /> WhatsApp
            </a>
            <a href={lead.email ? `mailto:${lead.email}` : undefined} className={`flex flex-col items-center gap-1 rounded-none bg-white/[0.05] py-3 text-[12.5px] font-medium ${lead.email ? "" : "opacity-40"}`}>
              <Mail className="size-5" /> Email
            </a>
          </div>

          <div>
            <p className="mb-2 text-[12.5px] font-medium text-white/50">Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPatch({ stage: s.id, note: `Moved to ${s.label}` })}
                  className="h-9 rounded-none px-3.5 text-[13px] font-medium transition"
                  style={lead.stage === s.id ? { background: s.tone, color: "#fff" } : { background: `${s.tone}14`, color: s.tone }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-none bg-[#0a0a0a] p-4 text-[14px]">
            <Info k="Phone" v={lead.phone} />
            <Info k="Email" v={lead.email || "—"} />
            <Info k="Goal" v={lead.goal || "—"} />
            <Info k="Preferred time" v={lead.preferredTime || "—"} />
            {lead.message && (
              <div className="col-span-2">
                <dt className="text-[12px] text-white/45">Message</dt>
                <dd className="mt-0.5">{lead.message}</dd>
              </div>
            )}
          </dl>

          <NumberField label="Deal value (₹ / month)" value={lead.value} onChange={(v) => onPatch({ value: v })} />

          <div className="rounded-none border border-white/[0.06] p-4">
            <p className="text-[14px] font-semibold">Convert to member</p>
            <p className="mt-0.5 text-[12.5px] text-white/45">Creates a member with a 1-month plan and marks this lead as won.</p>
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <SelectField value={plan} onChange={setPlan} options={plans.map((p) => ({ value: p, label: p }))} />
              </div>
              <Button variant="dark" onClick={convert} disabled={converting || lead.stage === "won"}>
                <UserPlus className="size-4" /> {lead.stage === "won" ? "Converted" : "Convert"}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12.5px] font-medium text-white/50">Activity</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                onPatch({ note });
                setNote("");
              }}
              className="flex gap-2"
            >
              <input className={inputCls} placeholder="Add a note — e.g. called, booked Tue 7pm" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="secondary">Add</Button>
            </form>
            <ol className="mt-4 space-y-3 border-l-2 border-white/[0.06] pl-4">
              {lead.notes.map((n) => (
                <li key={n.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-none bg-accent" />
                  <p className="text-[14px]">{n.text}</p>
                  <p className="text-[12px] text-white/40">{timeAgo(n.at)}</p>
                </li>
              ))}
              <li className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-none bg-black/20" />
                <p className="text-[14px] text-white/60">Lead created via {lead.source}</p>
                <p className="text-[12px] text-white/40">{timeAgo(lead.createdAt)}</p>
              </li>
            </ol>
          </div>

          <Button variant="danger" onClick={onDelete} className="w-full">
            <Trash2 className="size-4" /> Delete lead
          </Button>
        </div>
      )}
    </Modal>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-white/45">{k}</dt>
      <dd className="mt-0.5 truncate font-medium">{v}</dd>
    </div>
  );
}

function AddLead({ open, onClose, onAdded, goals }: { open: boolean; onClose: () => void; onAdded: (l: Lead) => void; goals: string[] }) {
  const empty = { name: "", phone: "", email: "", goal: goals[0] ?? "", source: "Walk-in", preferredTime: "Evening", message: "" };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return;
    const res = await fetch("/api/admin/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (res.ok) {
      onAdded(await res.json());
      setF(empty);
      onClose();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New lead"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!f.name.trim()}>Add lead</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={f.name} onChange={set("name")} />
        <TextField label="Phone" value={f.phone} onChange={set("phone")} type="tel" />
        <TextField label="Email" value={f.email} onChange={set("email")} type="email" />
        <SelectField label="Goal" value={f.goal} onChange={set("goal")} options={goals.map((g) => ({ value: g, label: g }))} />
        <SelectField label="Source" value={f.source} onChange={set("source")} options={["Walk-in", "Phone", "Instagram", "Google", "Referral", "Website"].map((s) => ({ value: s, label: s }))} />
        <SelectField label="Preferred time" value={f.preferredTime} onChange={set("preferredTime")} options={["Morning", "Afternoon", "Evening"].map((s) => ({ value: s, label: s }))} />
        <div className="sm:col-span-2">
          <TextField label="Notes" value={f.message} onChange={set("message")} textarea />
        </div>
      </div>
    </Modal>
  );
}
