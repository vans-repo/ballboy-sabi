import "server-only";

import { getContext } from "@/lib/data/context";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/brevo";
import { formatShortDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

/** A match is overdue this long after kick-off (a match plus stoppages and travel home). */
export const OVERDUE_AFTER_HOURS = 3;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Once a day: if any match kicked off more than 3 hours ago without a result,
 * email every admin the list, with a link to Needs results. Records nothing,
 * so it repeats daily until the results are in.
 */
export async function remindAdmins(
  now: number,
): Promise<{ overdue: number; emailed: number; error?: string }> {
  const ctx = await getContext();
  const overdue = ctx.matches
    .filter(
      (m) =>
        (m.status === "scheduled" || m.status === "postponed") &&
        Date.parse(m.kickoff) <= now - OVERDUE_AFTER_HOURS * 3_600_000,
    )
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  if (!overdue.length) return { overdue: 0, emailed: 0 };

  const db = createAdminClient();
  const { data: admins, error } = await db
    .from("profiles")
    .select("id,display_name")
    .eq("role", "admin")
    .eq("banned", false);
  if (error) return { overdue: overdue.length, emailed: 0, error: error.message };

  const lines = overdue.map(
    (m) =>
      `${ctx.teams.get(m.homeId)!.name} v ${ctx.teams.get(m.awayId)!.name} (${m.matchday ? `Matchday ${m.matchday}, ` : ""}${formatShortDate(m.kickoff)})`,
  );
  const link = `${publicEnv.siteUrl}/admin`;
  const subject =
    overdue.length === 1
      ? "1 NPFL result needs entering"
      : `${overdue.length} NPFL results need entering`;
  let emailed = 0;
  for (const a of admins ?? []) {
    const { data } = await db.auth.admin.getUserById(a.id);
    const email = data.user?.email;
    if (!email) continue;
    const failure = await sendEmail({
      to: { email, name: a.display_name },
      subject,
      text: [
        `Hi ${a.display_name},`,
        "",
        "These matches have kicked off but have no result yet:",
        ...lines.map((l) => `- ${l}`),
        "",
        `Enter them here: ${link}`,
        "",
        "Points and predictions update as soon as you save.",
      ].join("\n"),
      html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#000e2e">
<p>Hi ${esc(a.display_name)},</p><p>These matches have kicked off but have no result yet:</p>
<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p><a href="${esc(link)}" style="display:inline-block;padding:12px 20px;background:#f5c842;color:#000e2e;font-weight:700;text-decoration:none;border-radius:8px">Enter results</a></p>
<p style="color:#4b5567;font-size:14px">Points and predictions update as soon as you save.</p></body></html>`,
    });
    if (!failure) emailed++;
  }
  return { overdue: overdue.length, emailed };
}
