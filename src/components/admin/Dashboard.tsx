"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { LEAD_STAGES, type Lead, type Member, type Plan } from "@/lib/types";
import { PageHeader } from "./AdminShell";
import { Avatar, Badge, Card, timeAgo } from "./ui";

const DAY = 86400000;

export default function Dashboard({ leads, members, plans, currency }: { leads: Lead[]; members: Member[]; plans: Plan[]; currency: string }) {
  const [now] = useState(() => Date.now());
  const s = useMemo(() => {
    const age = (iso: string) => now - new Date(iso).getTime();
    const last7 = leads.filter((l) => age(l.createdAt) < 7 * DAY).length;
    const prev7 = leads.filter((l) => age(l.createdAt) >= 7 * DAY && age(l.createdAt) < 14 * DAY).length;
    const active = members.filter((m) => m.status === "active");
    const price = (name: string) => plans.find((p) => p.name === name)?.monthly ?? 0;
    const mrr = active.reduce((a, m) => a + price(m.plan), 0);
    const won = leads.filter((l) => l.stage === "won").length;
    const closed = leads.filter((l) => l.stage === "won" || l.stage === "lost").length;
    const expiring = members
      .filter((m) => m.status === "active")
      .map((m) => ({ ...m, days: Math.ceil((new Date(m.expiresAt).getTime() - now) / DAY) }))
      .filter((m) => m.days <= 10)
      .sort((a, b) => a.days - b.days);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * DAY);
      const key = d.toDateString();
      return { label: d.toLocaleDateString("en-IN", { weekday: "narrow" }), date: d.getDate(), count: leads.filter((l) => new Date(l.createdAt).toDateString() === key).length };
    });
    const sources = Object.entries(
      leads.reduce<Record<string, number>>((a, l) => ((a[l.source] = (a[l.source] ?? 0) + 1), a), {}),
    ).sort((a, b) => b[1] - a[1]);
    return { last7, prev7, active: active.length, mrr, conv: closed ? Math.round((won / closed) * 100) : 0, expiring, days, sources };
  }, [leads, members, plans, now]);

  const max = Math.max(1, ...s.days.map((d) => d.count));
  const delta = s.last7 - s.prev7;
  const greeting = new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader title={greeting} desc={new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi label="New leads · 7d" value={s.last7} foot={<Trend v={delta} suffix=" vs last week" />} i={0} />
        <Kpi label="Active members" value={s.active} foot={<span className="text-black/45">of {members.length} total</span>} i={1} />
        <Kpi label="Monthly revenue" value={`${currency}${s.mrr.toLocaleString("en-IN")}`} foot={<span className="text-black/45">from active plans</span>} i={2} />
        <Kpi label="Win rate" value={`${s.conv}%`} foot={<span className="text-black/45">of closed leads</span>} i={3} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Leads, last 14 days" desc="Every trial request from the website lands here automatically.">
          <div className="flex h-[180px] items-end gap-1.5 md:gap-2.5">
            {s.days.map((d, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] font-medium text-black/0 transition group-hover:text-black/60">{d.count}</span>
                <motion.div
                  className={`w-full rounded-[6px] ${i === 13 ? "bg-[#0a84ff]" : "bg-[#0a84ff]/25 group-hover:bg-[#0a84ff]/50"}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
                  transition={{ delay: i * 0.03, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
                <span className="text-[11px] text-black/40">{d.date}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Pipeline" action={<Link href="/admin/leads" className="text-[13px] font-medium text-[#0a84ff]">Open CRM</Link>}>
          <div className="space-y-3.5">
            {LEAD_STAGES.map((st) => {
              const n = leads.filter((l) => l.stage === st.id).length;
              return (
                <div key={st.id}>
                  <div className="mb-1.5 flex justify-between text-[13.5px]">
                    <span className="font-medium">{st.label}</span>
                    <span className="tabular-nums text-black/50">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                    <motion.div className="h-full rounded-full" style={{ background: st.tone }} initial={{ width: 0 }} animate={{ width: `${(n / Math.max(1, leads.length)) * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-black/[0.06] pt-4">
            <p className="mb-2.5 text-[12.5px] font-medium text-black/50">Top sources</p>
            <div className="flex flex-wrap gap-1.5">
              {s.sources.map(([src, n]) => (
                <span key={src} className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[12.5px]">
                  {src} <b className="ml-1 font-semibold">{n}</b>
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Newest leads" action={<Link href="/admin/leads" className="text-[13px] font-medium text-[#0a84ff]">See all</Link>}>
          <ul className="-mx-2">
            {leads.slice(0, 6).map((l) => {
              const st = LEAD_STAGES.find((x) => x.id === l.stage)!;
              return (
                <li key={l.id}>
                  <Link href={`/admin/leads?open=${l.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-black/[0.03]">
                    <Avatar name={l.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{l.name}</p>
                      <p className="truncate text-[12.5px] text-black/45">{l.goal || "—"} · {timeAgo(l.createdAt)}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <ChevronRight className="size-4 text-black/25" />
                  </Link>
                </li>
              );
            })}
            {!leads.length && <p className="px-2 text-[14px] text-black/45">No leads yet.</p>}
          </ul>
        </Card>

        <Card title="Renewals due" desc="Active memberships expiring within 10 days." action={<Link href="/admin/members" className="text-[13px] font-medium text-[#0a84ff]">Members</Link>}>
          <ul className="-mx-2">
            {s.expiring.slice(0, 6).map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{m.name}</p>
                  <p className="text-[12.5px] text-black/45">{m.plan}</p>
                </div>
                <Badge tone={m.days < 0 ? "#ff3b30" : m.days <= 3 ? "#ff9f0a" : "#0a84ff"}>
                  {m.days < 0 ? `${-m.days}d overdue` : m.days === 0 ? "Today" : `in ${m.days}d`}
                </Badge>
                <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${m.name.split(" ")[0]}, your membership is due for renewal.`)}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#34c759]/10 px-3 py-1.5 text-[12.5px] font-medium text-[#248a3d]">
                  Remind
                </a>
              </li>
            ))}
            {!s.expiring.length && <p className="px-2 text-[14px] text-black/45">Nothing due. 🎉</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, foot, i }: { label: string; value: React.ReactNode; foot: React.ReactNode; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <Card className="h-full !p-4 md:!p-5">
        <p className="text-[12.5px] font-medium text-black/50">{label}</p>
        <p className="mt-2 text-[26px] font-semibold tracking-[-0.04em] tabular-nums md:text-[32px]">{value}</p>
        <p className="mt-1 text-[12px]">{foot}</p>
      </Card>
    </motion.div>
  );
}

function Trend({ v, suffix }: { v: number; suffix: string }) {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? "text-[#248a3d]" : "text-[#ff3b30]"}`}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(v)}
      <span className="ml-1 text-black/40">{suffix}</span>
    </span>
  );
}
