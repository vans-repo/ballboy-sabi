import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { MatchCard } from "@/components/match-card";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { TeamBadge } from "@/components/team-badge";
import { Button } from "@/components/ui/button";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getFrozenPredictions, getLatestPredictions } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { renderTime } from "@/lib/time";
import { hasResult, isUpcoming, record } from "@/lib/football";

export const metadata: Metadata = {
  title: "Head-to-Head",
  description:
    "Pick two NPFL teams to see every meeting since 2021/22, home and away records and average goals.",
};

type Search = { a?: string; b?: string };

export default function H2HPage({ searchParams }: PageProps<"/h2h">) {
  return (
    <Suspense fallback={<PageTitle>Head-to-Head</PageTitle>}>
      <H2HFromSearch searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function H2HFromSearch({ searchParams }: { searchParams: Promise<Search> }) {
  const { a, b } = await searchParams;
  return <HeadToHead a={a ?? null} b={b ?? null} />;
}

async function HeadToHead({ a, b }: { a: string | null; b: string | null }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  const now = renderTime();
  const ctx = await getContext();
  const teams = [...ctx.teams.values()].filter((t) =>
    ctx.matches.some((m) => m.homeId === t.id || m.awayId === t.id),
  );
  const ta = a ? ctx.bySlug.get(a) : undefined;
  const tb = b ? ctx.bySlug.get(b) : undefined;

  const picker = (
    <form
      action="/h2h"
      className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      {(["a", "b"] as const).map((key, i) => (
        <label key={key} className="grid gap-1 text-sm">
          {i === 0 ? "First team" : "Second team"}
          <select
            name={key}
            defaultValue={(i === 0 ? ta : tb)?.slug ?? ""}
            required
            className="h-11 rounded-lg border bg-surface px-3 text-base"
          >
            <option value="" disabled>
              Choose a team
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <Button type="submit">Compare</Button>
    </form>
  );

  if (!ta || !tb || ta.id === tb.id) {
    return (
      <>
        <PageTitle sub="Every league meeting since 2021/22.">Head-to-Head</PageTitle>
        {picker}
        {ta && tb && <Empty>Choose two different teams.</Empty>}
      </>
    );
  }

  const [latest, frozen] = await Promise.all([getLatestPredictions(), getFrozenPredictions()]);
  const between = ctx.matches.filter(
    (m) => (m.homeId === ta.id && m.awayId === tb.id) || (m.homeId === tb.id && m.awayId === ta.id),
  );
  const meetings = between.filter(hasResult);
  const upcoming = between.find((m) => isUpcoming(m, now));
  const overall = record(meetings, ta.id);
  const aHome = record(
    meetings.filter((m) => m.homeId === ta.id),
    ta.id,
  );
  const bHome = record(
    meetings.filter((m) => m.homeId === tb.id),
    tb.id,
  );
  const goals = meetings.reduce((s, m) => s + m.homeGoals! + m.awayGoals!, 0);

  return (
    <>
      <PageTitle sub="Every league meeting since 2021/22.">
        {ta.name} v {tb.name}
      </PageTitle>
      {picker}

      {upcoming && (
        <Section title="Next meeting">
          <MatchCard
            match={upcoming}
            home={ctx.teams.get(upcoming.homeId)!}
            away={ctx.teams.get(upcoming.awayId)!}
            latest={latest[upcoming.id]}
            now={now}
          />
        </Section>
      )}

      {meetings.length === 0 ? (
        <Empty>These teams have not met since 2021/22.</Empty>
      ) : (
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <Section title="Overall">
              <Card>
                <div className="grid grid-cols-3 text-center">
                  <Stat label={`${ta.name} wins`} value={overall.won} team={ta} />
                  <Stat label="Draws" value={overall.drawn} />
                  <Stat label={`${tb.name} wins`} value={overall.lost} team={tb} />
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {meetings.length} meetings · {(goals / meetings.length).toFixed(1)} goals a game
                  on average
                </p>
              </Card>
            </Section>
            <Section title="Home and away">
              <Card className="grid gap-3 text-sm">
                <p>
                  <span className="font-medium">{ta.name} at home:</span> won {aHome.won}, drew{" "}
                  {aHome.drawn}, lost {aHome.lost} (goals {aHome.gf}–{aHome.ga})
                </p>
                <p>
                  <span className="font-medium">{tb.name} at home:</span> won {bHome.won}, drew{" "}
                  {bHome.drawn}, lost {bHome.lost} (goals {bHome.gf}–{bHome.ga})
                </p>
              </Card>
            </Section>
          </div>
          <Section title="Every meeting">
            <ul className="grid gap-2">
              {[...meetings].reverse().map((m) => (
                <li key={m.id}>
                  <MatchCard
                    match={m}
                    home={ctx.teams.get(m.homeId)!}
                    away={ctx.teams.get(m.awayId)!}
                    frozen={frozen[m.id]}
                    now={now}
                  />
                  {m.kickoffEstimated && (
                    <p className="mt-1 px-1 text-xs text-muted-foreground">
                      {ctx.seasonLabel(m.seasonId)} season (date not recorded)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link href={`/team/${ta.slug}`} className="text-primary underline underline-offset-2">
          {ta.name}
        </Link>
        {" · "}
        <Link href={`/team/${tb.slug}`} className="text-primary underline underline-offset-2">
          {tb.name}
        </Link>
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  team,
}: {
  label: string;
  value: number;
  team?: Parameters<typeof TeamBadge>[0]["team"];
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {team && <TeamBadge team={team} size="sm" />}
      <span className="figure text-4xl">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
