import { timingSafeEqual } from "node:crypto";

import { getContext } from "@/lib/data/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Where the scheduled NPFL data check (a Claude run) sends the fixes it
 * suggests. They wait in /admin → Data check until an admin applies or
 * dismisses each one: nothing here changes results, fixtures or the table.
 *
 * Auth: `Authorization: Bearer <DATA_CHECK_SECRET>`.
 * Body: { "check_date": "YYYY-MM-DD", "items": [Item, ...] } (100 at most), where Item is
 *   { "kind": "result", "match_id", "home_goals", "away_goals", ...common }
 *   { "kind": "postponed", "match_id", "date": "YYYY-MM-DD", "time": "HH:MM", ...common }
 *   { "kind": "kickoff", "match_id", "date", "time", ...common }
 *   { "kind": "deduction", "team_slug", "points", "goals"?, "reason", ...common }
 * and common is { "summary", "source_url"?, "confidence"?: "confirmed" | "unconfirmed" }.
 */

type Row = {
  check_date: string;
  kind: string;
  match_id: string | null;
  team_id: string | null;
  payload: Json;
  summary: string;
  source_url: string | null;
  confidence: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function authorised(request: Request): boolean {
  const secret = process.env.DATA_CHECK_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const goals = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 99;
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    check_date?: unknown;
    items?: unknown;
  } | null;
  if (!body || typeof body.check_date !== "string" || !DATE.test(body.check_date))
    return Response.json({ error: "check_date must be YYYY-MM-DD" }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length > 100)
    return Response.json({ error: "items must be a list of at most 100" }, { status: 400 });

  const ctx = await getContext();
  const matchIds = new Set(ctx.matches.map((m) => m.id));
  const rows: Row[] = [];
  const rejected: { index: number; reason: string }[] = [];

  body.items.forEach((raw, index) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const summary = text(it.summary, 500);
    const source =
      typeof it.source_url === "string" && /^https:\/\//.test(it.source_url) ? it.source_url : null;
    const confidence = it.confidence === "unconfirmed" ? "unconfirmed" : "confirmed";
    const reject = (reason: string) => rejected.push({ index, reason });
    if (!summary) return reject("summary is required");
    const base = { check_date: body.check_date as string, summary, source_url: source, confidence };

    if (it.kind === "deduction") {
      const team = typeof it.team_slug === "string" ? ctx.bySlug.get(it.team_slug) : undefined;
      const reason = text(it.reason, 200);
      if (!team) return reject("unknown team_slug");
      const pts = it.points ?? 0;
      const gls = it.goals ?? 0;
      const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 30;
      if (!ok(pts) || !ok(gls) || (pts as number) + (gls as number) < 1)
        return reject("points and goals must be whole numbers from 0 to 30, not both 0");
      if (!reason) return reject("reason is required");
      rows.push({
        ...base,
        kind: "deduction",
        match_id: null,
        team_id: team.id,
        payload: { points: pts as number, goals: gls as number, reason },
      });
      return;
    }

    const matchId = typeof it.match_id === "string" && UUID.test(it.match_id) ? it.match_id : "";
    if (!matchIds.has(matchId)) return reject("unknown match_id");
    if (it.kind === "result") {
      if (!goals(it.home_goals) || !goals(it.away_goals))
        return reject("home_goals and away_goals must be whole numbers");
      rows.push({
        ...base,
        kind: "result",
        match_id: matchId,
        team_id: null,
        payload: { home_goals: it.home_goals as number, away_goals: it.away_goals as number },
      });
    } else if (it.kind === "postponed" || it.kind === "kickoff") {
      const date = typeof it.date === "string" && DATE.test(it.date) ? it.date : null;
      const time = typeof it.time === "string" && TIME.test(it.time) ? it.time : null;
      if (!date || !time) return reject("date (YYYY-MM-DD) and time (HH:MM, Lagos) are required");
      rows.push({
        ...base,
        kind: it.kind,
        match_id: matchId,
        team_id: null,
        payload: { date, time },
      });
    } else {
      reject("kind must be result, postponed, kickoff or deduction");
    }
  });

  // Skip anything already waiting with the same fix.
  const db = createAdminClient();
  const { data: pending, error: readError } = await db
    .from("data_suggestions")
    .select("kind,match_id,team_id,payload")
    .eq("status", "pending");
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  // The database reorders JSON keys, so compare with sorted keys.
  const sorted = (p: Json) =>
    Object.fromEntries(
      Object.entries((p ?? {}) as Record<string, Json>).sort(([a], [b]) => a.localeCompare(b)),
    );
  const key = (r: Pick<Row, "kind" | "match_id" | "team_id" | "payload">) =>
    JSON.stringify([r.kind, r.match_id, r.team_id, sorted(r.payload)]);
  const waiting = new Set((pending ?? []).map(key));
  const fresh = rows.filter((r) => !waiting.has(key(r)));

  if (fresh.length) {
    const { error } = await db.from("data_suggestions").insert(fresh);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({
    added: fresh.length,
    already_waiting: rows.length - fresh.length,
    rejected,
  });
}
