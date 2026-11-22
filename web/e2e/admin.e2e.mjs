// Stage 6 end-to-end test, run by supabase/tests/run_e2e.sh after
// picks.e2e.mjs (it reuses that test's fan account).
//
// Non-admins get a 404 on /admin. The admin saves a result: points update at
// once, a model run is dispatched to GitHub (a stand-in here), the run
// finishes (the real model job, run here as the workflow would), and the
// match page shows the result. Also: the "Are you sure?" check for big
// scores, the fixtures CSV preview, and the audit log.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const { BASE, API, DB_URL, SERVICE_KEY, ROOT, MODEL_PYTHON } = process.env;
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
const sql = (q) => execFileSync("psql", [DB_URL, "-Atq", "-c", q]).toString().trim();

async function logIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Log in" }) });
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE}/`);
}

// Two matches that kicked off an hour ago with no result, with a prediction
// from before kick-off and a fan's pick (written directly: the window is shut).
const ids = sql(`
  with s as (select id from public.seasons where is_current),
  md as (select id from public.matchdays where season_id = (select id from s) and number = 3),
  run as (insert into public.model_runs (trigger, status) values ('manual', 'done') returning id),
  m as (insert into public.matches (season_id, matchday_id, home_team_id, away_team_id, kickoff_at, kickoff_time_confirmed)
        select s.id, md.id, h.id, a.id, now() - interval '1 hour', true
        from s, md, (values ('Lobi Stars', 'Heartland'), ('Gombe United', 'Dakkada')) v(hn, an)
        join public.teams h on h.name = v.hn join public.teams a on a.name = v.an
        returning id, home_team_id),
  p as (insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home, xg_away, top_scores, reasons, created_at)
        select m.id, run.id, 0.50, 0.30, 0.20, 1.5, 1.0, '[]', '[]', now() - interval '2 hours' from m, run returning match_id)
  select m.id from m join public.teams t on t.id = m.home_team_id order by t.name desc`).split(
  "\n",
);
const [LOBI, GOMBE] = ids; // Lobi Stars v Heartland, Gombe United v Dakkada
// And one upcoming fixture, so the model run has something to predict.
sql(`insert into public.matches (season_id, matchday_id, home_team_id, away_team_id, kickoff_at)
     select s.id, d.id, (select id from public.teams where name = 'Enyimba'), (select id from public.teams where name = 'Heartland'),
            now() + interval '3 days'
     from public.seasons s join public.matchdays d on d.season_id = s.id and d.number = 3 where s.is_current`);
sql(`insert into public.picks (user_id, match_id, outcome, pred_home_goals, pred_away_goals)
     select id, '${LOBI}', 'home', 2, 0 from public.profiles where display_name = 'E2E Fan'`);
await fetch(`${BASE}/api/revalidate`, {
  method: "POST",
  headers: { Authorization: "Bearer e2e-revalidate", "Content-Type": "application/json" },
  body: JSON.stringify({ tags: ["matches", "predictions"] }),
});

const browser = await chromium.launch();
try {
  // --- 1. /admin is a 404 for guests and fans --------------------------------
  const guest = await browser.newPage();
  check("guest gets 404 on /admin", (await guest.goto(`${BASE}/admin`)).status() === 404);
  check(
    "guest gets 404 on /admin/users",
    (await guest.goto(`${BASE}/admin/users`)).status() === 404,
  );
  const fan = await (await browser.newContext()).newPage();
  await logIn(fan, "fan@e2e.invalid", "fan-password-1");
  const fanAdmin = await fan.goto(`${BASE}/admin`);
  check("signed-in fan gets 404 on /admin", fanAdmin.status() === 404, String(fanAdmin.status()));
  check(
    "fan can't read a model run's status",
    (await fan.goto(`${BASE}/api/admin/runs/${ids[0]}`)).status() === 404,
  );

  // --- 2. The admin sees what needs a result ----------------------------------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const admin = await ctx.newPage();
  await logIn(admin, "admin@e2e.invalid", "admin-password-1");
  const res = await admin.goto(`${BASE}/admin`);
  check("admin opens /admin", res.status() === 200, String(res.status()));
  const lobi = admin.locator("li").filter({ hasText: "Lobi Stars v Heartland" });
  await lobi.waitFor();
  check(
    "both waiting matches are listed",
    (await admin.locator("li").filter({ hasText: "Gombe United v Dakkada" }).count()) === 1,
  );

  // --- 3. "Are you sure?" above 6 ---------------------------------------------
  const gombe = admin.locator("li").filter({ hasText: "Gombe United v Dakkada" });
  for (let i = 0; i < 7; i++)
    await gombe.getByRole("button", { name: "Gombe United: one more" }).click();
  await gombe.getByRole("button", { name: "Save" }).click();
  await gombe.getByText("Gombe United 7–0 Dakkada").waitFor();
  await gombe.getByRole("button", { name: "Confirm" }).click();
  await gombe.getByText("Are you sure? A team scored more than 6.").waitFor();
  check("a score above 6 asks 'Are you sure?'", true);
  await gombe.getByRole("button", { name: "Back" }).click();
  check(
    "nothing saved after Back",
    sql(`select status from public.matches where id = '${GOMBE}'`) === "scheduled",
  );

  // --- 4. Save 2-0: points at once, then a model run ----------------------------
  const before = Number(sql(`select count(*) from public.predictions`));
  await lobi.getByRole("button", { name: "Lobi Stars: one more" }).click();
  await lobi.getByRole("button", { name: "Lobi Stars: one more" }).click();
  await lobi.getByRole("button", { name: "Save" }).click();
  await lobi.getByText("Lobi Stars 2–0 Heartland").waitFor();
  await lobi.getByRole("button", { name: "Confirm" }).click();
  // The saved match leaves the list; its run status stays in the tracker at the top.
  const tracker = admin
    .locator("li")
    .filter({ hasText: "Lobi Stars v Heartland: Lobi Stars 2–0 Heartland" });
  await tracker.waitFor();
  check(
    "the saved match leaves 'Needs results'",
    await lobi
      .count()
      .then(async () => {
        await admin
          .locator("li")
          .filter({ hasText: "Lobi Stars v Heartland" })
          .filter({ has: admin.getByRole("button", { name: "Save" }) })
          .waitFor({ state: "detached", timeout: 10000 });
        return true;
      })
      .catch(() => false),
  );
  check(
    "result saved",
    sql(
      `select status || ' ' || home_goals || '-' || away_goals from public.matches where id = '${LOBI}'`,
    ) === "played 2-0",
  );
  const pts = sql(`select points_awarded from public.picks where match_id = '${LOBI}'`);
  check("the fan's pick is scored at once: round(1/0.5) + 3 = 5", pts === "5", pts);
  await tracker.getByText(/Model run:/).waitFor();

  const calls = await (await fetch(`${API}/github/_calls`)).json();
  const call = calls.at(-1);
  check(
    "a result_saved dispatch was sent to GitHub",
    call?.body?.event_type === "result_saved",
    JSON.stringify(call),
  );
  const runId = call?.body?.client_payload?.model_run_id;
  check(
    "the run is queued with that id",
    sql(`select status from public.model_runs where id = '${runId}'`) === "queued",
  );

  // The workflow's job: python -m model.run with the queued run's id.
  execFileSync(MODEL_PYTHON, ["-m", "model.run", "--trigger", "result_saved"], {
    cwd: ROOT,
    env: { ...process.env, SUPABASE_URL: API, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, MODEL_RUN_ID: runId,
           REVALIDATE_URL: `${BASE}/api/revalidate`, REVALIDATE_SECRET: "e2e-revalidate" }, // prettier-ignore
    stdio: ["ignore", "inherit", "inherit"],
  });
  await tracker.getByText("done", { exact: true }).waitFor({ timeout: 15000 });
  check(
    "the status line reaches done",
    (await tracker.getByText(/[1-9]\d* predictions updated/).count()) >= 1,
  );
  check(
    "the run wrote fresh predictions",
    Number(sql(`select count(*) from public.predictions`)) > before,
  );

  const matchPage = await (await browser.newContext()).newPage();
  await matchPage.goto(`${BASE}/match/${LOBI}`);
  check(
    "the match page shows the result",
    (await matchPage.locator(".figure").filter({ hasText: "2–0" }).count()) >= 1,
  );
  check(
    "the match page marks the prediction right",
    (await matchPage.getByText("Model's most likely result was right").count()) === 1,
  );

  // --- 5. Fixtures CSV: preview with errors, then save ---------------------------
  await admin.goto(`${BASE}/admin/fixtures`);
  const csv = (rows) => `date,time,home,away,matchday\n${rows.join("\n")}\n`;
  const box = admin.getByLabel("…or paste it");
  await box.fill(
    csv(["2027-05-01,16:00,Enyimba FC,Mystery United,40", "2027-05-01,,3SC,Kano Pillars,40"]),
  );
  await admin.getByRole("button", { name: "Check the file" }).click();
  await admin.getByText(/Unknown team "Mystery United"/).waitFor();
  check(
    "unknown team is shown before saving",
    await admin.getByRole("button", { name: "Save fixtures" }).isDisabled(),
  );
  await box.fill(
    csv(["2027-05-01,16:00,Enyimba FC,Bendel Insurance,40", "2027-05-01,,3SC,Kano Pillars,40"]),
  );
  await admin.getByRole("button", { name: "Check the file" }).click();
  await admin.getByText("no errors").waitFor();
  await admin.getByRole("button", { name: "Save fixtures" }).click();
  await admin.getByText(/Imported 2 fixtures/).waitFor();
  check(
    "import saved, names resolved through aliases",
    sql(
      `select count(*) from public.matches m join public.matchdays d on d.id = m.matchday_id where d.number = 40`,
    ) === "2",
  );
  check(
    "blank time saved as time TBC",
    sql(`select kickoff_time_confirmed from public.matches m join public.teams t on t.id = m.home_team_id
         join public.matchdays d on d.id = m.matchday_id where d.number = 40 and t.name = 'Shooting Stars'`) ===
      "f",
  );

  // --- 6. Audit log ------------------------------------------------------------------
  await admin.goto(`${BASE}/admin/audit?entity=matches`);
  check(
    "audit log records the result",
    (await admin.getByText(/home_goals: null → 2/).count()) >= 1,
  );

  // --- 7. Users: search and ban ------------------------------------------------------
  await admin.goto(`${BASE}/admin/users?q=E2E%20Guest`);
  await admin.getByRole("button", { name: "Ban" }).click();
  await admin.getByText(/Banned\. Hidden from leaderboards/).waitFor();
  check(
    "admin bans a fan",
    sql(`select banned from public.profiles where display_name = 'E2E Guest'`) === "t",
  );
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll admin checks passed");
process.exit(failures ? 1 : 0);
