import "server-only";

import {
  getAllMatches,
  getSeasons,
  getTeams,
  type Match,
  type Season,
  type Team,
} from "@/lib/data";

export type Context = {
  seasons: Season[];
  current: Season;
  teams: Map<string, Team>;
  bySlug: Map<string, Team>;
  matches: Match[];
  seasonLabel: (id: string) => string;
};

/** Seasons, teams and every match: the base most pages build on. */
export async function getContext(): Promise<Context> {
  const [seasons, teamList, matches] = await Promise.all([
    getSeasons(),
    getTeams(),
    getAllMatches(),
  ]);
  const current = seasons.find((s) => s.is_current) ?? seasons[seasons.length - 1];
  const labels = new Map(seasons.map((s) => [s.id, s.label]));
  return {
    seasons,
    current,
    teams: new Map(teamList.map((t) => [t.id, t])),
    bySlug: new Map(teamList.map((t) => [t.slug, t])),
    matches,
    seasonLabel: (id) => labels.get(id) ?? "",
  };
}
