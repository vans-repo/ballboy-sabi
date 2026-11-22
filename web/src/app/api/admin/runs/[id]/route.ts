import { getViewer } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

/** Status of one model run, for the admin's live status line. Admins only (RLS too). */
export async function GET(_: Request, ctx: RouteContext<"/api/admin/runs/[id]">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin")
    return Response.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("model_runs")
    .select("status,error,started_at,finished_at,metrics")
    .eq("id", id)
    .maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const metrics = data.metrics as { predictions?: number } | null;
  return Response.json({
    status: data.status,
    error: data.error,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    predictions: metrics?.predictions ?? null,
  });
}
