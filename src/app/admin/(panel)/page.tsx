import { readDb } from "@/lib/db";
import Dashboard from "@/components/admin/Dashboard";

export default async function Page() {
  const db = await readDb();
  return <Dashboard leads={db.leads} members={db.members} plans={db.content.plans} currency={db.content.currency} />;
}
