import { NextResponse } from "next/server";
import { readDb, uid, updateDb } from "@/lib/db";
import type { Lead } from "@/lib/types";

export async function GET() {
  return NextResponse.json((await readDb()).leads);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Lead>;
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const now = new Date().toISOString();
  const lead: Lead = {
    id: uid("lead"),
    name: body.name,
    phone: body.phone ?? "",
    email: body.email ?? "",
    goal: body.goal ?? "",
    preferredTime: body.preferredTime ?? "",
    message: body.message ?? "",
    source: body.source || "Manual",
    stage: body.stage ?? "new",
    value: Number(body.value) || 0,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  await updateDb((db) => {
    db.leads.unshift(lead);
  });
  return NextResponse.json(lead);
}
