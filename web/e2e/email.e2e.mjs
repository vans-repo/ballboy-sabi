// Stage 7 end-to-end test, run by supabase/tests/run_e2e.sh after the picks
// and admin tests (it reuses their accounts and scored matchday 3).
//
// The daily email cron queues the Matchday Preview ~36 hours ahead and never
// sends more than EMAIL_DAILY_LIMIT (3 here) a day, never twice to anyone,
// fans who picked last matchday first. Unsubscribe works without logging in.
// The admin's test send works. Share images render for a match and a fan.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const { BASE, API, DB_URL } = process.env;
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
const sql = (q) => execFileSync("psql", [DB_URL, "-Atq", "-c", q]).toString().trim();
const cron = async (auth = "Bearer e2e-cron") => {
  const r = await fetch(`${BASE}/api/cron/email`, { headers: auth ? { Authorization: auth } : {} });
  return { status: r.status, body: await r.json() };
};
const sent = async () =>
  (await (await fetch(`${API}/brevo/_sent`)).json()).filter((e) =>
    e.subject?.startsWith("Matchday 50"),
  );

// Five more fans with the weekly email on, plus the Stage 5 fan (who picked
// matchday 3, so goes first). The banned guest must never get one.
sql(`insert into auth.users (email, raw_user_meta_data)
     select 'reader' || n || '@e2e.invalid', jsonb_build_object('display_name', 'Reader ' || n, 'email_opt_in', true)
     from generate_series(1, 5) n`);
sql(
  `update public.profiles set email_opt_in = true where display_name in ('E2E Fan', 'E2E Guest')`,
);
const FAN = sql(`select id from public.profiles where display_name = 'E2E Fan'`);

// Matchday 50: first kick-off 36 hours from now, at a known time.
sql(`with s as (select id from public.seasons where is_current),
     md as (insert into public.matchdays (season_id, number) select id, 50 from s returning id)
     insert into public.matches (season_id, matchday_id, home_team_id, away_team_id, kickoff_at, kickoff_time_confirmed)
     select s.id, md.id, (select id from public.teams where name = 'Rivers United'),
            (select id from public.teams where name = 'Kwara United'), now() + interval '36 hours', true
     from s, md`);
// The admin test left Gombe United v Dakkada without a result: make it overdue (3+ hours after kick-off).
sql(`update public.matches set kickoff_at = now() - interval '5 hours'
     where status = 'scheduled' and home_team_id = (select id from public.teams where name = 'Gombe United')
       and away_team_id = (select id from public.teams where name = 'Dakkada')`);
await fetch(`${BASE}/api/revalidate`, {
  method: "POST",
  headers: { Authorization: "Bearer e2e-revalidate", "Content-Type": "application/json" },
  body: JSON.stringify({ tags: ["matches", "predictions", "picks"] }),
});

const browser = await chromium.launch();
try {
  // --- 1. The cron needs its secret --------------------------------------------
  check("cron without the secret is refused", (await cron(null)).status === 401);

  // --- 2. Day 1: queue everyone, send only 3 -------------------------------------
  const day1 = await cron();
  check(
    "6 fans queued for matchday 50 (banned guest left out)",
    day1.body.queued === 6,
    JSON.stringify(day1.body),
  );
  check(
    "day 1 sends exactly the daily limit of 3",
    day1.body.sent === 3,
    JSON.stringify(day1.body),
  );
  let emails = await sent();
  check("Brevo received 3", emails.length === 3, String(emails.length));
  check(
    "the fan who picked last matchday goes first",
    emails[0]?.to?.[0]?.email === "fan@e2e.invalid",
    emails[0]?.to?.[0]?.email,
  );
  const first = emails[0] ?? {};
  check(
    'subject: "Matchday 50 picks close <day> <time>"',
    /^Matchday 50 picks close \w+day \d{1,2}(:\d\d)?(am|pm)$/.test(first.subject ?? ""),
    first.subject,
  );
  check(
    "the email has the picks button and the last matchday's points",
    first.htmlContent?.includes("/pick-all?md=50") &&
      first.htmlContent?.includes("Make your picks") &&
      /Matchday 3: you scored \d+ points/.test(first.textContent ?? ""),
    first.textContent,
  );
  check(
    "one-click unsubscribe header",
    first.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" &&
      first.headers?.["List-Unsubscribe"]?.includes("/api/unsubscribe?u="),
  );

  // Admin reminder: Gombe United v Dakkada kicked off hours ago with no result.
  const reminders = (await (await fetch(`${API}/brevo/_sent`)).json()).filter((e) =>
    /results? needs? entering$/.test(e.subject ?? ""),
  );
  check(
    "admins are reminded about missing results",
    reminders.some(
      (e) =>
        e.to[0].email === "admin@e2e.invalid" && e.textContent.includes("Gombe United v Dakkada"),
    ),
    JSON.stringify({ subjects: reminders.map((e) => e.subject), report: day1.body.reminder }),
  );
  check(
    "fans don't get the reminder",
    reminders.every((e) => e.to[0].email === "admin@e2e.invalid"),
  );

  // --- 3. Same day again: nothing more -----------------------------------------------
  const again = await cron();
  check(
    "a second run the same day sends nothing",
    again.body.sent === 0 && /limit/i.test(again.body.note),
    JSON.stringify(again.body),
  );

  // --- 4. Unsubscribe without logging in (one of the queued, not yet sent) ----------
  const queuedUser =
    sql(`select p.id from public.email_sends e join public.profiles p on p.id = e.user_id
                          join public.matchdays d on d.id = e.matchday_id where d.number = 50 and e.status = 'queued' limit 1`);
  const link = (first.htmlContent.match(/href="([^"]*\/unsubscribe\?u=[^"]*)"/) ?? [])[1]?.replace(
    /&amp;/g,
    "&",
  );
  const page = await browser.newPage(); // no session
  await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await page.getByText("Done. You won't get the weekly preview any more.").waitFor();
  check(
    "unsubscribe link works without logging in",
    sql(`select email_opt_in from public.profiles where id = '${FAN}'`) === "f",
  );
  await page.goto(`${BASE}/unsubscribe?u=${FAN}&t=forged`);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await page.getByText("This link isn't valid.").waitFor();
  check("a forged link is refused", true);
  // A queued fan unsubscribes before their email goes (mail-app one-click POST, with their own link).
  const token = (link.match(/[?&]t=([^&]+)/) ?? [])[1];
  const forged = await fetch(`${BASE}/api/unsubscribe?u=${queuedUser}&t=${token}`, {
    method: "POST",
  });
  check("one-click POST with someone else's token is refused", forged.status === 400);
  sql(`update public.profiles set email_opt_in = false where id = '${queuedUser}'`);

  // --- 5. Next day: the rest, never twice -----------------------------------------
  sql(
    `update public.email_sends set sent_at = sent_at - interval '1 day' where sent_at is not null`,
  );
  const day2 = await cron();
  check(
    "day 2 sends the remaining 2 and skips the one who unsubscribed",
    day2.body.sent === 2 && day2.body.skipped === 1,
    JSON.stringify(day2.body),
  );
  const day3 = await cron();
  check("nothing left to send", day3.body.sent === 0, JSON.stringify(day3.body));
  emails = await sent();
  const to = emails.map((e) => e.to[0].email);
  check(
    "5 emails, each to a different fan",
    emails.length === 5 && new Set(to).size === 5,
    to.join(", "),
  );
  check("the banned fan got none", !to.includes("guest@e2e.invalid"));
  check(
    "never more than 3 on one day",
    Number(
      sql(
        `select max(n) from (select count(*) n from public.email_sends where sent_at is not null group by sent_at::date) x`,
      ),
    ) <= 3,
  );

  // --- 6. The admin's test send -------------------------------------------------------
  const admin = await browser.newPage();
  await admin.goto(`${BASE}/login`);
  const form = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Log in" }) });
  await form.getByLabel("Email", { exact: true }).fill("admin@e2e.invalid");
  await form.getByLabel("Password").fill("admin-password-1");
  await form.getByRole("button", { name: "Log in" }).click();
  await admin.waitForURL(`${BASE}/`);
  await admin.goto(`${BASE}/admin/emails`);
  await admin.getByRole("button", { name: "Send a test to me" }).click();
  await admin.getByText(/^Sent "Matchday 50 picks close/).waitFor();
  const last = (await sent()).at(-1);
  check(
    "the admin's test arrives at the admin's address",
    last?.to?.[0]?.email === "admin@e2e.invalid",
  );

  // --- 7. Share images --------------------------------------------------------------------
  const lobi = sql(
    `select m.id from public.matches m join public.teams t on t.id = m.home_team_id where t.name = 'Lobi Stars' and m.status = 'played' order by m.kickoff_at desc limit 1`,
  );
  const img = await fetch(`${BASE}/match/${lobi}/opengraph-image`);
  const bytes = Buffer.from(await img.arrayBuffer());
  check(
    "match share image is a 1200x630 PNG",
    img.status === 200 &&
      img.headers.get("content-type") === "image/png" &&
      bytes.readUInt32BE(16) === 1200 &&
      bytes.readUInt32BE(20) === 630,
  );
  const fanImg = await fetch(`${BASE}/share/${FAN}/3/opengraph-image`);
  check(
    "My Matchday share image renders",
    fanImg.status === 200 && fanImg.headers.get("content-type") === "image/png",
  );
  const share = await browser.newPage();
  await share.goto(`${BASE}/share/${FAN}/3`);
  check(
    "My Matchday page shows the fan's points",
    (await share.getByRole("heading", { name: "E2E Fan's Matchday 3" }).count()) === 1,
  );
  const og = await share.locator('meta[property="og:image"]').getAttribute("content");
  check(
    "the share page links its image for WhatsApp and X",
    !!og && og.includes(`/share/${FAN}/3/opengraph-image`),
    og,
  );
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll email and share checks passed");
process.exit(failures ? 1 : 0);
