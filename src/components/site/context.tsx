"use client";

import { createContext, useContext } from "react";
import type Lenis from "lenis";
import type { SiteContent } from "@/lib/types";

interface SiteCtx {
  content: SiteContent;
  /** true once the intro animation has finished (or was skipped) */
  ready: boolean;
  lenis: Lenis | null;
  scrollTo: (target: string | number) => void;
  /** Join-form goal prefill, set from pricing / BMI / schedule CTAs */
  prefill: { goal?: string; plan?: string };
  setPrefill: (p: { goal?: string; plan?: string }) => void;
}

export const SiteContext = createContext<SiteCtx | null>(null);

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside <SiteShell>");
  return ctx;
}

export const SECTION_NAV: Record<string, string> = {
  top: "Home",
  manifesto: "House rules",
  stats: "Numbers",
  programs: "Programs",
  reveal: "The Floor",
  trainers: "Coaches",
  schedule: "Schedule",
  pricing: "Membership",
  bmi: "BMI",
  testimonials: "Stories",
  gallery: "Gallery",
  faq: "FAQ",
  join: "Free trial",
  footer: "Visit",
};

/** sections worth showing in the expanded menu */
export const MENU_SECTIONS = ["programs", "reveal", "trainers", "schedule", "pricing", "testimonials", "faq", "join"];
