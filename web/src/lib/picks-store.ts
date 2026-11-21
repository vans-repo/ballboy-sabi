"use client";

import { useSyncExternalStore } from "react";

export type Outcome = "home" | "draw" | "away";
export type MyPick = {
  outcome: Outcome;
  homeGoals: number | null;
  awayGoals: number | null;
  pointsIfCorrect: number | null;
  pointsAwarded: number | null;
};
export type PicksState = {
  ready: boolean; // false until the server has said who is signed in
  viewer: { id: string; displayName: string; banned: boolean } | null;
  picks: Record<string, MyPick>;
};

let state: PicksState = { ready: false, viewer: null, picks: {} };
const listeners = new Set<() => void>();
const SERVER: PicksState = { ready: false, viewer: null, picks: {} };

export function setPicksState(next: PicksState) {
  state = next;
  for (const l of listeners) l();
}

export function setPick(matchId: string, pick: MyPick) {
  setPicksState({ ...state, picks: { ...state.picks, [matchId]: pick } });
}

export function usePicks(): PicksState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

/** Points for a correct pick with probability p: round(1/p), from 1 to 10. */
export function pickPoints(p: number): number {
  if (!(p > 0)) return 10;
  return Math.min(10, Math.max(1, Math.round(1 / p)));
}
