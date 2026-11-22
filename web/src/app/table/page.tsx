import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { LeagueTable, ZoneKey } from "@/components/league-table";
import { Empty, PageTitle } from "@/components/section";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getLeagueTable } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Table",
  description:
    "The NPFL table: played, won, drawn, lost, goals, points and form, for every season since 2021/22.",
};

export default function TablePage({ searchParams }: PageProps<"/table">) {
  return (
    <Suspense fallback={<PageTitle>Table</PageTitle>}>
      <TableFromSearch searchParams={searchParams as Promise<{ season?: string }>} />
    </Suspense>
  );
}

async function TableFromSearch({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  return <SeasonTable label={season ?? null} />;
}

/** "2025/26" <-> "2025-26" in URLs. */
const toParam = (label: string) => label.replace("/", "-");

async function SeasonTable({ label }: { label: string | null }) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const ctx = await getContext();
  const season = ctx.seasons.find((s) => toParam(s.label) === label) ?? ctx.current;
  const rows = await getLeagueTable(season.id);
  const groups = [...new Set(rows.map((r) => r.group))];
  const grouped = groups.some((g) => g !== null);

  return (
    <>
      <PageTitle
        sub={grouped ? "Played in two groups. Positions are within each group." : undefined}
      >
        Table {season.label}
      </PageTitle>
      <nav aria-label="Seasons" className="mb-4 flex flex-wrap gap-2">
        {[...ctx.seasons].reverse().map((s) => (
          <Link
            key={s.id}
            href={s.id === ctx.current.id ? "/table" : `/table?season=${toParam(s.label)}`}
            aria-current={s.id === season.id ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-lg px-3 text-sm",
              s.id === season.id
                ? "bg-primary text-primary-foreground"
                : "bg-surface hover:bg-muted",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {rows.every((r) => r.played === 0) ? (
        <Empty>The table fills in after the first result.</Empty>
      ) : (
        groups.map((g) => {
          const groupRows = rows.filter((r) => r.group === g);
          return (
            <div key={g ?? "all"} className="mb-6">
              {g && <h2 className="mb-2 text-xl uppercase">{g}</h2>}
              <LeagueTable
                rows={groupRows}
                teams={ctx.teams}
                size={groupRows.length}
                grouped={grouped}
                caption={`${season.label} table${g ? `, ${g}` : ""}`}
              />
            </div>
          );
        })
      )}
      {!grouped && <ZoneKey />}
      {rows.some((r) => r.pointsDeducted > 0) && (
        <ul className="mt-4 text-sm text-muted-foreground">
          {rows
            .filter((r) => r.pointsDeducted > 0)
            .map((r) => (
              <li key={r.teamId}>
                {ctx.teams.get(r.teamId)?.name}: {r.pointsDeducted} points deducted (
                {r.deductionNotes}).
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
