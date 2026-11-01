import { getContent } from "@/lib/db";
import ContentEditor from "@/components/admin/ContentEditor";

export default async function Page() {
  return <ContentEditor initial={await getContent()} />;
}
