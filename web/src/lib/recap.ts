import "server-only";

import { SITE_NAME, SUBSTACK_URL } from "@/config/site";
import { getFrozenPredictions, getLatestPredictions, getLeaderboard, type Match } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { publicEnv } from "@/lib/env";
import { deadlineWords } from "@/lib/email/preview";
import { hasResult, likeliest, outcomeOf } from "@/lib/football";
import { ordinal } from "@/lib/format";

export type Recap = {
  md: number;
  played: number;
  notes: string; // Markdown for the Substack draft
  posts: string[]; // X drafts, each 280 characters or fewer
};

type Row = { teamId: string; pts: number; gd: number; gf: number; name: string };

/** League positions from a set of results (deductions left out: this is for "who moved"). */
function positions(
  results: Match[],
  teamIds: string[],
  names: Map<string, string>,
): Map<string, number> {
  const t = new Map<string, Row>(
    teamIds.map((id) => [id, { teamId: id, pts: 0, gd: 0, gf: 0, name: names.get(id) ?? "" }]),
  );
  for (const m of results) {
    const h = t.get(m.homeId)!,
      a = t.get(m.awayId)!;
    h.gf += m.homeGoals!;
    a.gf += m.awayGoals!;
    h.gd += m.homeGoals! - m.awayGoals!;
    a.gd += m.awayGoals! - m.homeGoals!;
    if (m.homeGoals! > m.awayGoals!) h.pts += 3;
    else if (m.homeGoals! < m.awayGoals!) a.pts += 3;
    else {
      h.pts++;
      a.pts++;
    }
  }
  const sorted = [...t.values()].sort(
    (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name),
  );
  return new Map(sorted.map((r, i) => [r.teamId, i + 1]));
}

const fit = (s: string) => (s.length <= 280 ? s : `${s.slice(0, 277)}...`);

/** Everything worth writing about one matchday, as article notes and X drafts. Uses published data only. */
export async function buildRecap(md: number, now: number): Promise<Recap | null> {
  const ctx = await getContext();
  const [frozen, latest] = await Promise.all([getFrozenPredictions(), getLatestPredictions()]);
  const site = publicEnv.siteUrl;
  const name = (id: string) => ctx.teams.get(id)!.name;
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const day = season.filter((m) => m.matchday === md);
  if (!day.length) return null;
  const results = day.filter(hasResult);
  const notes: string[] = [`# Matchday ${md} in numbers`, ""];
  const posts: string[] = [];

  // Model record against always picking home (frozen predictions only).
  const scored = results.filter((m) => frozen[m.id]);
  if (scored.length) {
    const right = scored.filter((m) => likeliest(frozen[m.id]) === outcomeOf(m)).length;
    const home = scored.filter((m) => outcomeOf(m) === "home").length;
    notes.push(
      `- **Model:** the most likely result came in ${right} of ${scored.length} times (always picking home: ${home} of ${scored.length}).`,
    );
    posts.push(
      fit(
        `Matchday ${md}: our model's most likely result came in ${right}/${scored.length}. Always picking home: ${home}/${scored.length}. Every prediction is scored in public: ${site}/accuracy`,
      ),
    );
  }

  // Biggest upsets: results the model gave the lowest chance.
  const chanceOf = (m: Match) => {
    const p = frozen[m.id];
    const o = outcomeOf(m)!;
    return Number(o === "home" ? p.p_home : o === "draw" ? p.p_draw : p.p_away);
  };
  const upsets = scored
    .filter((m) => chanceOf(m) <= 0.3)
    .sort((a, b) => chanceOf(a) - chanceOf(b))
    .slice(0, 3);
  const describe = (m: Match) =>
    outcomeOf(m) === "draw"
      ? `${name(m.homeId)} ${m.homeGoals}–${m.awayGoals} ${name(m.awayId)} (a draw)`
      : outcomeOf(m) === "away"
        ? `${name(m.awayId)} won ${m.awayGoals}–${m.homeGoals} at ${name(m.homeId)}`
        : `${name(m.homeId)} beat ${name(m.awayId)} ${m.homeGoals}–${m.awayGoals}`;
  for (const m of upsets)
    notes.push(
      `- **Upset:** ${describe(m)}. The model gave that ${Math.round(chanceOf(m) * 100)}%. ${site}/match/${m.id}`,
    );
  if (upsets[0])
    posts.push(
      fit(
        `Upset of Matchday ${md}: ${describe(upsets[0])}. The numbers gave it just ${Math.round(chanceOf(upsets[0]) * 100)}%. ${site}/match/${upsets[0].id}`,
      ),
    );

  // Upset Alerts.
  const alerts = day.filter((m) => frozen[m.id]?.upset_alert && hasResult(m));
  if (alerts.length) {
    const hits = alerts.filter((m) => outcomeOf(m) === "away");
    notes.push(
      `- **Upset Alerts:** ${hits.length} of ${alerts.length} came in${hits.length ? ` (${hits.map(describe).join("; ")})` : ""}.`,
    );
  }

  // Beat the Ballboy.
  const mdId = day.find((m) => m.matchdayId)?.matchdayId;
  if (mdId) {
    const rows = await getLeaderboard("matchday", mdId);
    const ballboy = rows.find((r) => r.isBallboy);
    const fans = rows.filter((r) => !r.isBallboy);
    if (fans.length && ballboy) {
      const beat = fans.filter((r) => r.points > ballboy.points).length;
      const avg = fans.reduce((a, r) => a + r.points, 0) / fans.length;
      notes.push(
        `- **Beat the Ballboy:** The Ballboy scored ${ballboy.points}. Fans averaged ${avg.toFixed(1)}; ${beat} of ${fans.length} beat it. Top score: ${fans[0].name} with ${fans[0].points}.`,
      );
      posts.push(
        fit(
          `${beat} of ${fans.length} fans beat The Ballboy on Matchday ${md}. Top score: ${fans[0].name} with ${fans[0].points} points. Free to play: ${site}/pick-all`,
        ),
      );
    }
  }

  // Table: who moved.
  const teamIds = [...new Set(season.flatMap((m) => [m.homeId, m.awayId]))];
  const names = new Map(teamIds.map((id) => [id, name(id)]));
  const first = Math.min(...day.map((m) => Date.parse(m.kickoff)));
  const last = Math.max(...results.map((m) => Date.parse(m.kickoff)), first);
  const before = positions(
    season.filter((m) => hasResult(m) && Date.parse(m.kickoff) < first),
    teamIds,
    names,
  );
  const after = positions(
    season.filter((m) => hasResult(m) && Date.parse(m.kickoff) <= last),
    teamIds,
    names,
  );
  const moves = teamIds.map((id) => ({
    id,
    from: before.get(id)!,
    to: after.get(id)!,
    by: before.get(id)! - after.get(id)!,
  }));
  const leader = [...after].find(([, p]) => p === 1)?.[0];
  const up = [...moves].sort((a, b) => b.by - a.by)[0];
  const down = [...moves].sort((a, b) => a.by - b.by)[0];
  if (leader)
    notes.push(
      `- **Table:** ${name(leader)} top.${up?.by > 0 ? ` Biggest climb: ${name(up.id)}, ${ordinal(up.from)} to ${ordinal(up.to)}.` : ""}${down?.by < 0 ? ` Biggest drop: ${name(down.id)}, ${ordinal(down.from)} to ${ordinal(down.to)}.` : ""}`,
    );

  // Next matchday.
  const nextDay = [
    ...new Set(
      season
        .filter((m) => (m.matchday ?? 0) > md && Date.parse(m.kickoff) > now)
        .map((m) => m.matchday!),
    ),
  ].sort((a, b) => a - b)[0];
  if (nextDay) {
    const nextMatches = season.filter((m) => m.matchday === nextDay);
    const firstKick = nextMatches.reduce((a, b) =>
      Date.parse(a.kickoff) < Date.parse(b.kickoff) ? a : b,
    );
    const nextAlerts = nextMatches
      .filter((m) => latest[m.id]?.upset_alert)
      .sort((a, b) => Number(latest[b.id].p_away) - Number(latest[a.id].p_away))
      .slice(0, 2);
    notes.push(
      `- **Next:** Matchday ${nextDay}, picks close ${deadlineWords(firstKick.kickoff, firstKick.timeConfirmed)}.`,
    );
    for (const m of nextAlerts) {
      const p = Math.round(Number(latest[m.id].p_away) * 100);
      notes.push(
        `  - Upset Alert: ${name(m.awayId)} at ${name(m.homeId)}, ${p}% chance of an away win. ${site}/match/${m.id}`,
      );
    }
    if (nextAlerts[0]) {
      const m = nextAlerts[0];
      posts.push(
        fit(
          `Matchday ${nextDay} Upset Alert: ${name(m.awayId)} at ${name(m.homeId)}. ${Math.round(Number(latest[m.id].p_away) * 100)}% chance of an away win. Can you call it? ${site}/match/${m.id}`,
        ),
      );
    }
  }

  notes.push("", `Read the numbers on ${SITE_NAME}: ${site} · Full article: ${SUBSTACK_URL}`);
  posts.push(
    fit(`New on the Substack: what Matchday ${md} told us about the NPFL. ${SUBSTACK_URL}`),
  );
  return { md, played: results.length, notes: notes.join("\n"), posts };
}
