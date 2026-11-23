import { requireAdmin } from "@/lib/admin/guard";

import { AccuracyReport } from "./report";

export default async function AdminAccuracyPage() {
  await requireAdmin();
  return <AccuracyReport />;
}
