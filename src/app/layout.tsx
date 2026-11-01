import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Big_Shoulders, Big_Shoulders_Stencil } from "next/font/google";
import "./globals.css";

/* Athletic type system — all sans-serif:
   Big Shoulders  → stadium-signage display headlines
   Big Shoulders Stencil → equipment-marking highlights
   Barlow / Barlow Condensed → DIN-like body + scoreboard labels */
const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const stencil = Big_Shoulders_Stencil({ variable: "--font-stencil", subsets: ["latin"], display: "swap" });
const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const cond = Barlow_Condensed({ variable: "--font-cond", subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "MONOLITH Athletic Club",
  description: "Strength & conditioning club.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${stencil.variable} ${body.variable} ${cond.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
