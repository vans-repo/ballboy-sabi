"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { savePick } from "@/app/picks/actions";
import { type Outcome, pickPoints, setPick, usePicks } from "@/lib/picks-store";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export type PickTarget = {
  matchId: string;
  kickoff: string;
  probs: { home: number; draw: number; away: number };
  labels?: { home: string; away: string };
};

const NAMES: Record<Outcome, string> = { home: "Home", draw: "Draw", away: "Away" };

/** Three outcome buttons, each with its points value. Shared by cards, the match page and Pick all. */
export function PickButtons({
  target,
  goals,
  onSaved,
  size = "md",
}: {
  target: PickTarget;
  goals?: { home: number | null; away: number | null };
  onSaved?: () => void;
  size?: "md" | "lg";
}) {
  const { ready, viewer, picks } = usePicks();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mine = picks[target.matchId];
  const now = useNow();
  const locked = now !== null && Date.parse(target.kickoff) <= now;

  function choose(outcome: Outcome) {
    setError(null);
    if (!viewer) {
      router.push(`/login?next=${encodeURIComponent(path)}&pick=${target.matchId}:${outcome}`);
      return;
    }
    const keepScore =
      goals && goals.home !== null && goals.away !== null
        ? goals
        : mine && mine.outcome === outcome
          ? { home: mine.homeGoals, away: mine.awayGoals }
          : { home: null, away: null };
    start(async () => {
      const err = await savePick({
        matchId: target.matchId,
        outcome,
        homeGoals: keepScore.home,
        awayGoals: keepScore.away,
      });
      if (err) setError(err);
      else {
        setPick(target.matchId, {
          outcome,
          homeGoals: keepScore.home,
          awayGoals: keepScore.away,
          pointsIfCorrect: null,
          pointsAwarded: null,
        });
        onSaved?.();
      }
    });
  }

  if (locked) return null;
  return (
    <div>
      <div role="group" aria-label="Your pick" className="grid grid-cols-3 gap-2">
        {(["home", "draw", "away"] as const).map((o) => {
          const chosen = mine?.outcome === o;
          const label = o === "draw" ? "Draw" : (target.labels?.[o] ?? NAMES[o]);
          return (
            <button
              key={o}
              type="button"
              disabled={pending || !ready || viewer?.banned}
              aria-pressed={chosen}
              onClick={() => choose(o)}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border px-1 text-sm font-medium transition-colors disabled:opacity-60",
                size === "lg" ? "min-h-16" : "min-h-12",
                chosen
                  ? "border-ink bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              <span className="truncate">{label}</span>
              <span
                className={cn(
                  "text-xs",
                  chosen ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {pickPoints(target.probs[o])} pts
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {viewer?.banned && (
        <p className="mt-2 text-sm text-muted-foreground">This account can&apos;t make picks.</p>
      )}
    </div>
  );
}
