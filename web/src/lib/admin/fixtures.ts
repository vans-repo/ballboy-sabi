import "server-only";

import {
  lagosToUtc,
  normaliseName,
  parseCsv,
  parseDate,
  parseTime,
  UNANNOUNCED_TIME,
} from "@/lib/admin/csv";
import { createClient } from "@/lib/supabase/server";

export type PreviewRow = {
  line: number;
  date: string;
  time: string;
  home: string;
  away: string;
  matchday: string;
  homeId?: string;
  awayId?: string;
  kickoff?: string;
  timeConfirmed?: boolean;
  errors: string[];
  existing: boolean; // this pairing is already in the season: skipped
};

/**
 * Check every row of a fixtures CSV for one season. Team names resolve
 * through team_aliases only. Nothing is written.
 */
export async function previewFixtures(
  seasonId: string,
  csv: string,
): Promise<{ rows: PreviewRow[]; fileErrors: string[] }> {
  const supabase = await createClient();
  const { header, rows } = parseCsv(csv);
  const missing = ["date", "time", "home", "away", "matchday"].filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], fileErrors: [`Missing columns: ${missing.join(", ")}`] };
  if (!rows.length) return { rows: [], fileErrors: ["The file has no fixtures."] };

  const [{ data: aliases }, { data: existing }] = await Promise.all([
    supabase.from("team_aliases").select("alias,team_id"),
    supabase.from("matches").select("home_team_id,away_team_id").eq("season_id", seasonId),
  ]);
  const byAlias = new Map((aliases ?? []).map((a) => [a.alias, a.team_id]));
  const inSeason = new Set((existing ?? []).map((m) => `${m.home_team_id}/${m.away_team_id}`));
  const seen = new Map<string, number>();

  const out: PreviewRow[] = rows.map(({ line, values: v }) => {
    const row: PreviewRow = {
      line, date: v.date, time: v.time, home: v.home, away: v.away, matchday: v.matchday, errors: [], existing: false,
    }; // prettier-ignore
    const date = parseDate(v.date);
    if (!date) row.errors.push("Date must be YYYY-MM-DD or DD/MM/YYYY.");
    const time = v.time ? parseTime(v.time) : null;
    if (v.time && !time)
      row.errors.push("Time must be 24-hour HH:MM (Lagos time), or blank if not announced.");
    if (!/^\d+$/.test(v.matchday) || +v.matchday < 1)
      row.errors.push("Matchday must be a whole number from 1.");
    row.homeId = byAlias.get(normaliseName(v.home));
    row.awayId = byAlias.get(normaliseName(v.away));
    if (!row.homeId)
      row.errors.push(`Unknown team "${v.home}". Add it as an alias in Teams & Seasons.`);
    if (!row.awayId)
      row.errors.push(`Unknown team "${v.away}". Add it as an alias in Teams & Seasons.`);
    if (row.homeId && row.homeId === row.awayId) row.errors.push("A team can't play itself.");
    if (row.homeId && row.awayId) {
      const key = `${row.homeId}/${row.awayId}`;
      if (seen.has(key)) row.errors.push(`Same match as line ${seen.get(key)}.`);
      seen.set(key, line);
      row.existing = inSeason.has(key);
    }
    if (date) {
      row.kickoff = lagosToUtc(date, time ?? UNANNOUNCED_TIME);
      row.timeConfirmed = time !== null;
    }
    return row;
  });
  return { rows: out, fileErrors: [] };
}

/** Find or create a season's matchday row. */
export async function matchdayId(seasonId: string, number: number): Promise<string> {
  const supabase = await createClient();
  const { data: found } = await supabase
    .from("matchdays")
    .select("id")
    .eq("season_id", seasonId)
    .eq("number", number)
    .maybeSingle();
  if (found) return found.id;
  const { data, error } = await supabase
    .from("matchdays")
    .insert({ season_id: seasonId, number })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
