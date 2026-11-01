import { NextResponse } from "next/server";
import { uid, updateDb } from "@/lib/db";
import type { Lead } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Lead> & { note?: string };
  const lead = await updateDb((db) => {
    const l = db.leads.find((x) => x.id === id);
    if (!l) return null;
    const { note, id: _ignore, notes: _n, createdAt: _c, ...rest } = body;
    void _ignore; void _n; void _c;
    Object.assign(l, rest);
    if (note?.trim()) l.notes.unshift({ id: uid("note"), text: note.trim(), at: new Date().toISOString() });
    l.updatedAt = new Date().toISOString();
    return l;
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await updateDb((db) => {
    db.leads = db.leads.filter((x) => x.id !== id);
  });
  return NextResponse.json({ ok: true });
}
