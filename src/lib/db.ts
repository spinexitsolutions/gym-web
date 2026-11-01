import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Database, SiteContent } from "./types";
import { seedContent, seedDatabase } from "./seed";

/*
 * Tiny JSON-file database. Perfect for a demo / single-gym deployment
 * on a VPS. On read-only hosts (e.g. Vercel) writes fall back to memory,
 * so swap this module for Postgres/Supabase when going to production —
 * every caller goes through `readDb` / `updateDb`.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type G = typeof globalThis & {
  __gymDb?: Database;
  __gymLoading?: Promise<Database>;
  __gymLock?: Promise<unknown>;
};
const g = globalThis as G;

/** Deep-merge saved content onto the seed so newly added fields always exist. */
function mergeDefaults<T>(base: T, saved: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(saved) ? saved : base) as T;
  if (base && typeof base === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    if (saved && typeof saved === "object") {
      for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
        out[k] = k in out ? mergeDefaults(out[k], v) : v;
      }
    }
    return out as T;
  }
  return (saved === undefined ? base : saved) as T;
}

function normalise(db: Partial<Database>): Database {
  const content = mergeDefaults<SiteContent>(structuredClone(seedContent), db.content);
  // make sure every known section exists exactly once
  const known = seedContent.sections;
  const seen = new Set(content.sections.map((s) => s.id));
  content.sections = [
    ...content.sections.filter((s) => known.some((k) => k.id === s.id)),
    ...known.filter((k) => !seen.has(k.id)),
  ];
  return { content, leads: db.leads ?? [], members: db.members ?? [] };
}

export async function readDb(): Promise<Database> {
  if (g.__gymDb) return g.__gymDb;
  g.__gymLoading ??= (async () => {
    try {
      const raw = await fs.readFile(DB_FILE, "utf8");
      g.__gymDb = normalise(JSON.parse(raw));
    } catch {
      g.__gymDb = seedDatabase();
      await persist(g.__gymDb);
    }
    return g.__gymDb;
  })();
  return g.__gymLoading;
}

async function persist(db: Database) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, DB_FILE);
  } catch (err) {
    console.warn("[db] could not write to disk, keeping changes in memory", err);
  }
}

/** Serialised read-modify-write so concurrent requests never clobber each other. */
export async function updateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await readDb();
    const result = await fn(db);
    await persist(db);
    return result;
  };
  const next = (g.__gymLock ?? Promise.resolve()).then(run, run);
  g.__gymLock = next.catch(() => undefined);
  return next;
}

export async function getContent(): Promise<SiteContent> {
  return (await readDb()).content;
}

export async function resetDb() {
  g.__gymLoading = undefined;
  g.__gymDb = seedDatabase();
  await persist(g.__gymDb);
  return g.__gymDb;
}

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
