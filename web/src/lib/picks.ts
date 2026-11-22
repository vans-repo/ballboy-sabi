import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type Outcome = "home" | "draw" | "away";
export const OUTCOMES: readonly Outcome[] = ["home", "draw", "away"];

export type PickInput = {
  matchId: string;
  outcome: Outcome;
  homeGoals?: number | null;
  awayGoals?: number | null;
};

/** Checks a pick before it reaches the database (which checks again). Returns an error message or null. */
export function validatePick(p: PickInput): string | null {
  if (!OUTCOMES.includes(p.outcome)) return "Choose Home, Draw or Away.";
  const h = p.homeGoals ?? null;
  const a = p.awayGoals ?? null;
  if ((h === null) !== (a === null)) return "Enter both scores, or neither.";
  if (h === null || a === null) return null;
  if (![h, a].every((g) => Number.isInteger(g) && g >= 0 && g <= 20))
    return "Scores must be whole numbers from 0 to 20.";
  const agrees = p.outcome === "home" ? h > a : p.outcome === "draw" ? h === a : h < a;
  return agrees ? null : "Your score doesn't match your pick.";
}

/**
 * Insert or change the signed-in fan's pick. RLS decides whether the
 * window is still open. Insert and update are separate because fans may
 * update only the outcome and score columns.
 */
export async function savePickAs(
  supabase: SupabaseClient<Database>,
  userId: string,
  p: PickInput,
): Promise<string | null> {
  const invalid = validatePick(p);
  if (invalid) return invalid;
  const values = {
    outcome: p.outcome,
    pred_home_goals: p.homeGoals ?? null,
    pred_away_goals: p.awayGoals ?? null,
  };
  const { data: existing } = await supabase
    .from("picks")
    .select("id")
    .eq("user_id", userId)
    .eq("match_id", p.matchId)
    .maybeSingle();
  const { error, count } = existing
    ? await supabase.from("picks").update(values, { count: "exact" }).eq("id", existing.id)
    : await supabase
        .from("picks")
        .insert({ user_id: userId, match_id: p.matchId, ...values }, { count: "exact" });
  if (error || count === 0) return "Picks for this match are closed.";
  return null;
}

/** "matchId:outcome" from a login link, as left by a guest's tap. */
export function parsePendingPick(value: unknown): PickInput | null {
  if (typeof value !== "string") return null;
  const [matchId, outcome] = value.split(":");
  if (!/^[0-9a-f-]{36}$/.test(matchId ?? "") || !OUTCOMES.includes(outcome as Outcome)) return null;
  return { matchId, outcome: outcome as Outcome };
}
