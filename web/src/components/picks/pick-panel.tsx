"use client";

import Link from "next/link";
import { useState } from "react";

import { PickButtons, type PickTarget } from "@/components/picks/pick-buttons";
import { type MyPick, usePicks } from "@/lib/picks-store";
import { useNow } from "@/lib/use-now";

const NAME = { home: "Home", draw: "Draw", away: "Away" } as const;

function describe(p: MyPick, labels: { home: string; away: string }) {
  const side = p.outcome === "draw" ? "Draw" : `${NAME[p.outcome]} (${labels[p.outcome]})`;
  return p.homeGoals !== null ? `${side}, ${p.homeGoals}–${p.awayGoals}` : side;
}

/**
 * The match page's pick panel: three outcome buttons with their points, plus
 * an optional exact score (+3). Read-only from kick-off.
 */
export function PickPanel({
  target,
  labels,
}: {
  target: PickTarget;
  labels: { home: string; away: string };
}) {
  const { ready, viewer, picks } = usePicks();
  const now = useNow();
  const mine = picks[target.matchId];
  const [home, setHome] = useState<string>("");
  const [away, setAway] = useState<string>("");
  const locked = now !== null && Date.parse(target.kickoff) <= now;
  const g = (v: string) => (v === "" ? null : Number.parseInt(v, 10));

  if (locked) {
    return (
      <div className="rounded-xl bg-surface p-4 text-sm">
        {mine ? (
          <>
            <p>
              Your pick: <span className="font-medium">{describe(mine, labels)}</span>
            </p>
            {mine.pointsAwarded !== null && (
              <p className="mt-1">
                You scored <span className="figure text-xl">{mine.pointsAwarded}</span> points.
              </p>
            )}
            {mine.pointsAwarded === null && mine.pointsIfCorrect === null && (
              <p className="mt-1 text-muted-foreground">
                Picks are locked. Points are added when the result is in.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Picks are locked for this match.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface p-4">
      <PickButtons
        target={{ ...target, labels }}
        goals={{ home: g(home), away: g(away) }}
        size="lg"
      />
      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary">
          Add an exact score (+3 points)
        </summary>
        <div className="mt-2 flex items-end gap-2">
          <label className="grid gap-1 text-xs">
            {labels.home}
            <input
              inputMode="numeric"
              type="number"
              min={0}
              max={20}
              value={home}
              onChange={(e) => setHome(e.target.value)}
              className="h-11 w-20 rounded-lg border bg-background px-3 text-base"
            />
          </label>
          <span className="pb-3">–</span>
          <label className="grid gap-1 text-xs">
            {labels.away}
            <input
              inputMode="numeric"
              type="number"
              min={0}
              max={20}
              value={away}
              onChange={(e) => setAway(e.target.value)}
              className="h-11 w-20 rounded-lg border bg-background px-3 text-base"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter a score, then tap Home, Draw or Away to save both.
        </p>
      </details>
      <p className="mt-3 text-sm text-muted-foreground">
        {mine ? (
          <>
            Your pick: <span className="font-medium text-foreground">{describe(mine, labels)}</span>
            . You can change it until kick-off.
          </>
        ) : ready && !viewer ? (
          <>
            <Link href="/login" className="text-primary underline underline-offset-2">
              Log in
            </Link>{" "}
            to play Beat the Ballboy. Free, no money involved.
          </>
        ) : (
          "Points become final at kick-off."
        )}
      </p>
    </div>
  );
}
