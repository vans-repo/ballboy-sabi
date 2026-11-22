"use client";

import { useEffect, useState } from "react";

type Run = {
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  predictions: number | null;
};

const STEPS = ["queued", "running", "done"] as const;

/** "Model run: queued → running → done", polling every 3 seconds until it ends. */
export function RunStatus({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null>(null);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const r = await fetch(`/api/admin/runs/${runId}`, { cache: "no-store" }).catch(() => null);
      if (r?.ok && !stop) {
        const data = (await r.json()) as Run;
        setRun(data);
        if (data.status === "done" || data.status === "failed") return;
      }
      if (!stop) timer = setTimeout(poll, 3000);
    }
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [runId]);

  if (!run) return <p className="text-sm text-muted-foreground">Model run: starting…</p>;
  return (
    <div role="status" aria-live="polite" className="text-sm">
      <p>
        Model run:{" "}
        {run.status === "failed" ? (
          <span className="font-medium text-danger">failed</span>
        ) : (
          STEPS.map((s, i) => (
            <span key={s}>
              {i > 0 && " → "}
              <span
                className={
                  STEPS.indexOf(run.status as (typeof STEPS)[number]) >= i
                    ? "font-medium"
                    : "text-muted-foreground"
                }
              >
                {s}
              </span>
            </span>
          ))
        )}
        {run.status === "done" &&
          run.predictions !== null &&
          ` (${run.predictions} ${run.predictions === 1 ? "prediction" : "predictions"} updated)`}
      </p>
      {run.error && <p className="mt-1 text-danger">{run.error}</p>}
    </div>
  );
}
