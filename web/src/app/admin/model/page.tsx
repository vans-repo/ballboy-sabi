import { RunNowButton } from "@/components/admin/forms";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { formatShortDate, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Metrics = {
  predictions?: number;
  duration_seconds?: number;
  walk_forward?: {
    model_version: string;
    matches: number;
    blend: { log_loss: number; brier: number; accuracy: number };
    league_average: { log_loss: number };
    always_home_accuracy: number;
  };
};

export default async function AdminModelPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("model_runs")
    .select("id,status,trigger,model_version,started_at,finished_at,created_at,error,metrics")
    .order("created_at", { ascending: false })
    .limit(20);
  const live = (runs ?? []).find((r) => r.status === "done" && r.metrics);
  const wf = (live?.metrics as Metrics | undefined)?.walk_forward;

  return (
    <>
      <PageTitle>Model</PageTitle>
      <Section title="In production">
        <Card className="grid gap-3">
          {wf ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Version</dt>
                <dd className="font-medium">{wf.model_version}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Walk-forward log-loss</dt>
                <dd className="figure text-2xl">{wf.blend.log_loss.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">League averages</dt>
                <dd className="figure text-2xl">{wf.league_average.log_loss.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Test matches</dt>
                <dd className="figure text-2xl">{wf.matches}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No successful run yet.</p>
          )}
          <RunNowButton />
        </Card>
      </Section>
      <Section title="Last 20 runs">
        {runs?.length ? (
          <div className="overflow-x-auto rounded-xl bg-surface">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Started</th>
                  <th className="p-2 text-left font-medium">Trigger</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-right font-medium">Duration</th>
                  <th className="p-2 text-right font-medium">Log-loss</th>
                  <th className="p-2 text-right font-medium">Predictions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const m = r.metrics as Metrics | null;
                  const secs =
                    r.started_at && r.finished_at
                      ? Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)
                      : null;
                  return (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      <td className="p-2 whitespace-nowrap">
                        {formatShortDate(r.created_at)} {formatTime(r.created_at)}
                      </td>
                      <td className="p-2">{r.trigger.replace("_", " ")}</td>
                      <td className="p-2">
                        <span
                          className={
                            r.status === "failed"
                              ? "text-danger"
                              : r.status === "done"
                                ? "text-success"
                                : ""
                          }
                        >
                          {r.status}
                        </span>
                        {r.error && (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.error}</p>
                        )}
                      </td>
                      <td className="p-2 text-right">{secs !== null ? `${secs}s` : "–"}</td>
                      <td className="p-2 text-right">
                        {m?.walk_forward ? m.walk_forward.blend.log_loss.toFixed(4) : "–"}
                      </td>
                      <td className="p-2 text-right">{m?.predictions ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No runs yet.</Empty>
        )}
      </Section>
    </>
  );
}
