"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Pencil, Plus, Search, Trash2, UserCheck } from "lucide-react";
import type { Member, MemberStatus } from "@/lib/types";
import { PageHeader } from "./AdminShell";
import { Avatar, Badge, Button, Card, inputCls, Modal, NumberField, Segmented, SelectField, TextField, useToast } from "./ui";

const STATUS: Record<MemberStatus, { label: string; tone: string }> = {
  active: { label: "Active", tone: "#34c759" },
  frozen: { label: "Frozen", tone: "#0a84ff" },
  expired: { label: "Expired", tone: "#ff3b30" },
};
const DAY = 86400000;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
const addMonth = (iso: string) => {
  const base = new Date(Math.max(Date.now(), new Date(iso).getTime()));
  base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
};

export default function MembersTable({ initial, plans, trainers }: { initial: Member[]; plans: string[]; trainers: string[] }) {
  const [members, setMembers] = useState(initial);
  const [filter, setFilter] = useState<"all" | MemberStatus>("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Member | "new" | null>(null);
  const { toast, node } = useToast();

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return members.filter((m) => (filter === "all" || m.status === filter) && (!t || [m.name, m.phone, m.email, m.plan].some((x) => x.toLowerCase().includes(t))));
  }, [members, filter, q]);

  async function patch(id: string, body: Partial<Member> & { checkIn?: boolean }, msg?: string) {
    const res = await fetch(`/api/admin/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return toast("Couldn't save", "err");
    const m: Member = await res.json();
    setMembers((ms) => ms.map((x) => (x.id === id ? m : x)));
    if (msg) toast(msg);
  }

  async function remove(id: string) {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    setMembers((ms) => ms.filter((m) => m.id !== id));
    setEdit(null);
    toast("Member removed");
  }

  const counts = (s: MemberStatus) => members.filter((m) => m.status === s).length;

  return (
    <div>
      <PageHeader title="Members" desc={`${counts("active")} active · ${counts("frozen")} frozen · ${counts("expired")} expired`}>
        <Button onClick={() => setEdit("new")}>
          <Plus className="size-4" /> Add member
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented
          layoutId="mem-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${members.length}` },
            { value: "active", label: "Active" },
            { value: "frozen", label: "Frozen" },
            { value: "expired", label: "Expired" },
          ]}
        />
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
          <input className={`${inputCls} !bg-[#121212] pl-10`} placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_1fr_0.9fr_1fr_0.7fr_auto] gap-4 border-b border-white/10 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-white/45 lg:grid">
          <span>Member</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Expires</span>
          <span>Check-ins</span>
          <span className="w-[200px] text-right">Actions</span>
        </div>
        {list.map((m) => {
          const d = daysLeft(m.expiresAt);
          return (
            <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 last:border-0 lg:grid-cols-[1.6fr_1fr_0.9fr_1fr_0.7fr_auto] lg:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium">{m.name}</p>
                  <p className="truncate text-[12.5px] text-white/45">
                    {m.phone}
                    <span className="lg:hidden"> · {m.plan}</span>
                  </p>
                </div>
              </div>
              <span className="hidden text-[14px] lg:block">
                {m.plan}
                <span className="block text-[12px] text-white/40">Coach: {m.trainer}</span>
              </span>
              <span>
                <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
              </span>
              <span className="hidden text-[14px] lg:block">
                {new Date(m.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                <span className={`block text-[12px] ${d < 0 ? "text-[#ff3b30]" : d <= 7 ? "text-[#ff9f0a]" : "text-white/40"}`}>
                  {d < 0 ? `${-d} days overdue` : `${d} days left`}
                </span>
              </span>
              <span className="hidden text-[14px] tabular-nums lg:block">{m.checkIns}</span>
              <div className="col-span-2 flex justify-end gap-1.5 lg:col-span-1 lg:w-[200px]">
                <Button size="sm" variant="secondary" onClick={() => patch(m.id, { checkIn: true }, `Checked in ${m.name.split(" ")[0]}`)}>
                  <UserCheck className="size-3.5" /> Check-in
                </Button>
                <Button size="sm" variant="secondary" onClick={() => patch(m.id, { expiresAt: addMonth(m.expiresAt), status: "active" }, "Renewed for 1 month")} >
                  <CalendarPlus className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit(m)}>
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {!list.length && <p className="p-10 text-center text-white/40">No members here yet.</p>}
      </Card>

      <MemberForm
        key={edit === "new" ? "new" : edit?.id ?? "none"}
        member={edit}
        plans={plans}
        trainers={trainers}
        onClose={() => setEdit(null)}
        onDelete={remove}
        onSaved={(m, isNew) => {
          setMembers((ms) => (isNew ? [m, ...ms] : ms.map((x) => (x.id === m.id ? m : x))));
          toast(isNew ? "Member added" : "Saved");
          setEdit(null);
        }}
      />
      {node}
    </div>
  );
}

function MemberForm({
  member,
  plans,
  trainers,
  onClose,
  onSaved,
  onDelete,
}: {
  member: Member | "new" | null;
  plans: string[];
  trainers: string[];
  onClose: () => void;
  onSaved: (m: Member, isNew: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = member === "new";
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Omit<Member, "id">>(() =>
    member && member !== "new"
      ? { ...member }
      : { name: "", phone: "", email: "", plan: plans[0] ?? "", status: "active", joinedAt: today, expiresAt: addMonth(today), trainer: "—", checkIns: 0, notes: "" },
  );
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f.name.trim()) return;
    const res = await fetch(isNew ? "/api/admin/members" : `/api/admin/members/${(member as Member).id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (res.ok) onSaved(await res.json(), isNew);
  }

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={isNew ? "Add member" : "Edit member"}
      footer={
        <>
          {!isNew && member && (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete((member as Member).id)}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!f.name.trim()}>{isNew ? "Add member" : "Save"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" value={f.name} onChange={set("name")} />
        <TextField label="Phone" value={f.phone} onChange={set("phone")} type="tel" />
        <TextField label="Email" value={f.email} onChange={set("email")} type="email" />
        <SelectField label="Plan" value={f.plan} onChange={set("plan")} options={plans.map((p) => ({ value: p, label: p }))} />
        <SelectField label="Status" value={f.status} onChange={set("status")} options={(Object.keys(STATUS) as MemberStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))} />
        <SelectField label="Coach" value={f.trainer} onChange={set("trainer")} options={["—", ...trainers].map((t) => ({ value: t, label: t }))} />
        <TextField label="Joined" type="date" value={f.joinedAt} onChange={set("joinedAt")} />
        <TextField label="Expires" type="date" value={f.expiresAt} onChange={set("expiresAt")} />
        <NumberField label="Check-ins" value={f.checkIns} onChange={set("checkIns")} min={0} />
        <div className="sm:col-span-2">
          <TextField label="Notes" textarea value={f.notes} onChange={set("notes")} placeholder="Injuries, goals, payment notes…" />
        </div>
      </div>
    </Modal>
  );
}
