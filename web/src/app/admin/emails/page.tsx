import { Card, PageTitle } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { renderTime } from "@/lib/time";
import { getContext } from "@/lib/data/context";
import { currentMatchday } from "@/lib/football";
import { createClient } from "@/lib/supabase/server";

/** This matchday's Matchday Preview: how many queued, sent and failed. */
export default async function AdminEmailsPage() {
  await requireAdmin();
  const ctx = await getContext();
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const md = currentMatchday(season, renderTime());
  const mdId = season.find((m) => m.matchday === md)?.matchdayId;
  const supabase = await createClient();
  const { data } = mdId
    ? await supabase.from("email_sends").select("status").eq("matchday_id", mdId)
    : { data: [] };
  const count = (s: string) => (data ?? []).filter((r) => r.status === s).length;
  return (
    <>
      <PageTitle sub={md ? `Matchday ${md} preview` : undefined}>Emails</PageTitle>
      <Card>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {["queued", "sent", "failed"].map((s) => (
            <div key={s}>
              <dt className="text-xs text-muted-foreground capitalize">{s}</dt>
              <dd className="figure text-4xl">{count(s)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          The weekly preview and the &quot;send a test to me&quot; button arrive with the email work
          in Stage 7.
        </p>
      </Card>
    </>
  );
}
