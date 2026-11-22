import "server-only";

import { BRAND, FREE_TO_PLAY_LINE, SITE_NAME } from "@/config/site";
import { getLatestPredictions, getLeaderboard, type LeaderRow } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { publicEnv } from "@/lib/env";
import { ordinal } from "@/lib/format";
import { oneClickUrl, unsubscribeUrl } from "@/lib/email/unsubscribe";

const LAGOS = "Africa/Lagos";

export type PreviewPlan = {
  md: number;
  mdId: string;
  firstKickoff: string; // ISO
  timeConfirmed: boolean;
  upsets: { home: string; away: string; pAway: number; reason: string | null }[];
  lastMd: { number: number; rows: LeaderRow[] } | null;
};

/** The next matchday whose first kick-off is still ahead, with what the email needs. */
export async function nextPreview(now: number): Promise<PreviewPlan | null> {
  const ctx = await getContext();
  const season = ctx.matches.filter(
    (m) => m.seasonId === ctx.current.id && m.matchday !== null && m.matchdayId,
  );
  const firstByDay = new Map<number, (typeof season)[number]>();
  for (const m of season) {
    const f = firstByDay.get(m.matchday!);
    if (!f || Date.parse(m.kickoff) < Date.parse(f.kickoff)) firstByDay.set(m.matchday!, m);
  }
  const upcoming = [...firstByDay.values()]
    .filter((m) => Date.parse(m.kickoff) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0];
  if (!upcoming) return null;
  const md = upcoming.matchday!;

  const latest = await getLatestPredictions();
  const upsets = season
    .filter((m) => m.matchday === md && latest[m.id]?.upset_alert && Date.parse(m.kickoff) > now)
    .sort((a, b) => Number(latest[b.id].p_away) - Number(latest[a.id].p_away))
    .slice(0, 2)
    .map((m) => ({
      home: ctx.teams.get(m.homeId)!.name,
      away: ctx.teams.get(m.awayId)!.name,
      pAway: Number(latest[m.id].p_away),
      reason: latest[m.id].reasons[0] ?? null,
    }));

  // Last matchday: the latest one before this with scored picks.
  let lastMd: PreviewPlan["lastMd"] = null;
  for (const n of [...firstByDay.keys()]
    .filter((n) => n < md)
    .sort((a, b) => b - a)
    .slice(0, 3)) {
    const rows = await getLeaderboard("matchday", firstByDay.get(n)!.matchdayId!);
    if (rows.some((r) => !r.isBallboy)) {
      lastMd = { number: n, rows };
      break;
    }
  }
  return {
    md,
    mdId: upcoming.matchdayId!,
    firstKickoff: upcoming.kickoff,
    timeConfirmed: upcoming.timeConfirmed,
    upsets,
    lastMd,
  };
}

/** "Saturday 4pm", "Sunday 4:30pm", or "Saturday" when the time isn't announced. */
export function deadlineWords(iso: string, timeConfirmed: boolean): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, weekday: "long" }).format(d);
  if (!timeConfirmed) return day;
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(d)
    .split(":")
    .map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} ${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export function previewSubject(plan: PreviewPlan): string {
  return `Matchday ${plan.md} picks close ${deadlineWords(plan.firstKickoff, plan.timeConfirmed)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pc = (p: number) => `${Math.round(p * 100)}%`;

/** The Matchday Preview for one fan: subject, HTML, plain text and unsubscribe headers. */
export function renderPreview(plan: PreviewPlan, user: { id: string; name: string }) {
  const site = publicEnv.siteUrl;
  const picksUrl = `${site}/pick-all?md=${plan.md}`;
  const unsub = unsubscribeUrl(user.id);
  const deadline = deadlineWords(plan.firstKickoff, plan.timeConfirmed);
  const me = plan.lastMd?.rows.find((r) => r.userId === user.id);
  const fans = plan.lastMd ? plan.lastMd.rows.filter((r) => !r.isBallboy).length : 0;
  const ballboy = plan.lastMd?.rows.find((r) => r.isBallboy);
  const lastLine = !plan.lastMd
    ? null
    : me
      ? `Matchday ${plan.lastMd.number}: you scored ${me.points} points and finished ${ordinal(me.rank)} of ${fans + 1}. The Ballboy scored ${ballboy?.points ?? 0}.`
      : `Matchday ${plan.lastMd.number}: you didn't pick. The Ballboy scored ${ballboy?.points ?? 0}.`;
  const deadlineLine = `The first match kicks off ${deadline}${plan.timeConfirmed ? " (WAT)" : ""}. Each pick locks at its own kick-off.`;

  const text = [
    `Hi ${user.name},`,
    "",
    `Matchday ${plan.md} picks close ${deadline}.`,
    deadlineLine,
    ...(lastLine ? ["", lastLine] : []),
    ...(plan.upsets.length
      ? [
          "",
          "Upset Alert:",
          ...plan.upsets.map(
            (u) =>
              `- ${u.away} at ${u.home}: ${pc(u.pAway)} chance of an away win${u.reason ? `. ${u.reason}` : ""}`,
          ),
        ]
      : []),
    "",
    `Make your picks: ${picksUrl}`,
    "",
    `${FREE_TO_PLAY_LINE}`,
    `Stop these emails: ${unsub}`,
  ].join("\n");

  const upsetHtml = plan.upsets
    .map(
      (u) => `<tr><td style="padding:12px 0;border-top:1px solid #e3e7ef">
        <div style="font-weight:600">${esc(u.away)} at ${esc(u.home)}</div>
        <div><span style="font-size:22px;font-weight:700;color:#1d63b0">${pc(u.pAway)}</span> chance of an away win</div>
        ${u.reason ? `<div class="muted" style="color:#4b5567;font-size:14px">${esc(u.reason)}</div>` : ""}
      </td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(previewSubject(plan))}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .card { background:#000e2e !important; color:#ffffff !important; }
    .muted { color:#c9ced8 !important; }
    .rule td { border-color:#24304f !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:#f3f5f9;color:#000e2e;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px">
<table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
  <tr><td style="background:#000e2e;border-radius:12px 12px 0 0;padding:16px 20px;color:#f5c842;font-weight:700;font-size:18px;letter-spacing:0.5px">${esc(SITE_NAME.toUpperCase())}</td></tr>
  <tr><td style="padding:20px">
    <p style="margin:0 0 4px">Hi ${esc(user.name)},</p>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2">Matchday ${plan.md} picks close ${esc(deadline)}</h1>
    <p class="muted" style="margin:0 0 16px;color:#4b5567">${esc(deadlineLine)}</p>
    ${lastLine ? `<p style="margin:0 0 16px">${esc(lastLine)}</p>` : ""}
    ${plan.upsets.length ? `<h2 style="margin:16px 0 0;font-size:18px">Upset Alert</h2><table role="presentation" class="rule" width="100%" cellpadding="0" cellspacing="0">${upsetHtml}</table>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#f5c842;border-radius:8px">
      <a href="${esc(picksUrl)}" style="display:inline-block;padding:14px 24px;color:#000e2e;font-weight:700;text-decoration:none">Make your picks</a>
    </td></tr></table>
    <p class="muted" style="margin:0;color:#4b5567;font-size:14px">${esc(FREE_TO_PLAY_LINE)} ${esc(SITE_NAME)} by ${esc(BRAND)}.</p>
    <p class="muted" style="margin:8px 0 0;color:#4b5567;font-size:14px">You get this because you asked for the weekly preview. <a href="${esc(unsub)}" style="color:#1d63b0">Unsubscribe</a> with one click.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  return {
    subject: previewSubject(plan),
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl(user.id)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
