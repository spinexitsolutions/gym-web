"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, LayoutDashboard, LogOut, PanelsTopLeft, UserRoundCheck, Users } from "lucide-react";
import Led from "@/components/site/Led";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users, sub: "CRM" },
  { href: "/admin/members", label: "Members", icon: UserRoundCheck },
  { href: "/admin/content", label: "Website", icon: PanelsTopLeft, sub: "CMS" },
];

function ink(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? "#0b0b0b" : "#ffffff";
}

function useClock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setT(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 10_000);
    return () => clearInterval(i);
  }, []);
  return t;
}

/** Admin "control room" — same rubber-floor / hazard-yellow / LED language as the website. */
export default function AdminShell({ children, brand, accent }: { children: ReactNode; brand: string; accent: string }) {
  const path = usePathname();
  const clock = useClock();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/admin/login";
  };

  const vars = {
    "--accent": accent,
    "--accent-ink": ink(accent),
    "--bg": "#0b0b0b",
    "--fg": "#ecebe4",
  } as React.CSSProperties;

  return (
    <div data-theme="dark" style={vars} className="concrete min-h-[100svh] text-[#ecebe4]">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/10 bg-[#0f0f0f] lg:flex">
        <div className="tape h-2" />
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="cut-sm grid size-11 place-items-center bg-accent text-accent-ink">
            <span className="display text-[28px] leading-none">{brand[0]}</span>
          </span>
          <div className="leading-none">
            <p className="display text-[26px]">{brand}</p>
            <p className="mt-1 font-mono text-[10.5px] uppercase text-white/45">Control room</p>
          </div>
        </div>

        <nav className="mt-2 flex flex-col border-y border-white/10">
          {NAV.map(({ href, label, icon: Icon, sub }, i) => {
            const on = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex h-14 items-center gap-3 border-b border-white/[0.06] px-5 font-mono text-[15px] uppercase transition-colors last:border-0 ${
                  on ? "bg-white/[0.05] text-accent" : "text-white/70 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                {on && <motion.span layoutId="side-active" className="absolute inset-y-0 left-0 w-[3px] bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="w-5 text-[11px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-[18px]" />
                <span>{label}</span>
                {sub && <span className="ml-auto border border-white/15 px-1.5 py-0.5 text-[10px] text-white/45">{sub}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 p-4">
          <div className="mb-3 flex items-center justify-between border border-white/10 bg-black px-3 py-3">
            <span className="font-mono text-[10px] uppercase leading-tight text-white/40">
              Floor
              <br />
              clock
            </span>
            <Led text={clock ?? "--:--"} className="h-8" blinkColon />
          </div>
          <a href="/" target="_blank" className="flex h-10 items-center gap-3 px-2 font-mono text-[13px] uppercase text-white/55 hover:text-accent">
            <ExternalLink className="size-[17px]" /> View website
          </a>
          <button onClick={logout} className="flex h-10 w-full items-center gap-3 px-2 font-mono text-[13px] uppercase text-white/55 hover:text-[#ff453a]">
            <LogOut className="size-[17px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur lg:hidden">
        <div className="tape h-1.5" />
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="cut-sm grid size-9 place-items-center bg-accent text-accent-ink">
              <span className="display text-[22px] leading-none">{brand[0]}</span>
            </span>
            <span className="display text-[22px]">{brand}</span>
          </div>
          <div className="flex items-center gap-1">
            <Led text={clock ?? "--:--"} className="mr-2 h-5" blinkColon />
            <a href="/" target="_blank" className="grid size-9 place-items-center text-white/60 hover:text-accent" aria-label="View website">
              <ExternalLink className="size-[18px]" />
            </a>
            <button onClick={logout} className="grid size-9 place-items-center text-white/60 hover:text-[#ff453a]" aria-label="Sign out">
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="pb-28 lg:pb-12 lg:pl-[260px]">
        <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#0b0b0b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(href);
          return (
            <Link key={href} href={href} className={`relative flex h-16 flex-col items-center justify-center gap-1 font-mono text-[11px] uppercase ${on ? "text-accent" : "text-white/45"}`}>
              {on && <motion.span layoutId="tab-active" className="absolute inset-x-4 top-0 h-[3px] bg-accent" />}
              <Icon className="size-[21px]" strokeWidth={on ? 2.3 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow mb-2 flex items-center gap-2">
          <span className="tape-thin h-2.5 w-8" /> Control room
        </p>
        <h1 className="display text-[52px] md:text-[72px]">{title}</h1>
        {desc && <p className="mt-2 font-mono text-[13px] uppercase text-white/50">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
