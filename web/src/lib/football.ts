import type { Match, Prediction } from "@/lib/data";

export type Outcome = "home" | "draw" | "away";
export type Result = "W" | "D" | "L";

export const hasResult = (m: Match) =>
  (m.status === "played" || m.status === "awarded") && m.homeGoals !== null && m.awayGoals !== null;

export function outcomeOf(m: Match): Outcome | null {
  if (!hasResult(m)) return null;
  const h = m.homeGoals!,
    a = m.awayGoals!;
  return h > a ? "home" : h === a ? "draw" : "away";
}

export function resultFor(m: Match, teamId: string): Result | null {
  const o = outcomeOf(m);
  if (!o) return null;
  if (o === "draw") return "D";
  return (o === "home") === (m.homeId === teamId) ? "W" : "L";
}

export function goalsFor(m: Match, teamId: string): [number, number] {
  return m.homeId === teamId ? [m.homeGoals!, m.awayGoals!] : [m.awayGoals!, m.homeGoals!];
}

/** The model's most likely outcome (never shown as "the pick" on match pages). */
export function likeliest(p: Pick<Prediction, "p_home" | "p_draw" | "p_away">): Outcome {
  const v = [Number(p.p_home), Number(p.p_draw), Number(p.p_away)];
  return (["home", "draw", "away"] as const)[v.indexOf(Math.max(...v))];
}

export const isUpcoming = (m: Match, now: number) =>
  (m.status === "scheduled" || m.status === "postponed") && Date.parse(m.kickoff) > now;

/** Kicked off but no result entered yet. */
export const isLocked = (m: Match, now: number) =>
  (m.status === "scheduled" || m.status === "postponed") && Date.parse(m.kickoff) <= now;

export type Record = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
};

export function record(matches: Match[], teamId: string): Record {
  const r: Record = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
  for (const m of matches) {
    const res = resultFor(m, teamId);
    if (!res) continue;
    const [f, a] = goalsFor(m, teamId);
    r.played++;
    r.gf += f;
    r.ga += a;
    if (res === "W") r.won++;
    else if (res === "D") r.drawn++;
    else r.lost++;
  }
  return r;
}

/** Last five results, oldest first (newest on the right). */
export function form(matches: Match[], teamId: string, n = 5): Result[] {
  return matches
    .filter((m) => (m.homeId === teamId || m.awayId === teamId) && hasResult(m))
    .slice(-n)
    .map((m) => resultFor(m, teamId)!);
}

/**
 * The matchday fans should see now: the first one whose usual date (its
 * median kick-off) is no more than a day ago. A single rescheduled match
 * doesn't hold an old matchday open.
 */
export function currentMatchday(matches: Match[], now: number): number | null {
  const byDay = new Map<number, number[]>();
  for (const m of matches) {
    if (m.matchday === null) continue;
    byDay.set(m.matchday, [...(byDay.get(m.matchday) ?? []), Date.parse(m.kickoff)]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  for (const d of days) {
    const times = byDay.get(d)!.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    if (median + 86_400_000 >= now) return d;
  }
  return days.at(-1) ?? null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
