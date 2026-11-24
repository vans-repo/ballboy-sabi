import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/supabase/database.types";

/*
 * Every public read goes through here. Results are cached across requests
 * and tagged, so a model run (predictions, team-ratings) or a saved result
 * (matches) refreshes exactly the pages that use them.
 */

export type Season = Pick<
  Tables<"seasons">,
  "id" | "label" | "start_date" | "end_date" | "is_current"
>;
export type Team = Pick<
  Tables<"teams">,
  "id" | "name" | "code" | "slug" | "primary_colour" | "secondary_colour" | "city" | "crest_url"
>;
export type MatchStatus = Tables<"matches">["status"];
export type Prediction = Pick<
  Tables<"predictions">,
  "p_home" | "p_draw" | "p_away" | "xg_home" | "xg_away" | "upset_alert" | "created_at"
> & {
  top_scores: { home: number; away: number; p: number }[];
  reasons: string[];
};
export type Match = {
  id: string;
  seasonId: string;
  matchday: number | null;
  matchdayId: string | null;
  homeId: string;
  awayId: string;
  kickoff: string; // ISO, UTC
  kickoffEstimated: boolean;
  timeConfirmed: boolean;
  sourceOrder: number | null;
  status: MatchStatus;
  homeGoals: number | null;
  awayGoals: number | null;
  notes: string | null;
  /** Official YouTube video for the match (livestream, highlights or replay). */
  videoUrl: string | null;
  videoLabel: "live" | "highlights" | "replay" | null;
};
export type TableRow = {
  position: number;
  teamId: string;
  group: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  pointsDeducted: number;
  /** Goals taken off goal difference by the league (already applied to goalDifference). */
  goalsDeducted: number;
  deductionNotes: string | null;
  form: string;
};
export type Rating = { matchId: string; ratedAt: string; elo: number };
export type WalkForward = {
  model_version: string;
  seasons: string[];
  matches: number;
  blend: { log_loss: number; brier: number; accuracy: number };
  league_average: { log_loss: number; brier: number; accuracy: number };
  always_home_accuracy: number;
  calibration: { bucket: string; matches: number; predicted: number; actual: number }[];
};

const PAGE = 1000;

/** Supabase returns at most 1000 rows per request: page through the rest. */
async function all<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getSeasons(): Promise<Season[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const { data, error } = await createPublicClient()
    .from("seasons")
    .select("id,label,start_date,end_date,is_current")
    .order("start_date");
  if (error) throw new Error(error.message);
  return data;
}

export type SiteSettings = {
  /** Site-wide switch: false hides every crest at once (for a quick takedown). */
  showCrests: boolean;
  /** The admin's Match of the Week choice, or null for the automatic pick. */
  motwOverride: string | null;
};

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const { data, error } = await createPublicClient()
    .from("site_settings")
    .select("key,value")
    .in("key", ["show_crests", "motw_override"]);
  if (error) throw new Error(error.message);
  const v = new Map(data.map((r) => [r.key, r.value]));
  const override = v.get("motw_override");
  return {
    showCrests: v.get("show_crests") !== false,
    motwOverride: typeof override === "string" ? override : null,
  };
}

/** Every team. Crests are left out while the "Show crests" switch is off. */
export async function getTeams(): Promise<Team[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.settings);
  const [{ data, error }, settings] = await Promise.all([
    createPublicClient()
      .from("teams")
      .select("id,name,code,slug,primary_colour,secondary_colour,city,crest_url")
      .order("name"),
    getSettings(),
  ]);
  if (error) throw new Error(error.message);
  return settings.showCrests ? data : data.map((t) => ({ ...t, crest_url: null }));
}

/** Every match in every season, oldest first. About 2,100 rows. */
export async function getAllMatches(): Promise<Match[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const client = createPublicClient();
  const [rows, matchdays] = await Promise.all([
    all((from, to) =>
      client
        .from("matches")
        .select(
          "id,season_id,matchday_id,home_team_id,away_team_id,kickoff_at,kickoff_estimated," +
            "kickoff_time_confirmed,source_order,status,home_goals,away_goals,notes,video_url,video_label",
        )
        .order("kickoff_at")
        .order("source_order", { nullsFirst: false })
        .order("id")
        .range(from, to)
        .returns<Tables<"matches">[]>(),
    ),
    all((from, to) => client.from("matchdays").select("id,number").range(from, to)),
  ]);
  const number = new Map(matchdays.map((m) => [m.id, m.number]));
  return rows.map((m) => ({
    id: m.id,
    seasonId: m.season_id,
    matchday: m.matchday_id ? (number.get(m.matchday_id) ?? null) : null,
    matchdayId: m.matchday_id,
    homeId: m.home_team_id,
    awayId: m.away_team_id,
    kickoff: m.kickoff_at,
    kickoffEstimated: m.kickoff_estimated,
    timeConfirmed: m.kickoff_time_confirmed,
    sourceOrder: m.source_order,
    status: m.status,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    notes: m.notes,
    videoUrl: m.video_url,
    videoLabel: m.video_label as Match["videoLabel"],
  }));
}

type PredictionRow = Prediction & { match_id: string };
const PREDICTION_COLUMNS =
  "match_id,p_home,p_draw,p_away,xg_home,xg_away,top_scores,reasons,upset_alert,created_at";

/** The newest prediction for every match that has one (what upcoming cards show). */
export async function getLatestPredictions(): Promise<Record<string, Prediction>> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.predictions);
  const client = createPublicClient();
  const rows = await all((from, to) =>
    client
      .from("latest_predictions")
      .select(PREDICTION_COLUMNS)
      .order("match_id")
      .range(from, to)
      .returns<PredictionRow[]>(),
  );
  return Object.fromEntries(rows.map(({ match_id, ...p }) => [match_id, p]));
}

/** The prediction frozen at kick-off, for matches that have started. Used for every right/wrong mark. */
export async function getFrozenPredictions(): Promise<Record<string, Prediction>> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.predictions);
  const client = createPublicClient();
  const rows = await all((from, to) =>
    client
      .from("frozen_predictions")
      .select(PREDICTION_COLUMNS)
      .order("match_id")
      .range(from, to)
      .returns<PredictionRow[]>(),
  );
  return Object.fromEntries(rows.map(({ match_id, ...p }) => [match_id, p]));
}

export async function getLeagueTable(seasonId: string): Promise<TableRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches);
  const { data, error } = await createPublicClient()
    .from("league_table")
    .select("*")
    .eq("season_id", seasonId)
    .order("group_name", { nullsFirst: true })
    .order("position");
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    position: r.position ?? 0,
    teamId: r.team_id ?? "",
    group: r.group_name,
    played: r.played ?? 0,
    won: r.won ?? 0,
    drawn: r.drawn ?? 0,
    lost: r.lost ?? 0,
    goalsFor: r.goals_for ?? 0,
    goalsAgainst: r.goals_against ?? 0,
    goalDifference: r.goal_difference ?? 0,
    points: r.points ?? 0,
    pointsDeducted: r.points_deducted ?? 0,
    goalsDeducted: r.goals_deducted ?? 0,
    deductionNotes: r.deduction_notes,
    form: r.form ?? "",
  }));
}

/** Elo after every match a team played, oldest first. */
export async function getTeamRatings(teamId: string): Promise<Rating[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.teamRatings);
  const client = createPublicClient();
  const rows = await all((from, to) =>
    client
      .from("team_ratings")
      .select("match_id,rated_at,elo")
      .eq("team_id", teamId)
      .order("rated_at")
      .range(from, to),
  );
  return rows.map((r) => ({ matchId: r.match_id, ratedAt: r.rated_at, elo: Number(r.elo) }));
}

/** Each team's latest Elo. */
export async function getCurrentElo(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.teamRatings);
  const client = createPublicClient();
  const rows = await all((from, to) =>
    client.from("team_ratings").select("team_id,rated_at,elo").order("rated_at").range(from, to),
  );
  const latest: Record<string, number> = {};
  for (const r of rows) latest[r.team_id] = Number(r.elo); // rows are oldest first
  return latest;
}

/**
 * Walk-forward test scores from the latest successful model run.
 * model_runs is admin-only (it can hold error text), so this reads with the
 * service role on the server and returns only the published scores.
 */
export async function getWalkForward(): Promise<WalkForward | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.predictions);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null; // pages show no test scores
  const { data, error } = await createAdminClient()
    .from("model_runs")
    .select("metrics,finished_at")
    .eq("status", "done")
    .not("metrics", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const metrics = data[0]?.metrics as { walk_forward?: WalkForward } | undefined;
  return metrics?.walk_forward ?? null;
}

export type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  isBallboy: boolean;
  points: number;
  correct: number;
  exact: number;
  correctAway: number;
};
export type LeaderScope = "matchday" | "season" | "all";

/** Leaderboard rows for a scope, best first. Scored picks only. */
export async function getLeaderboard(scope: LeaderScope, id: string | null): Promise<LeaderRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.picks);
  const { data, error } = await createPublicClient().rpc("leaderboard", {
    p_scope: scope,
    ...(id ? { p_id: id } : {}),
  });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    rank: r.rank,
    userId: r.user_id,
    name: r.display_name,
    isBallboy: r.is_ballboy,
    points: r.points,
    correct: r.correct,
    exact: r.exact,
    correctAway: r.correct_away,
  }));
}

/** How many fans picked each outcome. Only filled in after kick-off. */
export async function getFanSplit(
  matchId: string,
): Promise<{ home: number; draw: number; away: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.picks);
  const { data, error } = await createPublicClient().rpc("fan_split", { p_match_id: matchId });
  if (error) throw new Error(error.message);
  return data[0] ?? { home: 0, draw: 0, away: 0 };
}

export type NewsImage = { id: string; category: string; url: string; source: string };

/** Every generic news image, by category (see config/news-categories.ts). */
export async function getNewsImages(): Promise<NewsImage[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  const { data, error } = await createPublicClient()
    .from("news_images")
    .select("id,category,url,source")
    .order("created_at");
  // Images are decoration: if they can't be read (e.g. before the migration
  // has run), headlines just show without them.
  if (error) return [];
  return data;
}
