import "server-only";

import { sendEmail } from "@/lib/email/brevo";
import { nextPreview, renderPreview } from "@/lib/email/preview";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The preview is queued by the first daily run that falls between 48 and 24
 * hours before the matchday's first kick-off: about 36 hours ahead, with a
 * once-a-day cron.
 */
export const QUEUE_FROM_HOURS = 48;
export const QUEUE_UNTIL_HOURS = 24;

export type QueueReport = {
  matchday: number | null;
  queued: number;
  sent: number;
  failed: number;
  skipped: number; // unsubscribed or banned since queuing
  sentToday: number;
  limit: number;
  note: string;
};

async function allEmails(db: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
    if (data.users.length < 1000) return emails;
  }
}

export async function runPreviewQueue(now: number, limit: number): Promise<QueueReport> {
  const db = createAdminClient();
  const report: QueueReport = {
    matchday: null,
    queued: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    sentToday: 0,
    limit,
    note: "",
  };
  const plan = await nextPreview(now);
  if (!plan) return { ...report, note: "No upcoming matchday." };
  report.matchday = plan.md;
  const hours = (Date.parse(plan.firstKickoff) - now) / 3_600_000;

  // 1. Queue: every opted-in fan without a row for this matchday.
  if (hours <= QUEUE_FROM_HOURS && hours > QUEUE_UNTIL_HOURS) {
    const { data: fans, error } = await db
      .from("profiles")
      .select("id")
      .eq("email_opt_in", true)
      .eq("banned", false)
      .neq("role", "system");
    if (error) throw new Error(error.message);
    if (fans.length) {
      const { data: added, error: insertError } = await db
        .from("email_sends")
        .upsert(
          fans.map((f) => ({ user_id: f.id, matchday_id: plan.mdId, status: "queued" as const })),
          { onConflict: "user_id,matchday_id", ignoreDuplicates: true },
        )
        .select("id");
      if (insertError) throw new Error(insertError.message);
      report.queued = added?.length ?? 0;
    }
  }

  // 2. Send what's queued, only while picks are open, within today's limit.
  if (hours <= 0)
    return { ...report, note: "Picks have closed. Nothing more is sent for this matchday." };
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  // Fail safe: if today's count can't be read, send nothing rather than risk the limit.
  const { count, error: countError } = await db
    .from("email_sends")
    .select("id", { count: "exact" })
    .gte("sent_at", dayStart.toISOString())
    .limit(1);
  if (countError || count === null)
    throw new Error(`Couldn't count today's emails: ${countError?.message ?? "no count"}`);
  report.sentToday = count;
  const budget = Math.max(0, limit - report.sentToday);

  const { data: queued } = await db
    .from("email_sends")
    .select("id,user_id")
    .eq("matchday_id", plan.mdId)
    .eq("status", "queued");
  if (!queued?.length)
    return { ...report, note: hours > QUEUE_FROM_HOURS ? "Not due yet." : "Nothing queued." };
  if (budget === 0)
    return { ...report, note: `Daily limit of ${limit} reached. The rest go tomorrow.` };

  // Order: fans who picked last matchday first, then by sign-up date.
  const ids = queued.map((q) => q.user_id);
  const { data: profiles } = await db
    .from("profiles")
    .select("id,display_name,email_opt_in,banned,created_at")
    .in("id", ids);
  const pickedLast = new Set<string>();
  if (plan.lastMd) for (const r of plan.lastMd.rows) if (!r.isBallboy) pickedLast.add(r.userId);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const order = [...queued].sort((a, b) => {
    const pa = byId.get(a.user_id),
      pb = byId.get(b.user_id);
    const picked = Number(pickedLast.has(b.user_id)) - Number(pickedLast.has(a.user_id));
    return picked || (pa?.created_at ?? "").localeCompare(pb?.created_at ?? "");
  });

  const emails = await allEmails(db);
  for (const row of order.slice(0, budget)) {
    const p = byId.get(row.user_id);
    const email = emails.get(row.user_id);
    if (!p || !p.email_opt_in || p.banned || !email) {
      // Unsubscribed or banned since queuing: never sent, so the row goes.
      await db.from("email_sends").delete().eq("id", row.id).eq("status", "queued");
      report.skipped++;
      continue;
    }
    const message = renderPreview(plan, { id: p.id, name: p.display_name });
    const failure = await sendEmail({ to: { email, name: p.display_name }, ...message });
    await db
      .from("email_sends")
      .update(
        failure
          ? { status: "failed", error: failure }
          : { status: "sent", sent_at: new Date().toISOString() },
      )
      .eq("id", row.id)
      .eq("status", "queued"); // never touch a row twice
    if (failure) report.failed++;
    else report.sent++;
  }
  const left = queued.length - report.sent - report.failed - report.skipped;
  return { ...report, note: left > 0 ? `${left} still queued for tomorrow.` : "All sent." };
}
