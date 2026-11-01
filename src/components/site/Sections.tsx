"use client";

import type { SectionId } from "@/lib/types";
import { useSite } from "./context";
import Hero, { Ticker } from "./Hero";
import { Programs, Reveal, Stats } from "./StorySections";
import LoadTheBar from "./LoadTheBar";
import { Bmi, Pricing, Schedule, Trainers } from "./ClubSections";
import { Faq, Footer, Gallery, Join, Testimonials } from "./CommunitySections";

const MAP: Record<SectionId, () => React.ReactNode> = {
  manifesto: LoadTheBar,
  stats: Stats,
  programs: Programs,
  reveal: Reveal,
  trainers: Trainers,
  schedule: Schedule,
  pricing: Pricing,
  bmi: Bmi,
  testimonials: Testimonials,
  gallery: Gallery,
  faq: Faq,
  join: Join,
};

/** Renders sections in the order + visibility set in the admin CMS. */
export default function Sections() {
  const { content } = useSite();
  return (
    <>
      <Hero />
      <Ticker />
      {content.sections
        .filter((s) => s.enabled && MAP[s.id])
        .map((s) => {
          const C = MAP[s.id];
          return <C key={s.id} />;
        })}
      <Footer />
    </>
  );
}
