import { NextResponse } from "next/server";
import { uid, updateDb } from "@/lib/db";
import type { Lead } from "@/lib/types";

const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

/** Public endpoint — the website's trial form posts here and it lands in the CRM. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true }); // honeypot

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 20);
  if (name.length < 2 || phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "Please add your name and a valid phone number." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const lead: Lead = {
    id: uid("lead"),
    name,
    phone,
    email: clean(body.email, 120),
    goal: clean(body.goal, 60),
    preferredTime: clean(body.preferredTime, 30),
    message: clean(body.message, 1000),
    source: clean(body.source, 40) || "Website",
    stage: "new",
    value: 0,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  await updateDb((db) => {
    db.leads.unshift(lead);
  });
  return NextResponse.json({ ok: true });
}
