"use client";

import { useSyncExternalStore } from "react";

export type TrackedRun = { runId: string; label: string };

let runs: TrackedRun[] = [];
const listeners = new Set<() => void>();
const EMPTY: TrackedRun[] = [];

/** Show a model run's status line at the top of the admin area. */
export function trackRun(run: TrackedRun) {
  runs = [run, ...runs.filter((r) => r.runId !== run.runId)].slice(0, 5);
  for (const l of listeners) l();
}

export function useTrackedRuns(): TrackedRun[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => runs,
    () => EMPTY,
  );
}
