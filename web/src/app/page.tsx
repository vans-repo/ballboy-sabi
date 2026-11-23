import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { Countdown } from "@/components/countdown";
import { LeagueTable } from "@/components/league-table";
import { AdirePattern } from "@/components/adire";
import { MatchCard } from "@/components/match-card";
import { MotwCard } from "@/components/motw-card";
import { MyPicks } from "@/components/picks/my-picks";
import { MyPoints, PickProgress } from "@/components/picks/progress";
import { Empty, Section } from "@/components/section";
import { TeamBadge } from "@/components/team-badge";
import { SUBSTACK_URL } from "@/config/site";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  getFrozenPredictions,
  getLatestPredictions,
  getLeaderboard,
  getLeagueTable,
  getWalkForward,
} from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { getLatestPosts } from "@/lib/substack";
import { renderTime } from "@/lib/time";
import { currentMatchday, isUpcoming } from "@/lib/football";
import { formatDay, formatShortDate, formatTime, pct } from "@/lib/format";
import { currentMotw } from "@/lib/motw";

export default function HomePage() {
  return (
    <>
      <HomeContent />
      <Suspense>
        <MyPicks />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions, CACHE_TAGS.settings);
  const now = renderTime();

  const ctx = await getContext();
  const [motw, latest, frozen, table, walk, posts] = await Promise.all([
    currentMotw(now),
    getLatestPredictions(),
    getFrozenPredictions(),
    getLeagueTable(ctx.current.id),
    getWalkForward(),
    getLatestPosts(3),
  ]);
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const md = currentMatchday(season, now);
  const fixtures = season.filter((m) => m.matchday === md);
  const nextKickoff = fixtures
    .filter((m) => isUpcoming(m, now))
    .map((m) => m.kickoff)
    .sort()[0];
  const motwId = motw.kind === "match" ? motw.match.id : null;
  const upsets = fixtures
    .filter((m) => m.id !== motwId && isUpcoming(m, now) && latest[m.id]?.upset_alert)
    .sort((a, b) => Number(latest[b.id].p_away) - Number(latest[a.id].p_away))
    .slice(0, 2);
  const mini = [...table.slice(0, 5), ...table.slice(-3)];
  const open = fixtures.filter((m) => isUpcoming(m, now) && latest[m.id]).map((m) => m.id);

  // Beat the Ballboy: the latest matchday with scored picks.
  const pastDays = [
    ...new Set(
      season
        .filter((m) => m.matchday !== null && m.matchdayId && Date.parse(m.kickoff) < now)
        .map((m) => m.matchday!),
    ),
  ].sort((a, b) => b - a);
  let strip: {
    md: number;
    ids: string[];
    ballboy: number;
    average: number;
    top: { name: string; points: number } | null;
  } | null = null;
  for (const d of pastDays.slice(0, 3)) {
    const dayMatches = season.filter((m) => m.matchday === d);
    const rows = await getLeaderboard("matchday", dayMatches[0].matchdayId!);
    const fans = rows.filter((r) => !r.isBallboy);
    if (!fans.length) continue;
    strip = {
      md: d,
      ids: dayMatches.map((m) => m.id),
      ballboy: rows.find((r) => r.isBallboy)?.points ?? 0,
      average: fans.reduce((a, r) => a + r.points, 0) / fans.length,
      top: { name: fans[0].name, points: fans[0].points },
    };
    break;
  }

  return (
    <>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {md !== null && (
          <section
            aria-labelledby="matchday"
            className="relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground"
          >
            <AdirePattern className="opacity-15" />
            <p className="relative text-xs font-bold tracking-widest uppercase">
              NPFL {ctx.current.label}
            </p>
            <h1
              id="matchday"
              className="relative font-heading text-6xl leading-[0.88] font-extrabold uppercase md:text-7xl"
            >
              Matchday {md}
            </h1>
            <p className="relative text-sm font-semibold">
              {nextKickoff ? (
                <>
                  {fixtures.length} matches · first kick-off {formatDay(nextKickoff)},{" "}
                  {formatTime(nextKickoff)} WAT
                  <br />
                  <Countdown to={nextKickoff} prefix="Next picks lock in" />
                </>
              ) : (
                "Picks locked"
              )}
              <PickProgress matchIds={open} />
            </p>
            <Link
              href={`/pick-all?md=${md}`}
              className="relative inline-flex h-12 items-center self-start rounded-xl bg-primary-foreground px-6 font-bold text-primary hover:opacity-90"
            >
              Make your picks
            </Link>
          </section>
        )}
        <MotwCard w={motw} />
      </div>

      <div className="grid gap-x-8 md:grid-cols-[3fr_2fr]">
        <div>
          <Section
            title={md ? `Matchday ${md} fixtures` : "Fixtures"}
            more={{ href: "/fixtures", label: "All fixtures" }}
          >
            {fixtures.length ? (
              <ul className="grid gap-3">
                {fixtures.map((m) => (
                  <li key={m.id}>
                    <MatchCard
                      match={m}
                      home={ctx.teams.get(m.homeId)!}
                      away={ctx.teams.get(m.awayId)!}
                      latest={latest[m.id]}
                      frozen={frozen[m.id]}
                      now={now}
                      pickable
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No matches this matchday yet.</Empty>
            )}
          </Section>
        </div>

        <div>
          <Section title={motwId ? "More Upset Alerts" : "Upset Alert"}>
            {upsets.length ? (
              <ul className="grid gap-3">
                {upsets.map((m) => {
                  const home = ctx.teams.get(m.homeId)!;
                  const away = ctx.teams.get(m.awayId)!;
                  const p = latest[m.id];
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/match/${m.id}`}
                        className="block rounded-xl border border-away/50 bg-surface p-4 hover:border-away"
                      >
                        <p className="flex items-center gap-2 font-medium">
                          <TeamBadge team={away} size="sm" />
                          {away.name} at {home.name}
                        </p>
                        <p className="mt-2">
                          <span className="figure text-3xl text-away">{pct(p.p_away)}</span>{" "}
                          <span className="text-sm text-muted-foreground">
                            chance of an away win
                          </span>
                        </p>
                        {p.reasons[0] && (
                          <p className="mt-1 text-sm text-muted-foreground">{p.reasons[0]}</p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>
                {motwId ? "No other Upset Alerts this matchday." : "No Upset Alerts this matchday."}
              </Empty>
            )}
          </Section>

          <Section title="Beat the Ballboy">
            {strip ? (
              <Link
                href="/leaderboard?tab=matchday"
                className="block rounded-xl bg-surface p-4 hover:bg-muted"
              >
                <p className="mb-3 text-xs text-muted-foreground">Matchday {strip.md} points</p>
                <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-muted-foreground">The Ballboy</dt>
                    <dd className="figure text-2xl text-primary">{strip.ballboy}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Average fan</dt>
                    <dd className="figure text-2xl">{strip.average.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Top fan</dt>
                    <dd className="figure text-2xl">{strip.top?.points}</dd>
                    <dd className="truncate text-muted-foreground">{strip.top?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">You</dt>
                    <dd>
                      <MyPoints matchIds={strip.ids} />
                    </dd>
                  </div>
                </dl>
              </Link>
            ) : (
              <Empty>
                Pick before kick-off and score more for the results the model thought unlikely.
                Scores appear here after the first matchday with fan picks.
              </Empty>
            )}
          </Section>

          <Section title="Table" more={{ href: "/table", label: "Full table" }}>
            {table.length ? (
              <LeagueTable
                rows={mini}
                teams={ctx.teams}
                size={table.length}
                compact
                caption={`${ctx.current.label} table, top five and bottom three`}
              />
            ) : (
              <Empty>The table fills in after the first result.</Empty>
            )}
          </Section>

          {posts.length > 0 && (
            <Section title="From the Substack" more={{ href: SUBSTACK_URL, label: "All articles" }}>
              <ul className="grid gap-2">
                {posts.map((p) => (
                  <li key={p.url}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener"
                      className="block rounded-xl bg-surface p-4 hover:bg-muted"
                    >
                      <span className="block font-medium">{p.title}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{p.excerpt}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatShortDate(p.date)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {walk && (
            <p className="mb-8 text-sm text-muted-foreground">
              Tested on {walk.matches} past matches, our percentages scored{" "}
              {walk.blend.brier.toFixed(2)} against{" "}
              {(2 * (1 - walk.always_home_accuracy)).toFixed(2)} for always picking home (lower is
              better).{" "}
              <Link href="/accuracy" className="text-primary underline underline-offset-2">
                See how accurate we are
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
