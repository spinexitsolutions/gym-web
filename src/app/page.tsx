import type { Metadata } from "next";
import { getContent } from "@/lib/db";
import SiteShell from "@/components/site/SiteShell";
import Sections from "@/components/site/Sections";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  return {
    title: c.seo.title,
    description: c.seo.description,
    openGraph: { title: c.seo.title, description: c.seo.description, images: [c.hero.image] },
  };
}

export default async function Home() {
  const content = await getContent();
  return (
    <SiteShell content={content}>
      <Sections />
    </SiteShell>
  );
}
