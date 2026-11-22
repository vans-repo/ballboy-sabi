import Link from "next/link";

import { ResultEditor } from "@/components/admin/result-editor";
import { Empty, PageTitle } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { editable } from "@/lib/admin/rows";
import { getContext } from "@/lib/data/context";
import { cn } from "@/lib/utils";

/** Edit any past result. Saving rescores every pick and starts a model run. */
export default async function ResultsHistoryPage({ searchParams }: PageProps<"/admin/results">) {
  await requireAdmin();
  const { season, team } = (await searchParams) as { season?: string; team?: string };
  const ctx = await getContext();
  const s = ctx.seasons.find((x) => x.label === season) ?? ctx.current;
  const t = team ? ctx.bySlug.get(team) : undefined;
  const list = ctx.matches
    .filter(
      (m) =>
        m.seasonId === s.id &&
        m.status !== "scheduled" &&
        (!t || m.homeId === t.id || m.awayId === t.id),
    )
    .sort(
      (a, b) =>
        Date.parse(b.kickoff) - Date.parse(a.kickoff) ||
        (b.sourceOrder ?? 0) - (a.sourceOrder ?? 0),
    )
    .slice(0, 60);
  const teams = [...ctx.teams.values()].filter((x) =>
    ctx.matches.some((m) => m.seasonId === s.id && (m.homeId === x.id || m.awayId === x.id)),
  );
  const q = (o: { season?: string; team?: string }) =>
    `/admin/results?${new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageTitle sub="Every change is saved to the audit log. Saving rescores picks and starts a model run.">
        Results history
      </PageTitle>
      <nav aria-label="Seasons" className="mb-3 flex flex-wrap gap-1">
        {[...ctx.seasons].reverse().map((x) => (
          <Link
            key={x.id}
            href={q({ season: x.label })}
            className={cn(
              "inline-flex h-11 items-center rounded-lg px-3 text-sm",
              x.id === s.id ? "bg-primary text-primary-foreground" : "bg-surface",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2" action="/admin/results">
        <input type="hidden" name="season" value={s.label} />
        <select
          name="team"
          defaultValue={t?.slug ?? ""}
          aria-label="Team"
          className="h-11 rounded-lg border bg-surface px-3"
        >
          <option value="">All teams</option>
          {teams.map((x) => (
            <option key={x.id} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-lg bg-surface px-4 text-sm">
          Filter
        </button>
      </form>
      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((m) => (
            <li key={m.id}>
              <ResultEditor match={editable(m, ctx)} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No results for this selection.</Empty>
      )}
      {list.length === 60 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing the 60 most recent. Filter by team to find older results.
        </p>
      )}
    </>
  );
}
