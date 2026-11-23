"use client";

import { RunStatus } from "@/components/admin/run-status";
import { useTrackedRuns } from "@/lib/admin/run-store";

/**
 * Status lines for the model runs started from this browser tab. Lives in
 * the admin layout, so it stays visible when a saved match leaves the list.
 */
export function RunTracker() {
  const runs = useTrackedRuns();
  if (!runs.length) return null;
  return (
    <ul className="mb-5 grid gap-2">
      {runs.map((r) => (
        <li key={r.runId} className="rounded-xl border border-ink/40 bg-surface p-3">
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <RunStatus runId={r.runId} />
        </li>
      ))}
    </ul>
  );
}
