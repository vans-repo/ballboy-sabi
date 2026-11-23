import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";

import { MyPicks } from "@/components/picks/my-picks";
import { PickAllSheet, type SheetItem } from "@/components/picks/pick-all-sheet";
import { PageTitle } from "@/components/section";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getLatestPredictions } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { currentMatchday, isUpcoming } from "@/lib/football";
import { formatDay, formatKickoffTime } from "@/lib/format";
import { renderTime } from "@/lib/time";

export const metadata: Metadata = { title: "Make your picks", robots: { index: false } };

export default function PickAllPage({ searchParams }: PageProps<"/pick-all">) {
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={<PageTitle>Make your picks</PageTitle>}>
        <FromSearch searchParams={searchParams as Promise<{ md?: string }>} />
      </Suspense>
      <Suspense>
        <MyPicks />
      </Suspense>
    </div>
  );
}

async function FromSearch({ searchParams }: { searchParams: Promise<{ md?: string }> }) {
  const { md } = await searchParams;
  return <Sheet md={md ? Number.parseInt(md, 10) : null} />;
}

async function Sheet({ md }: { md: number | null }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  const now = renderTime();
  const ctx = await getContext();
  const latest = await getLatestPredictions();
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const day = md ?? currentMatchday(season, now) ?? 1;
  const items: SheetItem[] = season
    .filter((m) => m.matchday === day && isUpcoming(m, now) && latest[m.id])
    .map((m) => {
      const p = latest[m.id];
      const h = ctx.teams.get(m.homeId)!;
      const a = ctx.teams.get(m.awayId)!;
      const team = (t: typeof h) => ({
        name: t.name,
        code: t.code,
        bg: t.primary_colour,
        fg: t.secondary_colour,
        crest: t.crest_url,
      });
      return {
        matchId: m.id,
        kickoff: m.kickoff,
        probs: { home: Number(p.p_home), draw: Number(p.p_draw), away: Number(p.p_away) },
        home: team(h),
        away: team(a),
        when: `${formatDay(m.kickoff)} · ${formatKickoffTime(m)}`,
        pcts: [
          Math.round(Number(p.p_home) * 100),
          Math.round(Number(p.p_draw) * 100),
          Math.round(Number(p.p_away) * 100),
        ],
      };
    });
  return (
    <>
      <PageTitle sub="Pick each match. You can change a pick until its kick-off.">
        Matchday {day} picks
      </PageTitle>
      <PickAllSheet items={items} md={day} />
    </>
  );
}
