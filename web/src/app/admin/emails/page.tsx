import { SendTestButton } from "@/components/admin/forms";
import { Card, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { nextPreview, previewSubject } from "@/lib/email/preview";
import { QUEUE_FROM_HOURS, QUEUE_UNTIL_HOURS } from "@/lib/email/queue";
import { formatLongDay, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { renderTime } from "@/lib/time";

/** The next Matchday Preview: when it goes out, and how many are queued, sent and failed. */
export default async function AdminEmailsPage() {
  await requireAdmin();
  const now = renderTime();
  const plan = await nextPreview(now);
  const supabase = await createClient();
  const { data } = plan
    ? await supabase.from("email_sends").select("status,error").eq("matchday_id", plan.mdId)
    : { data: [] };
  const count = (s: string) => (data ?? []).filter((r) => r.status === s).length;
  const errors = [...new Set((data ?? []).map((r) => r.error).filter(Boolean))].slice(0, 3);
  const { count: optedIn } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("email_opt_in", true)
    .eq("banned", false);
  const limit = process.env.EMAIL_DAILY_LIMIT ?? "280";
  const configured = !!process.env.BREVO_API_KEY && !!process.env.EMAIL_FROM_ADDRESS;

  return (
    <>
      <PageTitle sub={plan ? `Matchday ${plan.md}` : undefined}>Emails</PageTitle>
      {!configured && (
        <Card className="mb-6 border border-danger text-sm">
          Email isn&apos;t set up yet: BREVO_API_KEY and EMAIL_FROM_ADDRESS are missing.
        </Card>
      )}
      {plan ? (
        <>
          <Section title="Matchday Preview">
            <Card className="grid gap-3">
              <p className="font-medium">&ldquo;{previewSubject(plan)}&rdquo;</p>
              <p className="text-sm text-muted-foreground">
                First kick-off {formatLongDay(plan.firstKickoff)}
                {plan.timeConfirmed ? `, ${formatTime(plan.firstKickoff)} WAT` : ", time TBC"}.
                Queued by the first daily run between {QUEUE_FROM_HOURS} and {QUEUE_UNTIL_HOURS}{" "}
                hours before, then sent at up to {limit} a day while picks are open. {optedIn ?? 0}{" "}
                fans have the weekly email on.
              </p>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {["queued", "sent", "failed"].map((s) => (
                  <div key={s}>
                    <dt className="text-xs text-muted-foreground capitalize">{s}</dt>
                    <dd className="figure text-4xl">{count(s)}</dd>
                  </div>
                ))}
              </dl>
              {errors.length > 0 && (
                <ul className="text-xs text-danger">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
          <Section title="Test">
            <Card>
              <p className="mb-3 text-sm text-muted-foreground">
                Sends this preview to your own email, as you would see it.
              </p>
              <SendTestButton />
            </Card>
          </Section>
        </>
      ) : (
        <Card>No upcoming matchday to preview.</Card>
      )}
    </>
  );
}
