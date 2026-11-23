// Match of the Week and crests, run by supabase/tests/run_e2e.sh after the
// other browser tests (it reuses the admin account and their matchdays).
//
// /motw points at this week's link; the poster and the X card render; Home
// has a one-click "Post on X" link to it; the admin can choose another match.
// A crest shows on the site, and "Hide all crests" removes it everywhere.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const { BASE, DB_URL } = process.env;
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
const sql = (q) => execFileSync("psql", [DB_URL, "-Atq", "-c", q]).toString().trim();
async function revalidate(tags) {
  await fetch(`${BASE}/api/revalidate`, {
    method: "POST",
    headers: { Authorization: "Bearer e2e-revalidate", "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
}
async function logIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Log in" }) });
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE}/`);
}

// A matchday of three open matches, two days away: two Upset Alerts (the
// higher away chance should win) and one close match.
const md = Number(sql(`select coalesce(max(number), 0) + 1 from public.matchdays`));
sql(`
  with s as (select id from public.seasons where is_current),
  d as (insert into public.matchdays (season_id, number) select id, ${md} from s returning id),
  run as (insert into public.model_runs (trigger, status) values ('manual', 'done') returning id),
  fx(h, a, ph, pd, pa, up) as (values
    ('Lobi Stars', 'Heartland', 0.44, 0.26, 0.30, true),
    ('Gombe United', 'Akwa United', 0.47, 0.28, 0.25, true),
    ('Sunshine Stars', 'MFM', 0.36, 0.30, 0.34, false),
    ('Enyimba', 'Enugu Rangers', 0.55, 0.27, 0.18, false)),
  m as (insert into public.matches (season_id, matchday_id, home_team_id, away_team_id, kickoff_at, kickoff_time_confirmed)
        select s.id, d.id, (select id from public.teams where name = fx.h), (select id from public.teams where name = fx.a),
               now() + interval '2 days', true
        from s, d, fx returning id, home_team_id)
  insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home, xg_away, top_scores, reasons, upset_alert)
  select m.id, run.id, fx.ph, fx.pd, fx.pa, 1.2, 1.0, '[]', '[]', fx.up
  from m join public.teams t on t.id = m.home_team_id join fx on fx.h = t.name, run`);
// Earlier tests' matchdays stay "current" for a day after kick-off: move
// them all three days back so this matchday is the current one.
sql(`update public.matches set kickoff_at = least(kickoff_at, now() - interval '3 days')
     where matchday_id is distinct from (select id from public.matchdays where number = ${md})`);
await revalidate(["matches", "predictions", "settings"]);

const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await admin.newPage();

try {
  // --- 1. This week's link, images and the Post on X button -------------------
  const r = await fetch(`${BASE}/motw`, { redirect: "manual" });
  const where = r.headers.get("location") ?? "";
  check(
    `/motw points at matchday ${md}`,
    r.status === 307 && where.endsWith(`/motw/md${md}`),
    `${r.status} ${where}`,
  );

  for (const path of [`/motw/md${md}/poster`, `/motw/md${md}/opengraph-image`]) {
    const img = await fetch(`${BASE}${path}`);
    check(
      `${path} is a PNG`,
      img.status === 200 && img.headers.get("content-type") === "image/png",
      `${img.status} ${img.headers.get("content-type")}`,
    );
  }

  await page.goto(`${BASE}/`);
  await page.getByRole("link", { name: "Sign up / Log in" }).waitFor();
  check(
    "Logged out: the fifth tab is Sign up / Log in, and no Accuracy link",
    (await page.getByRole("link", { name: "Me", exact: true }).count()) === 0 &&
      (await page.getByRole("link", { name: "Accuracy" }).count()) === 0,
  );
  const motw = page.getByRole("region", { name: /Lobi Stars v Heartland/i });
  check(
    "Home: the Upset Alert with the highest away chance is Match of the Week",
    (await motw.count()) === 1,
  );
  const post = page.getByRole("link", { name: "Post on X" }).first();
  const href = (await post.getAttribute("href")) ?? "";
  const intent = new URL(href);
  check(
    "Post on X (fans): X's post intent with the link, via @NaijaBallboy, no numbers",
    intent.host === "x.com" &&
      intent.pathname === "/intent/post" &&
      intent.searchParams.get("url")?.endsWith(`/motw/md${md}`) &&
      intent.searchParams.get("via") === "NaijaBallboy" &&
      /One To Watch 🔥/.test(intent.searchParams.get("text") ?? "") &&
      !/%/.test(intent.searchParams.get("text") ?? ""),
    href,
  );
  const text = intent.searchParams.get("text") ?? "";
  check(
    "Post text has no betting words",
    !/\b(bet|stake|odds|tip|banker|slip)s?\b/i.test(text),
    text,
  );
  check(
    "Save image downloads the poster",
    (await page.getByRole("link", { name: "Save image" }).first().getAttribute("href")) ===
      `/motw/md${md}/poster`,
  );

  const share = await (await fetch(`${BASE}/motw/md${md}`)).text();
  check(
    "Share page: X card is this week's image",
    share.includes(`/motw/md${md}/opengraph-image`) && share.includes("summary_large_image"),
  );

  check(
    "Home: this week in numbers",
    (await page.getByRole("heading", { name: /Matchday \d+ in numbers/ }).count()) === 1 &&
      (await page.getByText("Goals", { exact: true }).count()) === 1,
  );
  check(
    "Derby tag: Enyimba v Enugu Rangers is the Oriental derby",
    (await page.locator("article", { hasText: "Enyimba" }).getByText("Oriental derby").count()) > 0,
  );

  // --- 2. The admin chooses another match ------------------------------------
  await logIn(page, "admin@e2e.invalid", "admin-password-1");
  await page.getByRole("link", { name: "Me", exact: true }).first().waitFor();
  check(
    "Logged in: the fifth tab is Me",
    (await page.getByRole("link", { name: "Sign up / Log in" }).count()) === 0,
  );
  await page.goto(`${BASE}/admin/motw`);
  const read = await page
    .getByRole("link", { name: "Post on X with the Ballboy's read" })
    .first()
    .getAttribute("href");
  check(
    "Admin: Post on X with the Ballboy's read gives its percentages",
    /30% chance away from home/.test(
      new URL(read ?? "https://x.com").searchParams.get("text") ?? "",
    ),
    read ?? "",
  );
  const select = page.getByLabel("Match", { exact: true });
  const close = await select
    .locator("option", { hasText: "Sunshine Stars v MFM" })
    .getAttribute("value");
  await select.selectOption(close);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Match of the Week chosen.").waitFor();
  check("Admin lists the week's big matches", (await page.getByText(/Oriental derby/).count()) > 0);
  await page.goto(`${BASE}/`);
  check(
    "Admin's choice replaces the automatic pick",
    (await page.getByRole("region", { name: /Sunshine Stars v MFM/i }).count()) === 1,
  );
  check(
    "settings: override saved",
    sql(`select value #>> '{}' from public.site_settings where key = 'motw_override'`) === close,
  );

  // --- 3. Crests on the site, and the switch that hides them -----------------
  const crest = "https://example.invalid/crests/lobi-stars.png";
  sql(`update public.teams set crest_url = '${crest}' where name = 'Lobi Stars'`);
  // Data changed straight in the database shows after "Refresh the site".
  await page.goto(`${BASE}/admin/teams`);
  await page.getByRole("button", { name: "Refresh the site" }).click();
  await page.getByText("Done. Every page now shows the latest data.").waitFor();
  await page.goto(`${BASE}/fixtures`);
  check("Crest shows on the site", (await page.locator(`img[src="${crest}"]`).count()) > 0);
  const poster = await fetch(`${BASE}/motw/md${md}/poster`);
  check("Share images still render with a crest set (colours only)", poster.status === 200);

  await page.goto(`${BASE}/admin/teams`);
  await page.getByRole("button", { name: "Hide all crests" }).click();
  await page.getByText("Crests are hidden everywhere.").waitFor();
  await page.goto(`${BASE}/fixtures`);
  check("Hide all crests removes them", (await page.locator(`img[src="${crest}"]`).count()) === 0);
  await page.goto(`${BASE}/admin/teams`);
  await page.getByRole("button", { name: "Show crests" }).click();
  await page.getByText("Crests are showing.").waitFor();
  await page.goto(`${BASE}/fixtures`);
  check("Show crests brings them back", (await page.locator(`img[src="${crest}"]`).count()) > 0);
} catch (e) {
  check("no unexpected errors", false, e.message);
} finally {
  await browser.close();
}
console.log(failures ? `${failures} check(s) failed` : "All Match of the Week checks passed");
process.exit(failures ? 1 : 0);
