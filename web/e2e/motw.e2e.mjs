// Match of the Week and crests, run by supabase/tests/run_e2e.sh after the
// other browser tests (it reuses the admin account and their matchdays).
//
// /motw points at this week's link; the poster and the X card render; Home
// has a "Share…" menu (X, WhatsApp and more) for it; the admin can choose another match.
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
  // --- 1. This week's link, images and the Share menu -------------------------
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
  // Google sign-in: a code that lands on a page goes on to /auth/callback, and
  // a half-finished sign-in (only the code-verifier cookie) isn't "logged in".
  const stray = await fetch(`${BASE}/?code=abc123`, { redirect: "manual" });
  const strayTo = new URL(stray.headers.get("location") ?? "", BASE);
  check(
    "A sign-in code on Home is finished at /auth/callback",
    stray.status === 307 &&
      strayTo.pathname === "/auth/callback" &&
      strayTo.searchParams.get("code") === "abc123" &&
      strayTo.searchParams.get("next") === "/",
    `${stray.status} ${strayTo}`,
  );
  const half = await browser.newContext();
  await half.addCookies([{ name: "sb-e2e-auth-token-code-verifier", value: "x", url: BASE }]);
  const hp = await half.newPage();
  await hp.goto(`${BASE}/`);
  await hp.getByRole("link", { name: "Sign up / Log in" }).first().waitFor();
  check("A half-finished Google sign-in still shows Sign up / Log in", true);
  await half.close();
  const motw = page.getByRole("region", { name: /Lobi Stars v Heartland/i });
  check(
    "Home: the Upset Alert with the highest away chance is Match of the Week",
    (await motw.count()) === 1,
  );
  // "Share…" opens the menu; record the app links instead of leaving the page.
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (u) => (window.__opened.push(String(u)), null);
  });
  const shareOn = async (scope, app) => {
    await scope
      .getByRole("button", { name: /^Share/ })
      .first()
      .click();
    await scope.getByRole("menuitem", { name: app, exact: true }).click();
    return page.evaluate(() => window.__opened.at(-1));
  };
  const href = await shareOn(motw, "X");
  const intent = new URL(href);
  check(
    "Share on X (fans): X's post intent with the link, via @NaijaBallboy, no numbers",
    intent.host === "x.com" &&
      intent.pathname === "/intent/post" &&
      intent.searchParams.get("url")?.endsWith(`/motw/md${md}`) &&
      intent.searchParams.get("via") === "NaijaBallboy" &&
      /One To Watch 🔥/.test(intent.searchParams.get("text") ?? "") &&
      /free NPFL predictions game/.test(intent.searchParams.get("text") ?? "") &&
      !/%/.test(intent.searchParams.get("text") ?? ""),
    href,
  );
  const text = intent.searchParams.get("text") ?? "";
  check(
    "Post text has no betting words",
    !/\b(bet|stake|odds|tip|banker|slip)s?\b/i.test(text),
    text,
  );
  const wa = new URL(await shareOn(motw, "WhatsApp"));
  check(
    "Share on WhatsApp: the message, the sign-off naming @NaijaBallboy, and the link",
    wa.host === "wa.me" &&
      /One To Watch 🔥[\s\S]*@NaijaBallboy[\s\S]*\/motw\/md\d+$/.test(
        wa.searchParams.get("text") ?? "",
      ),
    wa.toString(),
  );
  const card = page.locator("article", { hasText: "Enyimba" }).first();
  const fb = new URL(await shareOn(card, "Facebook"));
  check(
    "Every match card shares too (Facebook gets the match page)",
    fb.host === "www.facebook.com" &&
      /\/match\/[0-9a-f-]{36}$/.test(fb.searchParams.get("u") ?? ""),
    fb.toString(),
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

  // --- 4. Data check: suggested fixes wait in admin, one tap applies each ------
  const sendCheck = (auth, body) =>
    fetch(`${BASE}/api/data-check`, {
      method: "POST",
      headers: { ...(auth ? { Authorization: auth } : {}), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const gombe = sql(`select m.id from public.matches m join public.teams t on t.id = m.home_team_id
                     where t.name = 'Gombe United' and m.status = 'scheduled' limit 1`);
  check(
    "Data check: refused without the secret",
    (await sendCheck(null, { check_date: "2026-11-24", items: [] })).status === 401,
  );
  const sent = await (
    await sendCheck("Bearer e2e-data-check", {
      check_date: "2026-11-24",
      items: [
        {
          kind: "result",
          match_id: gombe,
          home_goals: 2,
          away_goals: 1,
          summary: "Gombe United 2-1 Akwa United",
          source_url: "https://example.invalid/report",
        },
        {
          kind: "deduction",
          team_slug: "enyimba",
          points: 3,
          goals: 3,
          reason: "Unpaid wages (e2e)",
          summary: "Enyimba docked 3 points and 3 goals",
          confidence: "unconfirmed",
        },
        { kind: "result", match_id: "not-a-match", home_goals: 1, away_goals: 0, summary: "bad" },
      ],
    })
  ).json();
  check(
    "Data check: two fixes queued, the bad one rejected",
    sent.added === 2 && sent.rejected?.length === 1,
    JSON.stringify(sent),
  );
  const again = await (
    await sendCheck("Bearer e2e-data-check", {
      check_date: "2026-11-24",
      items: [
        {
          kind: "result",
          match_id: gombe,
          home_goals: 2,
          away_goals: 1,
          summary: "Gombe United 2-1 Akwa United",
        },
      ],
    })
  ).json();
  check(
    "Data check: the same fix isn't queued twice",
    again.added === 0 && again.already_waiting === 1,
    JSON.stringify(again),
  );

  const lobiBefore = sql(`select points || ' ' || goal_difference from public.league_table l
     join public.teams t on t.id = l.team_id join public.seasons s on s.id = l.season_id
     where s.is_current and t.name = 'Enyimba'`)
    .split(" ")
    .map(Number);
  await page.goto(`${BASE}/admin/data-check`);
  await page.getByRole("button", { name: "Apply" }).first().waitFor();
  check(
    "Data check page lists both",
    (await page.getByRole("button", { name: "Apply" }).count()) === 2,
  );
  // Tap Apply on each card in turn and wait until the database shows it applied.
  const applied = () =>
    Number(sql(`select count(*) from public.data_suggestions where status = 'applied'`));
  for (let done = 1; done <= 2; done++) {
    await page
      .locator("button:not([disabled])", { hasText: /^Apply$/ })
      .first()
      .click();
    for (let t = 0; t < 60 && applied() < done; t++) await page.waitForTimeout(500);
    await page.reload();
    if (done < 2) await page.getByRole("button", { name: "Apply" }).first().waitFor();
  }
  check(
    "Apply: the result is saved",
    sql(
      `select status || ' ' || home_goals || '-' || away_goals from public.matches where id = '${gombe}'`,
    ) === "played 2-1",
  );
  check(
    "Apply: the deduction is recorded",
    sql(`select count(*) from public.point_deductions d join public.teams t on t.id = d.team_id
         where t.name = 'Enyimba' and d.points = 3`) === "1",
  );
  const lobiAfter =
    sql(`select points || ' ' || goal_difference || ' ' || goals_deducted from public.league_table l
     join public.teams t on t.id = l.team_id join public.seasons s on s.id = l.season_id
     where s.is_current and t.name = 'Enyimba'`)
      .split(" ")
      .map(Number);
  check(
    "Deduction takes 3 points and 3 goals off the table",
    lobiAfter[0] === lobiBefore[0] - 3 && lobiAfter[1] === lobiBefore[1] - 3 && lobiAfter[2] === 3,
    `${lobiBefore} -> ${lobiAfter}`,
  );
  await page.goto(`${BASE}/admin/images`);
  await page
    .getByRole("heading", { name: /Discipline and rulings/ })
    .waitFor()
    .catch(() => {});
  check(
    "Admin Images page lists the categories",
    (await page.getByRole("heading", { name: /Discipline and rulings/ }).count()) === 1 &&
      (await page.getByRole("heading", { name: /^General/ }).count()) === 1,
  );
  check(
    "Both suggestions are marked applied",
    sql(`select count(*) from public.data_suggestions where status = 'applied'`) === "2",
  );

  // --- 5. YouTube: a search link by default, the official video once set ------
  const season = sql(`select label from public.seasons where is_current`);
  await revalidate(["matches"]);
  await page.goto(`${BASE}/match/${gombe}`);
  const find = page.getByRole("link", { name: /Find this match on YouTube/ });
  await find.waitFor();
  const ytHref = (await find.getAttribute("href")) ?? "";
  check(
    "Played match without a video links to a YouTube search",
    season === "2026/27"
      ? ytHref.startsWith("https://www.youtube.com/@NigeriaPFL/search?query=")
      : ytHref.startsWith("https://www.youtube.com/results?search_query="),
    ytHref,
  );
  const vid = await (
    await sendCheck("Bearer e2e-data-check", {
      check_date: "2026-11-24",
      items: [
        {
          kind: "video",
          match_id: gombe,
          url: "https://youtu.be/dQw4w9WgXcQ?si=abc",
          label: "highlights",
          summary: "Official highlights on @NigeriaPFL",
        },
        {
          kind: "video",
          match_id: gombe,
          url: "https://example.com/v",
          label: "live",
          summary: "x",
        },
      ],
    })
  ).json();
  check(
    "Data check accepts a YouTube video and rejects other links",
    vid.added === 1 && vid.rejected?.length === 1,
    JSON.stringify(vid),
  );
  await page.goto(`${BASE}/admin/data-check`);
  await page.getByRole("button", { name: "Apply" }).first().click();
  for (let t = 0; t < 60 && applied() < 3; t++) await page.waitForTimeout(500);
  check(
    "Apply: the video is saved, as a clean link",
    sql(`select video_url || ' ' || video_label from public.matches where id = '${gombe}'`) ===
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ highlights",
  );
  await page.goto(`${BASE}/match/${gombe}`);
  await page.locator("iframe[src*='youtube-nocookie.com/embed/dQw4w9WgXcQ']").waitFor();
  check("Match page plays the video in place", true);
  const gombeSlug = sql(`select slug from public.teams where name = 'Gombe United'`);
  await page.goto(`${BASE}/team/${gombeSlug}`);
  const watch = page.getByRole("link", { name: "Watch highlights" });
  await watch.first().waitFor();
  check(
    "Result card links to the highlights",
    (await watch.first().getAttribute("href")) === "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
} catch (e) {
  check("no unexpected errors", false, e.message);
} finally {
  await browser.close();
}
console.log(failures ? `${failures} check(s) failed` : "All Match of the Week checks passed");
process.exit(failures ? 1 : 0);
