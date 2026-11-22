import Link from "next/link";

import { Empty, PageTitle } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { formatShortDate, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const ENTITIES = [
  "matches",
  "seasons",
  "teams",
  "team_aliases",
  "season_teams",
  "matchdays",
  "point_deductions",
  "site_settings",
];
const SKIP = new Set(["updated_at", "created_at"]);

/** Every admin change, newest first, with what changed. */
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const { entity } = (await searchParams) as { entity?: string };
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id,actor_id,action,entity,entity_id,before,after,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (entity && ENTITIES.includes(entity)) query = query.eq("entity", entity);
  const { data: rows } = await query;
  const actorIds = [
    ...new Set((rows ?? []).map((r) => r.actor_id).filter((x): x is string => !!x)),
  ];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", actorIds)
    : { data: [] };
  const name = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

  function changes(before: unknown, after: unknown): string {
    const b = (before ?? {}) as Record<string, unknown>;
    const a = (after ?? {}) as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
      (k) => !SKIP.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]),
    );
    return keys
      .map((k) => `${k}: ${JSON.stringify(b[k] ?? null)} → ${JSON.stringify(a[k] ?? null)}`)
      .join("; ");
  }

  return (
    <>
      <PageTitle sub="The latest 100 changes.">Audit log</PageTitle>
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...ENTITIES].map((e) => (
          <Link
            key={e ?? "all"}
            href={e ? `/admin/audit?entity=${e}` : "/admin/audit"}
            className={cn(
              "inline-flex h-11 items-center rounded-lg px-3 text-sm",
              (entity ?? undefined) === e ? "bg-primary text-primary-foreground" : "bg-surface",
            )}
          >
            {e ? e.replace("_", " ") : "All"}
          </Link>
        ))}
      </nav>
      {rows?.length ? (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface p-3 text-sm">
              <p>
                <span className="font-medium">{name.get(r.actor_id ?? "") ?? "Unknown"}</span>{" "}
                {r.action}d {r.entity.replace("_", " ")}
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatShortDate(r.created_at)} {formatTime(r.created_at)}
                </span>
              </p>
              <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                {changes(r.before, r.after) || r.entity_id}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No changes recorded yet.</Empty>
      )}
    </>
  );
}
