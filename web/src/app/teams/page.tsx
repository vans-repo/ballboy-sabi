import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { Empty, PageTitle } from "@/components/section";
import { TeamLink } from "@/components/team-badge";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getContext } from "@/lib/data/context";

export const metadata: Metadata = {
  title: "Teams",
  description: "Every NPFL team since 2021/22, with ratings, form and records.",
};

export default async function TeamsPage() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const ctx = await getContext();
  const inSeason = (seasonId: string) =>
    new Set(
      ctx.matches.filter((m) => m.seasonId === seasonId).flatMap((m) => [m.homeId, m.awayId]),
    );
  const current = inSeason(ctx.current.id);
  const all = new Set(ctx.matches.flatMap((m) => [m.homeId, m.awayId]));
  const teams = [...ctx.teams.values()];
  const now = teams.filter((t) => current.has(t.id));
  const before = teams.filter((t) => !current.has(t.id) && all.has(t.id));

  return (
    <>
      <PageTitle>Teams</PageTitle>
      <h2 className="mb-3 text-xl uppercase">{ctx.current.label}</h2>
      {now.length ? <TeamGrid teams={now} /> : <Empty>No teams for this season yet.</Empty>}
      {before.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xl uppercase">Earlier seasons</h2>
          <TeamGrid teams={before} />
        </>
      )}
    </>
  );
}

function TeamGrid({ teams }: { teams: Parameters<typeof TeamLink>[0]["team"][] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
      {teams.map((t) => (
        <li key={t.id} className="rounded-xl bg-surface px-3">
          <TeamLink team={t} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
