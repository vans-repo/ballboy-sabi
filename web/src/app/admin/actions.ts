"use server";

import { updateTag } from "next/cache";

import { lagosToUtc, normaliseName, parseDate, parseTime, UNANNOUNCED_TIME } from "@/lib/admin/csv";
import { dispatchModelRun } from "@/lib/admin/dispatch";
import { matchdayId, previewFixtures, type PreviewRow } from "@/lib/admin/fixtures";
import { getViewer } from "@/lib/auth/user";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { ALL_CATEGORIES } from "@/config/news-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; message?: string; runId?: string };

/** Every admin action starts here. RLS checks again in the database. */
async function admin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.banned) throw new Error("Not allowed");
  return createClient();
}

function refreshPublicPages() {
  updateTag(CACHE_TAGS.matches);
  updateTag(CACHE_TAGS.picks);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
export type ResultInput = {
  matchId: string;
  status: "played" | "postponed" | "abandoned" | "awarded" | "cancelled";
  homeGoals: number | null;
  awayGoals: number | null;
  newDate?: string; // postponed: YYYY-MM-DD
  newTime?: string; // postponed: HH:MM Lagos
  notes?: string;
};

/**
 * Save or correct a result. The database scores every pick for the match at
 * once (trigger), the public pages refresh, and a model run is dispatched.
 */
export async function saveResult(input: ResultInput): Promise<ActionResult> {
  const supabase = await admin();
  const values: TablesUpdate<"matches"> = {
    status: input.status,
    notes: input.notes?.trim() || null,
  };
  if (input.status === "played" || input.status === "awarded") {
    const ok = [input.homeGoals, input.awayGoals].every(
      (g) => Number.isInteger(g) && g! >= 0 && g! <= 99,
    );
    if (!ok) return { error: "Enter both scores (whole numbers)." };
    values.home_goals = input.homeGoals;
    values.away_goals = input.awayGoals;
  } else {
    values.home_goals = null;
    values.away_goals = null;
  }
  if (input.status === "postponed") {
    const date = parseDate(input.newDate ?? "");
    const time = parseTime(input.newTime ?? "");
    if (!date || !time) return { error: "A postponed match needs its new date and kick-off time." };
    values.kickoff_at = lagosToUtc(date, time);
    values.kickoff_time_confirmed = true;
  }
  const { data, error } = await supabase
    .from("matches")
    .update(values)
    .eq("id", input.matchId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "That match wasn't found." };
  refreshPublicPages();
  const runId = await dispatchModelRun("result_saved");
  return { message: "Saved. Points are updated.", runId };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export async function updateFixture(input: {
  matchId: string;
  seasonId: string;
  date: string;
  time: string;
  matchday: number;
}): Promise<ActionResult> {
  const supabase = await admin();
  const date = parseDate(input.date);
  const time = input.time ? parseTime(input.time) : null;
  if (!date) return { error: "Choose a date." };
  if (input.time && !time) return { error: "Time must be HH:MM, or blank if not announced." };
  if (!Number.isInteger(input.matchday) || input.matchday < 1)
    return { error: "Matchday must be a whole number from 1." };
  const { error } = await supabase
    .from("matches")
    .update({
      kickoff_at: lagosToUtc(date, time ?? UNANNOUNCED_TIME),
      kickoff_time_confirmed: time !== null,
      matchday_id: await matchdayId(input.seasonId, input.matchday),
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Fixture updated." };
}

export async function addFixture(input: {
  seasonId: string;
  homeId: string;
  awayId: string;
  date: string;
  time: string;
  matchday: number;
}): Promise<ActionResult> {
  const supabase = await admin();
  const date = parseDate(input.date);
  const time = input.time ? parseTime(input.time) : null;
  if (!date) return { error: "Choose a date." };
  if (input.time && !time) return { error: "Time must be HH:MM, or blank if not announced." };
  if (!input.homeId || !input.awayId || input.homeId === input.awayId)
    return { error: "Choose two different teams." };
  if (!Number.isInteger(input.matchday) || input.matchday < 1)
    return { error: "Matchday must be a whole number from 1." };
  const { error } = await supabase.from("matches").insert({
    season_id: input.seasonId,
    home_team_id: input.homeId,
    away_team_id: input.awayId,
    kickoff_at: lagosToUtc(date, time ?? UNANNOUNCED_TIME),
    kickoff_time_confirmed: time !== null,
    matchday_id: await matchdayId(input.seasonId, input.matchday),
  });
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Fixture added." };
}

export async function previewImport(
  seasonId: string,
  csv: string,
): Promise<{ rows: PreviewRow[]; fileErrors: string[] }> {
  await admin();
  return previewFixtures(seasonId, csv);
}

/** Save an import only when every row is valid. Pairings already in the season are skipped. */
export async function saveImport(seasonId: string, csv: string): Promise<ActionResult> {
  const supabase = await admin();
  const { rows, fileErrors } = await previewFixtures(seasonId, csv);
  if (fileErrors.length || rows.some((r) => r.errors.length))
    return { error: "Fix the errors first. Nothing was saved." };
  const fresh = rows.filter((r) => !r.existing);
  const days = new Map<number, string>();
  for (const r of fresh)
    if (!days.has(+r.matchday)) days.set(+r.matchday, await matchdayId(seasonId, +r.matchday));
  const { error } = await supabase.from("matches").insert(
    fresh.map((r) => ({
      season_id: seasonId,
      home_team_id: r.homeId!,
      away_team_id: r.awayId!,
      kickoff_at: r.kickoff!,
      kickoff_time_confirmed: r.timeConfirmed!,
      matchday_id: days.get(+r.matchday)!,
    })),
  );
  if (error) return { error: error.message };
  refreshPublicPages();
  return {
    message: `Imported ${fresh.length} fixtures${rows.length > fresh.length ? `, skipped ${rows.length - fresh.length} already in the season` : ""}.`,
  };
}

// ---------------------------------------------------------------------------
// Seasons and teams
// ---------------------------------------------------------------------------
export async function createSeason(input: {
  label: string;
  start: string;
  end: string;
  note: string;
}): Promise<ActionResult> {
  const supabase = await admin();
  if (!/^\d{4}\/\d{2}$/.test(input.label)) return { error: 'Season label looks like "2027/28".' };
  if (!parseDate(input.start) || !parseDate(input.end) || input.end <= input.start)
    return { error: "Choose a start date before the end date." };
  const { error } = await supabase.from("seasons").insert({
    label: input.label,
    start_date: input.start,
    end_date: input.end,
    format_note: input.note.trim() || null,
  });
  if (error)
    return { error: error.code === "23505" ? "That season already exists." : error.message };
  refreshPublicPages();
  return { message: `Created ${input.label}.` };
}

export async function setCurrentSeason(seasonId: string): Promise<ActionResult> {
  const supabase = await admin();
  // Only one season may be current: clear the old one first.
  const cleared = await supabase
    .from("seasons")
    .update({ is_current: false })
    .eq("is_current", true)
    .neq("id", seasonId);
  if (cleared.error) return { error: cleared.error.message };
  const { error } = await supabase.from("seasons").update({ is_current: true }).eq("id", seasonId);
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Current season changed." };
}

export async function saveSeasonTeams(
  seasonId: string,
  entries: { teamId: string; status: "stayed" | "promoted" | "relegated" }[],
): Promise<ActionResult> {
  const supabase = await admin();
  const { data: current, error: readError } = await supabase
    .from("season_teams")
    .select("id,team_id,status")
    .eq("season_id", seasonId);
  if (readError) return { error: readError.message };
  const wanted = new Map(entries.map((e) => [e.teamId, e.status]));
  const toDelete = (current ?? []).filter((c) => !wanted.has(c.team_id)).map((c) => c.id);
  if (toDelete.length) {
    const { error } = await supabase.from("season_teams").delete().in("id", toDelete);
    if (error) return { error: error.message };
  }
  for (const [teamId, status] of wanted) {
    const row = (current ?? []).find((c) => c.team_id === teamId);
    const { error } = row
      ? row.status === status
        ? { error: null }
        : await supabase.from("season_teams").update({ status }).eq("id", row.id)
      : await supabase
          .from("season_teams")
          .insert({ season_id: seasonId, team_id: teamId, status });
    if (error) return { error: error.message };
  }
  refreshPublicPages();
  return { message: `Saved ${wanted.size} teams for the season.` };
}

export async function updateTeam(input: {
  teamId: string;
  code: string;
  city: string;
  primary: string;
  secondary: string;
}): Promise<ActionResult> {
  const supabase = await admin();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) return { error: "Code must be 3 letters or digits." };
  if (![input.primary, input.secondary].every((c) => /^#[0-9a-fA-F]{6}$/.test(c)))
    return { error: "Colours look like #1A2B3C." };
  const { error } = await supabase
    .from("teams")
    .update({
      code,
      city: input.city.trim() || null,
      primary_colour: input.primary,
      secondary_colour: input.secondary,
    })
    .eq("id", input.teamId);
  if (error)
    return {
      error: error.code === "23505" ? "Another team already uses that code." : error.message,
    };
  refreshPublicPages();
  return { message: "Team saved." };
}

export async function addAlias(teamId: string, alias: string): Promise<ActionResult> {
  const supabase = await admin();
  const a = normaliseName(alias);
  if (!a) return { error: "Type the name as it appears in fixture lists." };
  const { error } = await supabase.from("team_aliases").insert({ team_id: teamId, alias: a });
  if (error)
    return { error: error.code === "23505" ? `"${a}" already belongs to a team.` : error.message };
  return { message: `Added "${a}".` };
}

export async function deleteAlias(aliasId: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("team_aliases").delete().eq("id", aliasId);
  return error ? { error: error.message } : { message: "Alias removed." };
}

export async function addDeduction(input: {
  seasonId: string;
  teamId: string;
  points: number;
  /** Goals taken off goal difference as well (the league often docks both). */
  goals?: number;
  reason: string;
}): Promise<ActionResult> {
  const supabase = await admin();
  const goals = input.goals ?? 0;
  if (
    ![input.points, goals].every((n) => Number.isInteger(n) && n >= 0) ||
    input.points + goals < 1
  )
    return { error: "Enter whole numbers: points, goals, or both." };
  if (!input.teamId) return { error: "Choose the team." };
  if (!input.reason.trim()) return { error: "Give the reason, as it will appear under the table." };
  const { error } = await supabase.from("point_deductions").insert({
    season_id: input.seasonId,
    team_id: input.teamId,
    points: input.points,
    goals,
    reason: input.reason.trim(),
  });
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Deduction recorded." };
}

export async function deleteDeduction(id: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("point_deductions").delete().eq("id", id);
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Deduction removed." };
}

// ---------------------------------------------------------------------------
// Model and users
// ---------------------------------------------------------------------------
export async function runModelNow(): Promise<ActionResult> {
  await admin();
  const runId = await dispatchModelRun("manual");
  return { message: "Model run requested.", runId };
}

export async function setBanned(userId: string, banned: boolean): Promise<ActionResult> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("profiles")
    .update({ banned })
    .eq("id", userId)
    .neq("role", "system")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "That account can't be changed." };
  updateTag(CACHE_TAGS.picks); // leaderboards hide banned fans
  return { message: banned ? "Banned. Hidden from leaderboards and can't pick." : "Unbanned." };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
/** Send the next Matchday Preview to the admin's own inbox. Not recorded in email_sends. */
export async function sendTestPreview(): Promise<ActionResult> {
  await admin();
  const viewer = await getViewer();
  if (!viewer?.email) return { error: "Your account has no email address." };
  const { nextPreview, renderPreview } = await import("@/lib/email/preview");
  const { sendEmail } = await import("@/lib/email/brevo");
  const plan = await nextPreview(Date.now());
  if (!plan) return { error: "There's no upcoming matchday to preview." };
  const message = renderPreview(plan, { id: viewer.id, name: viewer.displayName });
  const failure = await sendEmail({
    to: { email: viewer.email, name: viewer.displayName },
    ...message,
  });
  return failure
    ? { error: failure }
    : { message: `Sent "${message.subject}" to ${viewer.email}.` };
}

// ---------------------------------------------------------------------------
// Site settings: Match of the Week and crests
// ---------------------------------------------------------------------------
async function saveSetting(key: string, value: Json): Promise<string | null> {
  const supabase = await admin();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) return error.message;
  updateTag(CACHE_TAGS.settings);
  return null;
}

/** Choose this week's Match of the Week, or null to go back to the automatic pick. */
export async function setMotwOverride(matchId: string | null): Promise<ActionResult> {
  const error = await saveSetting("motw_override", matchId);
  if (error) return { error };
  return { message: matchId ? "Match of the Week chosen." : "Back to the automatic pick." };
}

/** Site-wide crest switch: off hides every crest at once. */
export async function setShowCrests(show: boolean): Promise<ActionResult> {
  const error = await saveSetting("show_crests", show);
  if (error) return { error };
  return { message: show ? "Crests are showing." : "Crests are hidden everywhere." };
}

const CREST_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
const CREST_MAX_BYTES = 512 * 1024;

/** Upload a team's crest to the public "crests" bucket. PNG, WebP or JPEG, 512 KB at most. */
export async function uploadCrest(form: FormData): Promise<ActionResult> {
  const supabase = await admin();
  const teamId = String(form.get("teamId") ?? "");
  const file = form.get("crest");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  const ext = CREST_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, WebP or JPEG image." };
  if (file.size > CREST_MAX_BYTES)
    return { error: "That image is over 512 KB. Use a smaller one." };
  const { data: team } = await supabase.from("teams").select("slug").eq("id", teamId).single();
  if (!team) return { error: "That team wasn't found." };

  // A new name each time, so browsers and the CDN never show the old crest.
  const path = `${team.slug}-${Date.now()}.${ext}`;
  const storage = createAdminClient().storage.from("crests");
  const { error: upErr } = await storage.upload(path, file, { contentType: file.type });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };
  const url = storage.getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("teams").update({ crest_url: url }).eq("id", teamId);
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Crest saved." };
}

export async function removeCrest(teamId: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("teams").update({ crest_url: null }).eq("id", teamId);
  if (error) return { error: error.message };
  refreshPublicPages();
  return { message: "Crest removed." };
}

/** After changing data straight in Supabase (SQL Editor): show it on the site now. */
export async function refreshSite(): Promise<ActionResult> {
  await admin();
  updateTag(CACHE_TAGS.matches);
  updateTag(CACHE_TAGS.predictions);
  updateTag(CACHE_TAGS.teamRatings);
  updateTag(CACHE_TAGS.picks);
  updateTag(CACHE_TAGS.settings);
  updateTag(CACHE_TAGS.news);
  return { message: "Done. Every page now shows the latest data." };
}

// ---------------------------------------------------------------------------
// Data check: fixes suggested by the scheduled check, applied one tap each
// ---------------------------------------------------------------------------
async function decide(id: string, status: "applied" | "dismissed"): Promise<string | null> {
  const supabase = await admin();
  const viewer = await getViewer();
  const { error } = await supabase
    .from("data_suggestions")
    .update({ status, decided_at: new Date().toISOString(), decided_by: viewer?.id ?? null })
    .eq("id", id)
    .eq("status", "pending");
  return error?.message ?? null;
}

/** Apply a suggested fix through the same action an admin would use by hand. */
export async function applySuggestion(id: string): Promise<ActionResult> {
  const supabase = await admin();
  const { data: s, error } = await supabase
    .from("data_suggestions")
    .select("id,kind,match_id,team_id,payload,status")
    .eq("id", id)
    .single();
  if (error || !s) return { error: "That suggestion wasn't found." };
  if (s.status !== "pending") return { error: "That suggestion was already handled." };
  const p = s.payload as Record<string, unknown>;
  let result: ActionResult;

  if (s.kind === "result") {
    result = await saveResult({
      matchId: s.match_id!,
      status: "played",
      homeGoals: Number(p.home_goals),
      awayGoals: Number(p.away_goals),
    });
  } else if (s.kind === "postponed") {
    result = await saveResult({
      matchId: s.match_id!,
      status: "postponed",
      homeGoals: null,
      awayGoals: null,
      newDate: String(p.date),
      newTime: String(p.time),
    });
  } else if (s.kind === "kickoff") {
    const { data: m } = await supabase
      .from("matches")
      .select("season_id,matchdays(number)")
      .eq("id", s.match_id!)
      .single();
    const md = (m?.matchdays as { number: number } | null)?.number;
    if (!m || !md) return { error: "That match has no matchday; set its time in Fixtures." };
    result = await updateFixture({
      matchId: s.match_id!,
      seasonId: m.season_id,
      date: String(p.date),
      time: String(p.time),
      matchday: md,
    });
  } else {
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_current", true)
      .single();
    if (!season) return { error: "No current season." };
    result = await addDeduction({
      seasonId: season.id,
      teamId: s.team_id!,
      points: Number(p.points ?? 0),
      goals: Number(p.goals ?? 0),
      reason: String(p.reason),
    });
  }
  if (result.error) return result;
  const failed = await decide(id, "applied");
  return failed
    ? { error: failed }
    : { ...result, message: `Applied. ${result.message ?? ""}`.trim() };
}

export async function dismissSuggestion(id: string): Promise<ActionResult> {
  const failed = await decide(id, "dismissed");
  return failed ? { error: failed } : { message: "Dismissed." };
}

// ---------------------------------------------------------------------------
// News images: generic pictures per news category
// ---------------------------------------------------------------------------
const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

export async function uploadNewsImage(form: FormData): Promise<ActionResult> {
  const supabase = await admin();
  const viewer = await getViewer();
  const category = String(form.get("category") ?? "");
  const source = String(form.get("source") ?? "").trim();
  const file = form.get("image");
  if (!ALL_CATEGORIES.some((c) => c.key === category)) return { error: "Choose a category." };
  if (!source) return { error: "Say where the image came from (tool or library, and the link)." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, WebP or JPEG image." };
  if (file.size > IMAGE_MAX_BYTES)
    return { error: "That image is over 1.5 MB. Use a smaller one." };

  const path = `${category}/${Date.now()}.${ext}`;
  const storage = createAdminClient().storage.from("news-images");
  const { error: upErr } = await storage.upload(path, file, { contentType: file.type });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };
  const { error } = await supabase.from("news_images").insert({
    category,
    url: storage.getPublicUrl(path).data.publicUrl,
    storage_path: path,
    source: source.slice(0, 300),
    created_by: viewer?.id ?? null,
  });
  if (error) return { error: error.message };
  updateTag(CACHE_TAGS.news);
  return { message: "Image added." };
}

export async function deleteNewsImage(id: string): Promise<ActionResult> {
  const supabase = await admin();
  const { data: img } = await supabase
    .from("news_images")
    .select("storage_path")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("news_images").delete().eq("id", id);
  if (error) return { error: error.message };
  if (img?.storage_path)
    await createAdminClient().storage.from("news-images").remove([img.storage_path]);
  updateTag(CACHE_TAGS.news);
  return { message: "Image removed." };
}
