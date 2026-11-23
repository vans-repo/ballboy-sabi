import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FormDots } from "@/components/form-dots";
import { MatchCard } from "@/components/match-card";
import { Card, Empty, Section } from "@/components/section";
import { TeamBadge } from "@/components/team-badge";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getFrozenPredictions, getLatestPredictions, getLeagueTable, type Match } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { renderTime } from "@/lib/time";
import {
  form,
  goalsFor,
  hasResult,
  isUpcoming,
  record,
  resultFor,
  type Record,
} from "@/lib/football";
import { formatShortDate, ordinal } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/team/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return teamMeta(slug);
}

async function teamMeta(slug: string): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const team = (await getContext()).bySlug.get(slug);
  return team
    ? {
        title: team.name,
        description: `${team.name}: rating, form, results and records in the NPFL since 2021/22.`,
      }
    : { title: "Team" };
}

export default function TeamPage({ params }: PageProps<"/team/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading team…</p>}>
      <TeamFromParams params={params} />
    </Suspense>
  );
}

async function TeamFromParams({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamProfile slug={slug} />;
}

function recordLine(r: Record) {
  return `P${r.played} W${r.won} D${r.drawn} L${r.lost} · ${r.gf}–${r.ga}`;
}

async function TeamProfile({ slug }: { slug: string }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions, CACHE_TAGS.teamRatings);
  const now = renderTime();
  const ctx = await getContext();
  const team = ctx.bySlug.get(slug);
  if (!team) notFound();

  const [latest, frozen, table] = await Promise.all([
    getLatestPredictions(),
    getFrozenPredictions(),
    getLeagueTable(ctx.current.id),
  ]);
  const mine = ctx.matches.filter((m) => m.homeId === team.id || m.awayId === team.id);
  const played = mine.filter(hasResult);
  const thisSeason = mine.filter((m) => m.seasonId === ctx.current.id);
  const seasonPlayed = thisSeason.filter(hasResult);
  const next = thisSeason.find((m) => isUpcoming(m, now));
  const row = table.find((r) => r.teamId === team.id);

  // Past seasons: finish and points.
  const pastSeasons = ctx.seasons.filter(
    (s) => s.id !== ctx.current.id && mine.some((m) => m.seasonId === s.id),
  );
  const finishes = await Promise.all(
    pastSeasons.map(async (s) => {
      const r = (await getLeagueTable(s.id)).find((x) => x.teamId === team.id);
      return { season: s.label, position: r?.position, points: r?.points, group: r?.group };
    }),
  );

  const records = teamRecords(played, team.id);
  const describe = (m: Match) =>
    `${ctx.teams.get(m.homeId)!.name} ${m.homeGoals}–${m.awayGoals} ${ctx.teams.get(m.awayId)!.name}, ${
      m.kickoffEstimated ? ctx.seasonLabel(m.seasonId) : formatShortDate(m.kickoff)
    }`;

  return (
    <>
      <header className="mb-6 flex items-center gap-4">
        <TeamBadge team={team} size="lg" />
        <div>
          <h1 className="text-3xl uppercase">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[team.city, row ? `${ordinal(row.position)} in the table` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Section title={`This season (${ctx.current.label})`}>
            {seasonPlayed.length ? (
              <Card className="grid gap-2 text-sm">
                {row && (
                  <p>
                    <span className="figure text-2xl">{ordinal(row.position)}</span> in the table,{" "}
                    {row.points} points
                  </p>
                )}
                <p className="flex items-center justify-between gap-2">
                  Form <FormDots results={form(seasonPlayed, team.id)} />
                </p>
                <p className="flex justify-between gap-2">
                  <span>Home</span>
                  <span>
                    {recordLine(
                      record(
                        seasonPlayed.filter((m) => m.homeId === team.id),
                        team.id,
                      ),
                    )}
                  </span>
                </p>
                <p className="flex justify-between gap-2">
                  <span>Away</span>
                  <span>
                    {recordLine(
                      record(
                        seasonPlayed.filter((m) => m.awayId === team.id),
                        team.id,
                      ),
                    )}
                  </span>
                </p>
              </Card>
            ) : (
              <Empty>No games played this season yet.</Empty>
            )}
          </Section>

          <Section title="Next match">
            {next ? (
              <MatchCard
                match={next}
                home={ctx.teams.get(next.homeId)!}
                away={ctx.teams.get(next.awayId)!}
                latest={latest[next.id]}
                now={now}
              />
            ) : (
              <Empty>No upcoming match.</Empty>
            )}
          </Section>

          <Section title="Records since 2021/22">
            <Card className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Biggest win: </span>
                {records.bestWin ? describe(records.bestWin) : "None yet"}
              </p>
              <p>
                <span className="text-muted-foreground">Biggest loss: </span>
                {records.worstLoss ? describe(records.worstLoss) : "None yet"}
              </p>
              <p>
                <span className="text-muted-foreground">Longest home unbeaten run: </span>
                {records.homeRun} {records.homeRun === 1 ? "game" : "games"}
              </p>
            </Card>
          </Section>
        </div>

        <div>
          <Section title="Results this season">
            {seasonPlayed.length ? (
              <ul className="grid gap-2">
                {[...thisSeason]
                  .filter((m) => hasResult(m) || m.status === "abandoned")
                  .reverse()
                  .map((m) => (
                    <li key={m.id}>
                      <MatchCard
                        match={m}
                        home={ctx.teams.get(m.homeId)!}
                        away={ctx.teams.get(m.awayId)!}
                        frozen={frozen[m.id]}
                        now={now}
                      />
                    </li>
                  ))}
              </ul>
            ) : (
              <Empty>No results this season yet.</Empty>
            )}
          </Section>

          <Section title="Past seasons">
            {finishes.length ? (
              <ul className="overflow-hidden rounded-xl bg-surface text-sm">
                {finishes.reverse().map((f) => (
                  <li key={f.season} className="border-b last:border-0">
                    <Link
                      href={`/table?season=${f.season.replace("/", "-")}`}
                      className="flex min-h-11 items-center justify-between px-4 hover:bg-muted"
                    >
                      <span>{f.season}</span>
                      <span>
                        {f.position
                          ? `${ordinal(f.position)}${f.group ? ` in ${f.group}` : ""}`
                          : "–"}{" "}
                        · {f.points ?? 0} pts
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No earlier seasons since 2021/22.</Empty>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function teamRecords(played: Match[], teamId: string) {
  let bestWin: Match | undefined;
  let worstLoss: Match | undefined;
  const margin = (m: Match) => {
    const [f, a] = goalsFor(m, teamId);
    return [f - a, f] as const;
  };
  for (const m of played) {
    const [d, f] = margin(m);
    if (
      d > 0 &&
      (!bestWin || d > margin(bestWin)[0] || (d === margin(bestWin)[0] && f >= margin(bestWin)[1]))
    )
      bestWin = m;
    if (
      d < 0 &&
      (!worstLoss ||
        d < margin(worstLoss)[0] ||
        (d === margin(worstLoss)[0] && f <= margin(worstLoss)[1]))
    )
      worstLoss = m;
  }
  let homeRun = 0;
  let run = 0;
  for (const m of played.filter((x) => x.homeId === teamId)) {
    run = resultFor(m, teamId) === "L" ? 0 : run + 1;
    homeRun = Math.max(homeRun, run);
  }
  return { bestWin, worstLoss, homeRun };
}
