"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ExternalLink, LayoutDashboard, LogOut, PanelsTopLeft, UserRoundCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users, sub: "CRM" },
  { href: "/admin/members", label: "Members", icon: UserRoundCheck },
  { href: "/admin/content", label: "Website", icon: PanelsTopLeft, sub: "CMS" },
];

function ink(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? "#1d1d1f" : "#fff";
}

export default function AdminShell({ children, brand, accent }: { children: ReactNode; brand: string; accent: string }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/admin/login";
  };

  return (
    <div className="min-h-[100svh] bg-[#f5f5f7] text-[#1d1d1f] [font-feature-settings:'ss01']">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-black/[0.06] bg-white/70 p-4 backdrop-blur-2xl lg:flex">
        <div className="flex items-center gap-3 px-2 py-3">
          <span className="grid size-9 place-items-center rounded-[11px] text-[14px] font-bold " style={{ background: accent, color: ink(accent) }}>
            {brand[0]}
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-[-0.02em]">{brand}</p>
            <p className="text-[12px] text-black/45">Studio admin</p>
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, sub }) => {
            const on = isActive(href);
            return (
              <Link key={href} href={href} className="relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium">
                {on && <motion.span layoutId="side-active" className="absolute inset-0 rounded-[10px] bg-black/[0.06]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className={`relative size-[18px] ${on ? "text-[#0a84ff]" : "text-black/50"}`} />
                <span className="relative">{label}</span>
                {sub && <span className="relative ml-auto rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-semibold text-black/40">{sub}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <a href="/" target="_blank" className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] text-black/60 hover:bg-black/[0.04]">
            <ExternalLink className="size-[18px]" /> View website
          </a>
          <button onClick={logout} className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] text-black/60 hover:bg-black/[0.04]">
            <LogOut className="size-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-black/[0.06] bg-white/75 px-4 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[10px] text-[13px] font-bold " style={{ background: accent, color: ink(accent) }}>
            {brand[0]}
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">{brand}</span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/" target="_blank" className="grid size-9 place-items-center rounded-full text-black/60 hover:bg-black/5" aria-label="View website">
            <ExternalLink className="size-[18px]" />
          </a>
          <button onClick={logout} className="grid size-9 place-items-center rounded-full text-black/60 hover:bg-black/5" aria-label="Sign out">
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </header>

      <main className="pb-28 lg:pb-12 lg:pl-[248px]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/[0.06] bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(href);
          return (
            <Link key={href} href={href} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium ${on ? "text-[#0a84ff]" : "text-black/45"}`}>
              <Icon className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} />
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
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] md:text-[34px]">{title}</h1>
        {desc && <p className="mt-1 text-[14.5px] text-black/50">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
