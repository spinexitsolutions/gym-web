import { NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { seedContent } from "@/lib/seed";

/** Restores website content to defaults (CRM data is kept). */
export async function POST() {
  const content = await updateDb((db) => {
    db.content = structuredClone(seedContent);
    return db.content;
  });
  return NextResponse.json(content);
}
