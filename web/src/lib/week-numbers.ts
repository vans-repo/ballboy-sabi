import "server-only";

import { getFrozenPredictions, type Match, type Team } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { hasResult, likeliest, outcomeOf } from "@/lib/football";

/*
 * "This week in numbers" on Home: facts from the last matchday with results,
 * worked out from the site's own data (results entered in admin and the
 * predictions frozen at kick-off). Nothing is fetched from elsewhere.
 */

export type WeekNumbers = {
  md: number;
  played: number;
  goals: number;
  ballboy: { right: number; total: number } | null;
  biggestWin: { match: Match; home: Team; away: Team; margin: number } | null;
  upset: { match: Match; home: Team; away: Team; chance: number } | null;
  unbeaten: { team: Team; games: number } | null;
};

export async function weekNumbers(): Promise<WeekNumbers | null> {
  const ctx = await getContext();
  const frozen = await getFrozenPredictions();
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const played = season.filter(hasResult);
  const days = played.map((m) => m.matchday).filter((d): d is number => d !== null);
  if (!days.length) return null;
  const md = Math.max(...days);
  const week = played.filter((m) => m.matchday === md);
  const team = (id: string) => ctx.teams.get(id)!;

  const goals = week.reduce((s, m) => s + m.homeGoals! + m.awayGoals!, 0);

  const scored = week.filter((m) => frozen[m.id]);
  const ballboy = scored.length
    ? {
        right: scored.filter((m) => likeliest(frozen[m.id]) === outcomeOf(m)).length,
        total: scored.length,
      }
    : null;

  const margin = (m: Match) => Math.abs(m.homeGoals! - m.awayGoals!);
  const big = [...week].sort(
    (a, b) => margin(b) - margin(a) || b.homeGoals! + b.awayGoals! - (a.homeGoals! + a.awayGoals!),
  )[0];
  const biggestWin =
    big && margin(big) > 0
      ? { match: big, home: team(big.homeId), away: team(big.awayId), margin: margin(big) }
      : null;

  // The result the Ballboy gave the lowest chance, if it was under a third.
  const chanceOf = (m: Match) => {
    const p = frozen[m.id];
    const o = outcomeOf(m);
    return Number(o === "home" ? p.p_home : o === "draw" ? p.p_draw : p.p_away);
  };
  const shock = [...scored].sort((a, b) => chanceOf(a) - chanceOf(b))[0];
  const upset =
    shock && chanceOf(shock) < 1 / 3
      ? {
          match: shock,
          home: team(shock.homeId),
          away: team(shock.awayId),
          chance: chanceOf(shock),
        }
      : null;

  // Longest current unbeaten run this season (league games only, newest backwards).
  const ordered = [...played].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  let unbeaten: WeekNumbers["unbeaten"] = null;
  for (const id of new Set(season.flatMap((m) => [m.homeId, m.awayId]))) {
    const mine = ordered.filter((m) => m.homeId === id || m.awayId === id).reverse();
    let run = 0;
    for (const m of mine) {
      const lost = m.homeId === id ? m.homeGoals! < m.awayGoals! : m.awayGoals! < m.homeGoals!;
      if (lost) break;
      run++;
    }
    if (run >= 3 && (!unbeaten || run > unbeaten.games)) unbeaten = { team: team(id), games: run };
  }

  return { md, played: week.length, goals, ballboy, biggestWin, upset, unbeaten };
}
