import AdminShell from "@/components/admin/AdminShell";
import { getContent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Studio", robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const c = await getContent();
  return <AdminShell brand={c.brand.name} accent={c.brand.accent}>{children}</AdminShell>;
}
