/*
 * Minimal signed-cookie admin auth (Web Crypto → works in proxy + routes).
 * Configure with env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECRET.
 */

export const SESSION_COOKIE = "gym_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@monolith.club";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "monolith123";
const SECRET = process.env.ADMIN_SECRET || "change-this-secret-in-production";

const enc = new TextEncoder();

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${ADMIN_EMAIL}|${exp}`;
  return { token: `${payload}|${await sign(payload)}`, maxAge: MAX_AGE };
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [email, exp, sig] = parts;
  if (Number(exp) * 1000 < Date.now()) return false;
  const expected = await sign(`${email}|${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
