import { readDb } from "@/lib/db";
import { Suspense } from "react";
import LeadsBoard from "@/components/admin/LeadsBoard";

export default async function Page() {
  const db = await readDb();
  return (
    <Suspense>
      <LeadsBoard initial={db.leads} plans={db.content.plans.map((p) => p.name)} goals={db.content.join.goals} />
    </Suspense>
  );
}
