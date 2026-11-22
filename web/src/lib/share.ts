import "server-only";

import { getLeaderboard, type LeaderRow } from "@/lib/data";
import { getContext } from "@/lib/data/context";

export type MatchdayCard = {
  name: string;
  md: number;
  season: string;
  me: LeaderRow;
  ballboy: LeaderRow | undefined;
  fans: number;
};

/** A fan's result for one matchday of the current season, or null. Public data only. */
export async function matchdayCard(userId: string, md: number): Promise<MatchdayCard | null> {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !Number.isInteger(md)) return null;
  const ctx = await getContext();
  const m = ctx.matches.find(
    (x) => x.seasonId === ctx.current.id && x.matchday === md && x.matchdayId,
  );
  if (!m) return null;
  const rows = await getLeaderboard("matchday", m.matchdayId);
  const me = rows.find((r) => r.userId === userId && !r.isBallboy);
  if (!me) return null;
  return {
    name: me.name,
    md,
    season: ctx.current.label,
    me,
    ballboy: rows.find((r) => r.isBallboy),
    fans: rows.filter((r) => !r.isBallboy).length,
  };
}
