import { NextResponse } from "next/server";
import { ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_COOKIE, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (
    String(email ?? "").trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    password !== ADMIN_PASSWORD
  ) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const { token, maxAge } = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
