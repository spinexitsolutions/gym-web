import { readDb } from "@/lib/db";
import MembersTable from "@/components/admin/MembersTable";

export default async function Page() {
  const db = await readDb();
  return (
    <MembersTable
      initial={db.members}
      plans={db.content.plans.map((p) => p.name)}
      trainers={db.content.trainers.map((t) => t.name.split(" ")[0])}
    />
  );
}
