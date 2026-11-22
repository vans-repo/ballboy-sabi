import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Trigger = "result_saved" | "manual";

/**
 * Queue a model run and ask GitHub Actions to start it.
 *  - result_saved: repository_dispatch, event type result_saved
 *  - manual: workflow_dispatch of model.yml ("Run now")
 * The model_runs row is created here (status queued) and its id is passed
 * to the workflow, which fills it in. Returns the run id. If GitHub can't be
 * reached, the run is marked failed with the reason, and the result itself
 * stays saved.
 */
export async function dispatchModelRun(trigger: Trigger): Promise<string> {
  const db = createAdminClient();
  const { data: run, error } = await db
    .from("model_runs")
    .insert({ trigger, status: "queued" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  let failure: string | null = null;
  if (!token || !repo) {
    failure =
      "Couldn't start the model run: GITHUB_DISPATCH_TOKEN and GITHUB_REPOSITORY are not set.";
  } else {
    const [url, body] =
      trigger === "manual"
        ? [
            `${api}/repos/${repo}/actions/workflows/model.yml/dispatches`,
            { ref: "main", inputs: { model_run_id: run.id } },
          ]
        : [
            `${api}/repos/${repo}/dispatches`,
            { event_type: "result_saved", client_payload: { model_run_id: run.id } },
          ];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        failure = `GitHub refused to start the model run (HTTP ${r.status}): ${(await r.text()).slice(0, 300)}`;
    } catch (e) {
      failure = `Couldn't reach GitHub to start the model run: ${(e as Error).message}`;
    }
  }
  if (failure) {
    await db
      .from("model_runs")
      .update({ status: "failed", error: failure, finished_at: new Date().toISOString() })
      .eq("id", run.id);
  }
  return run.id;
}
