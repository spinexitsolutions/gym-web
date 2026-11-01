import { NextResponse } from "next/server";
import { readDb, uid, updateDb } from "@/lib/db";
import type { Member } from "@/lib/types";

export async function GET() {
  return NextResponse.json((await readDb()).members);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Member> & { fromLeadId?: string };
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const today = new Date();
  const expiry = new Date(today);
  expiry.setMonth(expiry.getMonth() + 1);
  const member: Member = {
    id: uid("mem"),
    name: body.name,
    phone: body.phone ?? "",
    email: body.email ?? "",
    plan: body.plan ?? "Essential",
    status: body.status ?? "active",
    joinedAt: body.joinedAt || today.toISOString().slice(0, 10),
    expiresAt: body.expiresAt || expiry.toISOString().slice(0, 10),
    trainer: body.trainer ?? "—",
    checkIns: Number(body.checkIns) || 0,
    notes: body.notes ?? "",
  };
  await updateDb((db) => {
    db.members.unshift(member);
    if (body.fromLeadId) {
      const lead = db.leads.find((l) => l.id === body.fromLeadId);
      if (lead) {
        lead.stage = "won";
        lead.updatedAt = new Date().toISOString();
        lead.notes.unshift({ id: uid("note"), text: `Converted to member (${member.plan})`, at: lead.updatedAt });
      }
    }
  });
  return NextResponse.json(member);
}
