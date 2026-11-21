"use client";

import { usePicks } from "@/lib/picks-store";

/** "8/10 picked" for the signed-in fan. Nothing for guests. */
export function PickProgress({ matchIds }: { matchIds: string[] }) {
  const { viewer, picks } = usePicks();
  if (!viewer || matchIds.length === 0) return null;
  const done = matchIds.filter((id) => picks[id]).length;
  return (
    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      {done}/{matchIds.length} picked
    </span>
  );
}

/** The fan's own points for a set of matches (last matchday), once scored. */
export function MyPoints({ matchIds }: { matchIds: string[] }) {
  const { viewer, picks } = usePicks();
  if (!viewer) return <span className="text-muted-foreground">Log in to play</span>;
  const scored = matchIds
    .map((id) => picks[id]?.pointsAwarded)
    .filter((p): p is number => p !== null && p !== undefined);
  return (
    <span className="figure text-2xl">
      {scored.length ? scored.reduce((a, b) => a + b, 0) : "–"}
    </span>
  );
}
