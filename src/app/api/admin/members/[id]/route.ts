import { NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import type { Member } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Member> & { checkIn?: boolean };
  const member = await updateDb((db) => {
    const m = db.members.find((x) => x.id === id);
    if (!m) return null;
    const { checkIn, id: _ignore, ...rest } = body;
    void _ignore;
    Object.assign(m, rest);
    if (checkIn) m.checkIns += 1;
    return m;
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await updateDb((db) => {
    db.members = db.members.filter((x) => x.id !== id);
  });
  return NextResponse.json({ ok: true });
}
