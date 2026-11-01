"use client";

/*
 * Seven-segment LED readout — the wall-mounted interval timer
 * you see in every serious box. Pure SVG, no font needed.
 */

const SEG: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
  "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "",
  G: "acdef", O: "abcdef", E: "adefg", S: "afgcd", P: "abefg", r: "eg", A: "abcefg",
  d: "bcdeg", Y: "bcdfg", t: "defg", U: "bcdef", L: "def", H: "bcefg", n: "ceg", o: "cdeg",
};

// segment polygons on a 60×100 cell
const POLY: Record<string, string> = {
  a: "10,4 50,4 44,11 16,11",
  b: "52,6 52,47 46,43 46,13",
  c: "52,53 52,94 46,87 46,57",
  d: "10,96 50,96 44,89 16,89",
  e: "8,53 14,57 14,87 8,94",
  f: "8,6 14,13 14,43 8,47",
  g: "10,50 16,46 44,46 50,50 44,54 16,54",
};

export function LedDigit({ ch, on = "currentColor", off = 0.08 }: { ch: string; on?: string; off?: number }) {
  const lit = SEG[ch] ?? "";
  return (
    <svg viewBox="0 0 60 100" className="h-full w-auto" style={{ transform: "skewX(-6deg)" }} aria-hidden>
      {Object.entries(POLY).map(([k, pts]) => (
        <polygon
          key={k}
          points={pts}
          fill={on}
          opacity={lit.includes(k) ? 1 : off}
          style={{ transition: "opacity 120ms linear" }}
        />
      ))}
    </svg>
  );
}

function Colon({ blink }: { blink?: boolean }) {
  return (
    <svg viewBox="0 0 20 100" className="h-full w-auto" aria-hidden style={blink ? { animation: "led-blink 1s steps(1) infinite" } : undefined}>
      <rect x="6" y="28" width="9" height="9" fill="currentColor" />
      <rect x="4" y="64" width="9" height="9" fill="currentColor" />
    </svg>
  );
}

/** Renders a string like "00:40" or "GO" as LED digits. */
export default function Led({
  text,
  className = "",
  color = "var(--led)",
  blinkColon,
  label,
}: {
  text: string;
  className?: string;
  color?: string;
  blinkColon?: boolean;
  label?: string;
}) {
  return (
    <span className={`led-glow inline-flex items-stretch gap-[0.06em] ${className}`} style={{ color }} role="img" aria-label={label ?? text}>
      {text.split("").map((c, i) => (c === ":" ? <Colon key={i} blink={blinkColon} /> : <LedDigit key={i} ch={c} />))}
    </span>
  );
}
