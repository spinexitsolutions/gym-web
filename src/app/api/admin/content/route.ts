import { NextResponse } from "next/server";
import { getContent, updateDb } from "@/lib/db";
import type { SiteContent } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getContent());
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as SiteContent | null;
  if (!body || typeof body !== "object" || !body.brand || !body.hero) {
    return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
  }
  const content = await updateDb((db) => {
    db.content = body;
    return db.content;
  });
  return NextResponse.json(content);
}
