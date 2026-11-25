import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { MatchCard } from "@/components/match-card";
import { MyPicks } from "@/components/picks/my-picks";
import { Empty, PageTitle } from "@/components/section";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getFrozenPredictions, getLatestPredictions, getLeagueTable } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { renderTime } from "@/lib/time";
import { currentMatchday } from "@/lib/football";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "NPFL Fixtures and Results",
  description:
    "Every NPFL fixture and result this season, one matchday at a time, with Home, Draw and Away percentages.",
  alternates: { canonical: "/fixtures" },
};

type Search = { md?: string; team?: string };

export default function FixturesPage({ searchParams }: PageProps<"/fixtures">) {
  return (
    <>
      <Suspense fallback={<PageTitle>Fixtures & Results</PageTitle>}>
        <FixturesFromSearch searchParams={searchParams as Promise<Search>} />
      </Suspense>
      <Suspense>
        <MyPicks />
      </Suspense>
    </>
  );
}

async function FixturesFromSearch({ searchParams }: { searchParams: Promise<Search> }) {
  const { md, team } = await searchParams;
  return <Fixtures md={md ? Number.parseInt(md, 10) : null} team={team ?? null} />;
}

function href(md: number, team: string | null) {
  return team ? `/fixtures?md=${md}&team=${team}` : `/fixtures?md=${md}`;
}

async function Fixtures({ md, team }: { md: number | null; team: string | null }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  const now = renderTime();
  const ctx = await getContext();
  const [latest, frozen, table] = await Promise.all([
    getLatestPredictions(),
    getFrozenPredictions(),
    getLeagueTable(ctx.current.id),
  ]);
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const days = [
    ...new Set(season.map((m) => m.matchday).filter((d): d is number => d !== null)),
  ].sort((a, b) => a - b);
  const current = currentMatchday(season, now);
  const shown = md !== null && days.includes(md) ? md : current;
  const teamFilter = team ? ctx.bySlug.get(team) : undefined;
  const list = season.filter(
    (m) =>
      m.matchday === shown &&
      (!teamFilter || m.homeId === teamFilter.id || m.awayId === teamFilter.id),
  );
  const i = shown === null ? -1 : days.indexOf(shown);
  const prev = i > 0 ? days[i - 1] : null;
  const next = i >= 0 && i < days.length - 1 ? days[i + 1] : null;
  const teams = [...ctx.teams.values()].filter((t) =>
    season.some((m) => m.homeId === t.id || m.awayId === t.id),
  );

  return (
    <>
      <PageTitle sub={`${ctx.current.label} season. Times are West Africa Time.`}>
        Fixtures & Results
      </PageTitle>

      {shown === null ? (
        <Empty>No fixtures for this season yet.</Empty>
      ) : (
        <>
          <nav aria-label="Matchdays" className="mb-4 flex items-center justify-between gap-2">
            <PagerLink
              to={prev === null ? null : href(prev, team)}
              label="Previous matchday"
              text="‹"
            />
            <details className="relative">
              <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-1 rounded-lg bg-surface px-4 font-heading text-xl font-bold uppercase [&::-webkit-details-marker]:hidden">
                Matchday {shown} <span aria-hidden="true">▾</span>
                {shown === current && <span className="sr-only">(current)</span>}
              </summary>
              <ul className="absolute left-1/2 z-10 mt-1 grid max-h-80 w-64 -translate-x-1/2 grid-cols-4 gap-1 overflow-y-auto rounded-xl border bg-surface p-2 shadow-lg">
                {days.map((d) => (
                  <li key={d}>
                    <Link
                      href={href(d, team)}
                      aria-current={d === shown ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-lg text-sm hover:bg-muted",
                        d === shown &&
                          "bg-primary text-primary-foreground hover:bg-primary-pressed",
                        d === current && d !== shown && "ring-1 ring-ink",
                      )}
                    >
                      {d}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
            <PagerLink
              to={next === null ? null : href(next, team)}
              label="Next matchday"
              text="›"
            />
          </nav>

          <details className="mb-4">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-ink">
              {teamFilter ? `Showing ${teamFilter.name} only` : "Filter by team"}
            </summary>
            <ul className="mt-2 flex flex-wrap gap-2">
              {teamFilter && (
                <li>
                  <Link
                    href={`/fixtures?md=${shown}`}
                    className="inline-flex h-11 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
                  >
                    All teams
                  </Link>
                </li>
              )}
              {teams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={href(shown, t.slug)}
                    className={cn(
                      "inline-flex h-11 items-center rounded-lg bg-surface px-3 text-sm hover:bg-muted",
                      t.slug === team && "ring-1 ring-ink",
                    )}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          {list.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((m) => (
                <li key={m.id}>
                  <MatchCard
                    seasonLabel={ctx.current.label}
                    match={m}
                    home={ctx.teams.get(m.homeId)!}
                    away={ctx.teams.get(m.awayId)!}
                    latest={latest[m.id]}
                    frozen={frozen[m.id]}
                    now={now}
                    pickable
                    table={table}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {teamFilter
                ? `${teamFilter.name} have no match this matchday.`
                : "No matches this matchday yet."}
            </Empty>
          )}
        </>
      )}
    </>
  );
}

function PagerLink({ to, label, text }: { to: string | null; label: string; text: string }) {
  const cls = "inline-flex size-11 items-center justify-center rounded-lg bg-surface text-2xl";
  return to ? (
    <Link href={to} aria-label={label} className={cn(cls, "hover:bg-muted")}>
      {text}
    </Link>
  ) : (
    <span aria-hidden="true" className={cn(cls, "opacity-30")}>
      {text}
    </span>
  );
}
