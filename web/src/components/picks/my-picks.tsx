import { connection } from "next/server";

import { PicksHydrator } from "@/components/picks/hydrate";
import { getViewer } from "@/lib/auth/user";
import type { MyPick } from "@/lib/picks-store";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in fan's picks, streamed into a cached page. Render inside
 * <Suspense>. Guests get an empty store, so taps send them to log in.
 */
export async function MyPicks() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) return <PicksHydrator viewer={null} picks={{}} />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("picks")
    .select("match_id,outcome,pred_home_goals,pred_away_goals,points_if_correct,points_awarded")
    .eq("user_id", viewer.id);
  const picks: Record<string, MyPick> = {};
  for (const p of data ?? []) {
    picks[p.match_id] = {
      outcome: p.outcome,
      homeGoals: p.pred_home_goals,
      awayGoals: p.pred_away_goals,
      pointsIfCorrect: p.points_if_correct,
      pointsAwarded: p.points_awarded,
    };
  }
  return (
    <PicksHydrator
      viewer={{ id: viewer.id, displayName: viewer.displayName, banned: viewer.banned }}
      picks={picks}
    />
  );
}
