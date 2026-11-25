import "server-only";

import { SITE_NAME, X_HANDLE } from "@/config/site";
import {
  getFrozenPredictions,
  getLatestPredictions,
  getLeagueTable,
  getSettings,
  type Match,
  type Prediction,
  type Team,
} from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { currentMatchday, hasResult, isUpcoming, likeliest, outcomeOf } from "@/lib/football";
import { pct } from "@/lib/format";

/*
 * Match of the Week: there is always something to share.
 *
 *   1. The Upset Alert match (fans see "One To Watch") with the highest
 *      away-win chance.
 *   2. No Upset Alert: the closest match (smallest home/away gap).
 *   3. No matches this week: "The Ballboy's week", the last matchday's
 *      record and the top two in the table.
 *   4. No data at all (pre-season): a plain "Beat the Ballboy" poster.
 *
 * The admin can choose a match instead of 1 or 2 (site_settings.motw_override).
 * Each week has its own key (md15, recap14, start), so share links and the
 * images X caches for them change every week.
 */

/** A matchday this far away counts as "no matches this week". */
const BREAK_AFTER_MS = 8 * 86_400_000;

export type MotwMatch = {
  kind: "match";
  key: string;
  md: number;
  /** "upset" and "closest" are labels on the poster; null when the admin chose a plain match. */
  label: "upset" | "closest" | null;
  chosenByAdmin: boolean;
  match: Match;
  home: Team;
  away: Team;
  p: Prediction;
};
export type MotwRecap = {
  kind: "recap";
  key: string;
  md: number;
  right: number;
  total: number;
  top: { team: Team; points: number; position: number }[];
};
export type MotwStart = { kind: "start"; key: "start" };
export type Motw = MotwMatch | MotwRecap | MotwStart;

type Data = Awaited<ReturnType<typeof load>>;

async function load() {
  const ctx = await getContext();
  const [latest, frozen, settings] = await Promise.all([
    getLatestPredictions(),
    getFrozenPredictions(),
    getSettings(),
  ]);
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  return { ctx, latest, frozen, settings, season };
}

/** This week's Match of the Week (or its fallback). */
export async function currentMotw(now: number): Promise<Motw> {
  const d = await load();
  const md = currentMatchday(d.season, now);
  if (md !== null) {
    const open = d.season.filter((m) => m.matchday === md && isUpcoming(m, now) && d.latest[m.id]);
    const first = Math.min(...open.map((m) => Date.parse(m.kickoff)));
    if (open.length && first - now < BREAK_AFTER_MS) {
      const pick = pickMatch(d, md, open, (m) => d.latest[m.id]);
      if (pick) return pick;
    }
  }
  return (await recap(d, lastPlayedMatchday(d))) ?? { kind: "start", key: "start" };
}

/** The Match of the Week behind a share link. Old links keep showing their own week. */
export async function motwForKey(key: string, now: number): Promise<Motw | null> {
  if (key === "start") return { kind: "start", key: "start" };
  const d = await load();
  const mdKey = /^md(\d{1,3})$/.exec(key);
  if (mdKey) {
    const md = Number(mdKey[1]);
    const current = await currentMotw(now);
    if (current.kind === "match" && current.md === md) return current;
    // A past week: its matches with the prediction frozen at kick-off.
    const ms = d.season.filter((m) => m.matchday === md);
    return pickMatch(d, md, ms, (m) => d.latest[m.id] ?? d.frozen[m.id]);
  }
  const recapKey = /^recap(\d{1,3})$/.exec(key);
  if (recapKey) return recap(d, Number(recapKey[1]));
  return null;
}

function pickMatch(
  d: Data,
  md: number,
  matches: Match[],
  predOf: (m: Match) => Prediction | undefined,
): MotwMatch | null {
  const withP = matches
    .map((m) => ({ m, p: predOf(m) }))
    .filter((x): x is { m: Match; p: Prediction } => !!x.p);
  if (!withP.length) return null;
  const build = (m: Match, p: Prediction, chosenByAdmin: boolean): MotwMatch => ({
    kind: "match",
    key: `md${md}`,
    md,
    label: p.upset_alert ? "upset" : chosenByAdmin ? null : "closest",
    chosenByAdmin,
    match: m,
    home: d.ctx.teams.get(m.homeId)!,
    away: d.ctx.teams.get(m.awayId)!,
    p,
  });

  const chosen = withP.find((x) => x.m.id === d.settings.motwOverride);
  if (chosen) return build(chosen.m, chosen.p, true);

  const upset = withP
    .filter((x) => x.p.upset_alert)
    .sort((a, b) => Number(b.p.p_away) - Number(a.p.p_away))[0];
  if (upset) return build(upset.m, upset.p, false);

  const closest = [...withP].sort(
    (a, b) =>
      Math.abs(Number(a.p.p_home) - Number(a.p.p_away)) -
        Math.abs(Number(b.p.p_home) - Number(b.p.p_away)) || a.m.kickoff.localeCompare(b.m.kickoff),
  )[0];
  return build(closest.m, closest.p, false);
}

function lastPlayedMatchday(d: Data): number | null {
  const days = d.season
    .filter((m) => m.matchday !== null && hasResult(m) && d.frozen[m.id])
    .map((m) => m.matchday!);
  return days.length ? Math.max(...days) : null;
}

async function recap(d: Data, md: number | null): Promise<MotwRecap | null> {
  if (md === null) return null;
  const scored = d.season.filter((m) => m.matchday === md && hasResult(m) && d.frozen[m.id]);
  if (!scored.length) return null;
  const right = scored.filter((m) => likeliest(d.frozen[m.id]) === outcomeOf(m)).length;
  const table = await getLeagueTable(d.ctx.current.id);
  return {
    kind: "recap",
    key: `recap${md}`,
    md,
    right,
    total: scored.length,
    top: table.slice(0, 2).map((r) => ({
      team: d.ctx.teams.get(r.teamId)!,
      points: r.points,
      position: r.position,
    })),
  };
}

/**
 * Text for the "Post on X" button. Plain English, no betting words.
 * Fans' version has no numbers: it invites people to play. The admin
 * version (`withRead`) hints at how the Ballboy reads the match: its
 * percentages and its main reason, for the owner's own posts.
 */
export function motwPostText(w: Motw, withRead = false): string {
  if (w.kind === "match") {
    const teams = `${w.home.name} v ${w.away.name}`;
    if (!withRead) {
      const tag = w.label === "upset" ? " One To Watch 🔥" : "";
      return `Match of the Week: ${teams}.${tag} Make your pick and see if you can beat the Ballboy.`;
    }
    const line =
      w.label === "upset"
        ? `The Ballboy gives ${w.away.name} a ${pct(w.p.p_away)} chance away from home.`
        : w.label === "closest"
          ? `Closest call of Matchday ${w.md}: ${pct(w.p.p_home)} home, ${pct(w.p.p_draw)} draw, ${pct(w.p.p_away)} away.`
          : `${pct(w.p.p_home)} home, ${pct(w.p.p_draw)} draw, ${pct(w.p.p_away)} away.`;
    const why = w.p.reasons[0] ? ` ${w.p.reasons[0]}.` : "";
    return `Match of the Week: ${teams}. ${line}${why} Can you beat the Ballboy?`;
  }
  if (w.kind === "recap")
    return `The Ballboy's week: ${w.right} of ${w.total} Matchday ${w.md} results called right. Can you do better?`;
  return `Beat the Ballboy: free NPFL predictions game on ${SITE_NAME}. No money involved, ever.`;
}

/** One click: X opens with the text and link filled in, and shows the link card. */
export function xIntentUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url, via: X_HANDLE.replace(/^@/, ""), hashtags: "NPFL" });
  return `https://x.com/intent/post?${q}`;
}
