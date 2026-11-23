// Stage 5 end-to-end test. Run by supabase/tests/run_e2e.sh against a
// throwaway local stack, never the real project.
//
// A fan signs up and picks Home with an exact score; a guest taps Draw, is
// sent to sign up and comes back with the pick saved; picks lock at kick-off
// (in the page and in the database); the admin enters the result and the
// points match the formula; a correction rescores.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const { BASE, API, ANON_KEY, DB_URL } = process.env;
const KICKOFF_IN_SECONDS = 75;
const P = { home: 0.65, draw: 0.26, away: 0.09 };
const points = (p) => Math.min(10, Math.max(1, Math.round(1 / p)));

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
const sql = (q) => execFileSync("psql", [DB_URL, "-Atq", "-c", q]).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token(email, password) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).access_token;
}
async function rest(method, path, jwt, body) {
  const r = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, rows: r.ok && text ? JSON.parse(text) : [], text };
}
async function revalidate(tags) {
  await fetch(`${BASE}/api/revalidate`, {
    method: "POST",
    headers: { Authorization: "Bearer e2e-revalidate", "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
}
const pickOf = (who) =>
  sql(`select k.outcome || ':' || coalesce(k.pred_home_goals::text,'') || '-' || coalesce(k.pred_away_goals::text,'') || ':' ||
       coalesce(k.points_awarded::text,'null')
       from public.picks k join public.profiles p on p.id = k.user_id
       where p.display_name = '${who}' and k.match_id = '${MATCH}'`);

// --- A match kicking off soon, with a known prediction ------------------------
const kickoff = new Date(Date.now() + KICKOFF_IN_SECONDS * 1000);
const MATCH = sql(`
  with s as (select id from public.seasons where is_current),
  md as (insert into public.matchdays (season_id, number) select id, 3 from s
         on conflict (season_id, number) do update set number = excluded.number returning id),
  run as (insert into public.model_runs (trigger, status) values ('manual', 'done') returning id),
  m as (insert into public.matches (season_id, matchday_id, home_team_id, away_team_id, kickoff_at, kickoff_time_confirmed)
        select s.id, md.id, (select id from public.teams where name = 'Remo Stars'),
               (select id from public.teams where name = 'Wikki Tourists'), '${kickoff.toISOString()}', true
        from s, md returning id)
  insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home, xg_away, top_scores, reasons)
  select m.id, run.id, ${P.home}, ${P.draw}, ${P.away}, 1.9, 0.6, '[{"home":2,"away":0,"p":0.15}]',
         '["Remo Stars rated 2nd, Wikki Tourists 19th"]'
  from m, run returning match_id`).split("\n")[0];
await revalidate(["matches", "predictions"]);
console.log(`Match ${MATCH} kicks off at ${kickoff.toISOString()}`);

const browser = await chromium.launch();
const fan = await browser.newContext({ viewport: { width: 360, height: 780 } });
const guest = await browser.newContext({ viewport: { width: 360, height: 780 } });
const page = await fan.newPage();

try {
  // --- 1. Sign up ------------------------------------------------------------
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Display name (shown on the leaderboard)").fill("E2E Fan");
  await page.getByLabel("Email", { exact: true }).fill("fan@e2e.invalid");
  await page.getByLabel("Password (at least 8 characters)").fill("fan-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/me`);
  await page
    .getByRole("heading", { level: 1, name: "E2E Fan" })
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  check(
    "signed up and signed in",
    (await page.getByRole("heading", { level: 1, name: "E2E Fan" }).count()) === 1,
  );
  check(
    "weekly email is off unless ticked",
    sql(`select email_opt_in from public.profiles where display_name = 'E2E Fan'`) === "f",
  );

  // --- 2. Pick Home with an exact score --------------------------------------
  await page.goto(`${BASE}/match/${MATCH}`);
  const homeBtn = page.getByRole("button", { name: `Remo Stars ${points(P.home)} pts` });
  await homeBtn.waitFor();
  check(
    "buttons show the points: 2 / 4 / 10",
    (await page.getByRole("button", { name: `Draw ${points(P.draw)} pts` }).count()) === 1 &&
      (await page.getByRole("button", { name: `Wikki Tourists ${points(P.away)} pts` }).count()) ===
        1,
  );
  await page.getByText("Add an exact score (+3 points)").click();
  await page.getByRole("spinbutton", { name: "Remo Stars" }).fill("2");
  await page.getByRole("spinbutton", { name: "Wikki Tourists" }).fill("0");
  await homeBtn.click();
  await page.getByText("Your pick: Home (Remo Stars), 2–0").waitFor();
  check("pick saved with exact score", pickOf("E2E Fan") === "home:2-0:null", pickOf("E2E Fan"));

  // --- 3. A guest's tap is kept through sign-up ------------------------------
  const g = await guest.newPage();
  await g.goto(`${BASE}/match/${MATCH}`);
  const drawBtn = g.getByRole("button", { name: `Draw ${points(P.draw)} pts` });
  await drawBtn.waitFor();
  await g.waitForFunction(
    () => !document.querySelector('[aria-label="Your pick"] button[disabled]'),
  );
  await drawBtn.click();
  await g.waitForURL(/\/login\?/);
  check(
    "guest sent to log in with the pick",
    g.url().includes(`pick=${MATCH}%3Adraw`) || g.url().includes(`pick=${MATCH}:draw`),
    g.url(),
  );
  await g.getByRole("link", { name: "Create an account" }).click();
  await g.waitForURL(/\/signup\?/);
  // Next keeps the previous page alive but hidden, so scope to the sign-up form.
  const form = g.locator("form").filter({ has: g.getByRole("button", { name: "Create account" }) });
  await form.waitFor();
  await form.getByLabel("Display name (shown on the leaderboard)").fill("E2E Guest");
  await form.getByLabel("Email", { exact: true }).fill("guest@e2e.invalid");
  await form.getByLabel("Password (at least 8 characters)").fill("guest-password-1");
  await form.getByRole("button", { name: "Create account" }).click();
  await g.waitForURL(`${BASE}/match/${MATCH}`);
  check(
    "guest returned with the pick saved",
    pickOf("E2E Guest") === "draw:-:null",
    pickOf("E2E Guest"),
  );

  // --- 4. Picks lock at kick-off ---------------------------------------------
  const wait = kickoff.getTime() - Date.now() + 2000;
  console.log(`Waiting ${Math.round(wait / 1000)}s for kick-off…`);
  await sleep(Math.max(0, wait));
  await page.goto(`${BASE}/match/${MATCH}`);
  await page.getByText("Your pick: Home (Remo Stars), 2–0").waitFor();
  check(
    "after kick-off the page shows the pick read-only",
    (await page.getByRole("button", { name: /pts$/ }).count()) === 0,
  );
  const fanJwt = await token("fan@e2e.invalid", "fan-password-1");
  const late = await rest("PATCH", `picks?match_id=eq.${MATCH}`, fanJwt, { outcome: "away" });
  check(
    "the database refuses a change after kick-off",
    late.rows.length === 0,
    `${late.status} ${late.text}`,
  );
  check("pick unchanged", pickOf("E2E Fan") === "home:2-0:null", pickOf("E2E Fan"));
  const fanResult = await rest("PATCH", `matches?id=eq.${MATCH}`, fanJwt, {
    status: "played",
    home_goals: 9,
    away_goals: 9,
  });
  check(
    "a fan cannot enter results",
    fanResult.rows.length === 0,
    `${fanResult.status} ${fanResult.text}`,
  );

  // --- 5. The admin enters the result: 2-0 -------------------------------------
  const adminJwt = await token("admin@e2e.invalid", "admin-password-1");
  const saved = await rest("PATCH", `matches?id=eq.${MATCH}`, adminJwt, {
    status: "played",
    home_goals: 2,
    away_goals: 0,
  });
  check("admin saves the result", saved.rows.length === 1, `${saved.status} ${saved.text}`);
  const want = points(P.home) + 3;
  check(
    `fan: correct Home with exact score = round(1/0.65) + 3 = ${want}`,
    pickOf("E2E Fan") === `home:2-0:${want}`,
    pickOf("E2E Fan"),
  );
  check("guest: wrong Draw = 0", pickOf("E2E Guest") === "draw:-:0", pickOf("E2E Guest"));
  await page.goto(`${BASE}/me`);
  check("Me page shows the points", (await page.getByText(`${want} pts`).count()) >= 1);

  // --- 6. A correction rescores: 1-1 -------------------------------------------
  const fixed = await rest("PATCH", `matches?id=eq.${MATCH}`, adminJwt, {
    home_goals: 1,
    away_goals: 1,
  });
  check("admin corrects the result", fixed.rows.length === 1, `${fixed.status} ${fixed.text}`);
  check("fan rescored to 0", pickOf("E2E Fan") === "home:2-0:0", pickOf("E2E Fan"));
  check(
    `guest rescored to round(1/0.26) = ${points(P.draw)}`,
    pickOf("E2E Guest") === `draw:-:${points(P.draw)}`,
    pickOf("E2E Guest"),
  );
  await page.goto(`${BASE}/me`);
  check("Me page shows the corrected points", (await page.getByText("0 pts").count()) >= 1);

  // --- 7. Leaderboard --------------------------------------------------------
  await revalidate(["picks", "matches"]);
  await page.goto(`${BASE}/leaderboard?tab=all`);
  const first = page.locator("tbody tr").first();
  check(
    "leaderboard: guest on top with 4",
    ((await first.textContent()) ?? "").includes("E2E Guest") &&
      ((await first.textContent()) ?? "").includes(String(points(P.draw))),
    await first.textContent(),
  );
  check(
    "leaderboard: The Ballboy is listed",
    (await page.getByText("To beat", { exact: true }).count()) === 1,
  );
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll end-to-end checks passed");
process.exit(failures ? 1 : 0);
