# Decisions

Choices the spec didn't settle, or settled in two conflicting ways. Each says
what was decided and why. Newest stage at the bottom.

## Stage 1 — Foundation

### Confirmed with the site owner

1. **Postponed matches stay open for picks.** The spec allowed picks only while
   `status = 'scheduled'`, but also said postponed picks carry over to the new
   kick-off. A postponed match keeps `status = 'postponed'` with its new
   `kickoff_at` (so the banner can show), and RLS allows picks while the status
   is `scheduled` or `postponed` and `now() < kickoff_at`.

### Data model

2. **`matches.source_order` (extra column).** 2021/22 and 2022/23 have no
   dates, so every match in a season gets the same estimated kick-off. The
   model must keep the file order, so the seed stores each match's position in
   its source file here. It is null for dated seasons.
3. **`matches.matchday_id` is nullable**, because some historical files may not
   have matchday numbers. Every 2026/27 fixture will have one.
4. **`predictions.upset_alert` (extra column).** The model sets the Upset Alert
   flag. The app only chooses the top two per matchday. This keeps the
   threshold logic in one place (Python, settings in `config.yaml`).
5. **Published probabilities are stored as whole percentages**: `numeric(3,2)`
   such as `0.65`, with a check that the three sum to exactly `1.00`. The
   evaluation scripts use the unrounded model output.
6. **`email_sends.error`** (extra column) records why a send failed, for the
   admin Emails screen.
7. **Display names** are 2–30 characters and unique regardless of letter case.
   If the name chosen at sign-up is taken by the time the account is created,
   a short suffix is added instead of failing the sign-up. Google sign-ups get
   a placeholder ("Fan 1a2b3c4d") until the fan picks a name in Stage 5.
8. **An exact-score pick must agree with its outcome** (for example, a Home
   pick can't carry a 0–2 score). Enforced by a check constraint.
9. **The Ballboy needs an auth user.** `profiles.id` references `auth.users`,
   so the seed (Stage 2) will create The Ballboy through the Supabase admin API
   with a random password nobody holds, then set its role to `system`.

### Security

10. **Admin-only tables also include `team_aliases`, `season_teams` and
    `site_settings`**, since the admin screens manage them. They are audited
    like the five tables the spec names.
11. **Audit log scope.** The trigger records every write made by a signed-in
    user. Only admins can write those tables, so that means every admin write.
    Writes by the service role (seed script, model job) have no user and are
    not logged.
12. **Banned users and the system account cannot pick** through the API.
    Banning would mean little otherwise. The Ballboy's picks are written by the
    model job with the service role.
13. **Public profile fields** come from a `public_profiles` view: id, display
    name, role (to find The Ballboy) and sign-up time (for tie-breaks). Banned
    users are left out. The `profiles` table itself is readable only by its
    owner and admins.
14. **`model_runs` is admin-only to read**, because it can hold error text.
    Public pages take their "updated" time from `predictions.created_at`.
15. **Fans can change only their display name and email setting** on their
    profile. A trigger blocks changes to role, premium and banned unless an
    admin makes them.
16. **Supabase's default grants are revoked** and only what each role needs
    is granted back, including column-level grants on `picks` so fans can
    never write points. `TRUNCATE` (which RLS doesn't cover) is revoked too.

### League table

17. **Ordering: points, then goal difference, then goals for, then name.**
    Confirmed by the site owner. In the 2022/23 group season, positions are
    ranked within each group.
18. **Form** is the last five results, oldest first, so the newest is on the
    right (for example `WWDLW`).
19. **Awarded matches count in the table** with the awarded score. They are
    only excluded from the model.

### Design

20. **Secondary text uses text at 60%, not `neutral`.** The spec gives
    `neutral` (#64748B) for secondary text, but that is only 4.0:1 on the page
    and 3.8:1 on cards, below the 4.5:1 rule. Text at 60% is 7.2:1. `neutral`
    is used for the Draw share of the bar.
21. **Light mode values.** The token names are the same. Page #F3F5F9, cards
    #FFFFFF, text #000E2E at 100% and 70%. Success and danger darken to
    #15803D and #B91C1C, because #22C55E on white is only 2.3:1. Gold stays
    for buttons and the Home share (navy on gold is 12:1).
22. **Buttons are 44 px tall by default** (shadcn's default is 32 px) to meet
    the tap-target rule.
23. **The spec's `accent` is shadcn's `primary`.** shadcn uses its own
    `accent` name for subtle hover backgrounds, so that name stays neutral.

### Tooling

24. **Next.js 16.4 with Cache Components**, the current release. Public data
    will be cached with `cacheTag` and refreshed with `revalidateTag` when a
    model run finishes.
25. **JavaScript budget.** An empty page already sends 135 KB of gzipped
    JavaScript (React 19 and the Next.js runtime). That leaves about 65 KB of
    the 200 KB budget for the app, measured as gzipped transfer.
26. **`npm audit` reports 4 moderate issues** in `minimatch`, pulled in by the
    `shadcn` CLI through `ts-morph`. These are build tools that are never sent
    to browsers.
27. **Local database tests use a Supabase stand-in**
    (`supabase/tests/supabase_stub.sql`): the anon, authenticated and
    service_role roles, `auth.users`, `auth.uid()` and Supabase's default
    grants. It is never applied to the real project.
28. **CI** (`.github/workflows/ci.yml`) runs the migrations and RLS test on
    Postgres 17 (Supabase's version), plus web lint, types and build, and
    model lint. That's about 3 minutes per push, well inside the free minutes.
29. **Supabase's SQL seed is disabled** in `supabase/config.toml`. The seed is
    a script in `supabase/seed` (Stage 2).
30. **Typed Supabase queries.** (Done in Stage 2, see 43.) `supabase gen types` needs a
    linked project, so the database types will be generated in Stage 2.

## Between Stages 1 and 2

31. **`evaluate_models.py` is lost.** Stage 3 rebuilds the walk-forward
    evaluation from the spec: weekly refits over the last two completed
    seasons, with log-loss, Brier score, accuracy, the always-home baseline
    and a calibration table. The 0.876 log-loss is a target to aim for,
    not a test that must reproduce within ±0.005, because the original
    method can't be checked. (Stage 3: the rebuild scores 0.8741 on the same
    755 matches, so the ±0.005 test is included after all. See 53.)
32. **`fixtures_2026_27.csv` is lost**, and it can't be rebuilt without
    inventing or scraping data. The seed creates the 2026/27 season and loads
    `data/fixtures_2026_27.csv` (columns: date, time, home, away, matchday,
    plus home_goals and away_goals for played matches) when it exists. It
    reports clearly when the file is missing. From Stage 6 the admin CSV import
    also loads it. Stage 2's "plus 2026/27" check passes once the owner adds
    the file.

## Stage 2 — Data load

33. **The seed is a Python script that writes through Supabase's HTTP API**
    (`supabase/seed/seed.py`, service role key). It doesn't need a direct
    database connection, so it runs anywhere with HTTPS. Its tests load a
    fresh database through a local PostgREST, the same API Supabase runs.
34. **Team list in `supabase/seed/teams.yaml`**, built from the reference
    `config.yaml` (names, coordinates) and `helpers.py` (aliases). A test
    checks it against both files. 31 teams: the 30 reference names, with
    "Doma United" and "Doma United FC" merged into **Doma United**, plus
    Dakkada and MFM, which appear only in the 2021/22–2022/23 file. "Inter
    Lagos FC" is stored as **Inter Lagos**.
35. **Names resolve by exact alias only, never fuzzy matching.** Every team
    gets its lowercase name and name + " fc" as aliases, plus the reference
    spellings. A name with no alias is reported and its match isn't loaded.
36. **Codes are new** (e.g. ABW, ENY, SHO for Shooting Stars, since "3SC"
    has a digit). **City and colours are left empty** for every team, and
    Dakkada and MFM have no coordinates. The seed lists them all.
37. **Season dates.** Dated seasons run from their first to their last match.
    2021/22 and 2022/23 have no dates, so they get a nominal 1 August to
    31 July, and every match in them kicks off at that span's midpoint. The
    file order is kept in `source_order`. 2026/27 is nominal until the
    fixtures file is loaded, and dates only ever widen.
38. **Historical kick-off times are a placeholder 16:00 Lagos time.** The
    dated file has days, not times. Stage 4 should show only the date for
    matches before 2026/27.
39. **Matches only in the undated file are kept.** 2023/24 has 8 and 2024/25
    has 1 that are missing from the dated file. They're loaded with an
    estimated date (the season's midpoint), so both seasons have their full
    380 matches. 2025/26 has 376 of 380, with no other source for the rest.
40. **2022/23 groups come from who played whom** (two groups of ten). The
    file has no group names, so the letters A and B are the seed's own.
41. **season_teams status:** `relegated` if the team isn't in the next
    season, otherwise `promoted` if it wasn't in the previous one, otherwise
    `stayed`. 2021/22 has no earlier data, so all its teams are `stayed`.
    Relegation is only judged once the next season has at least as many
    teams, so a partial fixtures file doesn't mark anyone. Leaving the league
    for any reason counts as `relegated`.
42. **Re-runs never overwrite.** Missing rows are added and existing ones are
    kept. Differences are reported, and the database wins. Two exceptions:
    season_teams status always follows the data, and a 2026/27 fixture still
    `scheduled` takes the file's kick-off, matchday and result.
43. **Database types** are generated into
    `web/src/lib/supabase/database.types.ts` and used by all four Supabase
    clients.
44. **The Ballboy** is the auth user `the-ballboy@system.invalid`. The
    `.invalid` domain can never receive mail, and its random password is
    never stored. **The admin** is promoted with `--admin-email` once the
    owner has signed up (Stage 5).
45. **Migrations were applied to the project through the Management API**,
    because this sandbox can't open a database connection. They're recorded
    in `supabase_migrations.schema_migrations`, so `supabase db push` treats
    them as already applied.
46. **Step 6 of the initial load (run the model once) moves to Stage 3**,
    where the model is built.

## Between Stages 2 and 3

47. **The 2026/27 fixtures came from a pasted results page.**
    `supabase/seed/tools/paste_to_csv.py` turns that paste into
    `data/fixtures_2026_27.csv`. It refuses to write anything unless the
    result is a full double round robin (380 matches, every team once per
    matchday). "abor." means abandoned: the status is `abandoned`, no score
    is stored, and the score at that point goes in `notes`.
48. **The fixtures CSV gains optional `status` and `notes` columns.** `time`
    may be blank when no time has been announced. The admin import
    (Stage 6) reads the same format.
49. **`matches.kickoff_time_confirmed` (new column, migration 0500).** It is
    false when the time is a placeholder: every historical match, and
    upcoming matches with no announced time. Stage 4 shows only the date for
    played matches whose time is unconfirmed, and "Time TBC" for upcoming
    ones.
50. **An upcoming match with no time is stored at 12:00 Lagos time**, so
    picks lock on the morning of match day rather than after kick-off.
    Played matches without a time use 16:00, the usual NPFL kick-off in the
    pasted list. Only the date of those matters.
51. **How real times get in, with no scraping:** until Stage 6, paste an
    updated fixture list, convert it and run the seed again. A fixture still
    `scheduled` takes the new time, result and status. From Stage 6, the
    admin edits a fixture's time, which sets `kickoff_time_confirmed`.
52. **A season's placeholder date span is replaced** by the real first and
    last match dates once its fixtures are loaded.

## Stage 3 — Prediction engine

53. **Walk-forward method.** The test matches are the last two completed
    seasons (2024/25 and 2025/26), leaving out matches with estimated dates.
    That's 755 matches, the spec's count. Each week (Monday 00:00 Lagos
    time), both models are refitted on every match played before that week,
    and Elo ratings are taken as they stood at the week's start. The scores
    are blend 0.8741, Elo 0.8748, Poisson 0.8848 and league averages 0.8800,
    against the spec's 0.876 and 0.881. "League averages" means the
    Home/Draw/Away shares of all matches before the week.
54. **The Elo → H/D/A step** is scikit-learn's multinomial logistic
    regression on (home rating + home advantage − away rating) / 400, with
    default regularisation. A team in the first season of data starts at
    1500, and any team first seen later starts at 1450.
55. **Production runs learn from matches before the run time.** Predictions
    are made only for matches that haven't kicked off. The Poisson model is
    fitted once per fixture date, with the decay counted back from that
    date, so a fixture months away leans more on the penalty (closer to
    average) than this weekend's.
56. **team_ratings holds attack and defence as of the end of each match
    day,** next to the Elo after the match. All rows are rebuilt and
    upserted on every run, so a corrected result flows through. That's
    3,644 rows, and a run takes about 12 seconds.
57. **Upset Alert:** away-win chance ≥ 1.8 × the away-win rate of the last
    two completed seasons (11.4%, so the threshold is 20.5%). The model
    flags every match that qualifies, and the app shows the top two per
    matchday (decision 4). The first run flagged 19 of 252.
58. **The Ballboy's pick** is the outcome the unrounded blend rates most
    likely, plus the likeliest scoreline within it. Picks are written only
    for matches that haven't kicked off, so a pick never changes after
    kick-off. On the first run it picked a home win in all 252, which is
    expected in a league where the home side wins 64% of the time. The
    points formula is what lets fans beat it.
59. **Release rule.** Every run computes the walk-forward scores. Nothing is
    published unless the blend beats league averages, and a run whose
    `model_version` differs from the last successful run must also beat
    that run's log-loss. Otherwise the run is marked `failed`, with the
    reason, and the last predictions stay up.
60. **Reasons:** the first line is always the two teams' Elo ranks among
    this season's teams. Up to two more come from this list, in order:
    newly promoted (not in last season's data); a home unbeaten or winless
    run of 4+ this season; an away unbeaten run of 4+ this season, or an
    away record over the last 12 away games when it's notably poor or good;
    the last meeting; wins in the last 5 games.
61. **Tuning isn't applied automatically.** `model.tune` found a setting
    0.0029 better (K 30, home advantage 60, decay 0.0015, L2 4, Elo weight
    0.7). Every best value sits at the edge of the grid, and they were
    chosen on the same matches they're scored on, so launch keeps the spec's
    values. Adopting new settings means editing `config.yaml` and raising
    `model_version`, and the release rule then decides.
62. **`/api/revalidate`** (POST, `Authorization: Bearer REVALIDATE_SECRET`)
    expires the `predictions` and `team-ratings` cache tags immediately
    (`expire: 0`), so the next request after a run shows it. Stage 4 pages
    tag their reads with these.
63. **Python packages are pinned for 3.11** (numpy 2.3.5, pandas 2.3.3,
    scipy 1.16.3, scikit-learn 1.7.2). The model talks to Supabase through
    the REST API with httpx, like the seed, rather than supabase-py.
64. **CI runs the model tests and prints the walk-forward report** from the
    source files, so no secrets are needed. The model workflow
    (`.github/workflows/model.yml`) needs the GitHub secrets SUPABASE_URL
    and SUPABASE_SERVICE_ROLE_KEY. REVALIDATE_URL and REVALIDATE_SECRET can
    wait until the site is deployed.

## Stage 4 — Public pages

65. **Pages are prerendered and cached.** Data functions use `"use cache"`
    with tags (`matches`, `predictions`, `team-ratings`). Pages that depend
    on the current time (which matchday is current, which matches have
    kicked off) are cached for a minute (`cacheLife("minutes")`). Pages that
    don't depend on it are cached for an hour. Pages that read the URL
    (fixtures, table, H2H, match, team) render their shell at build time and
    stream the rest. The countdown is the only ticking element, and it runs
    in the browser.
66. **The current matchday** is the first whose median kick-off is less than
    a day ago, so a single rescheduled match doesn't hold an old matchday
    open. Rescheduled matches stay on their own matchday's page.
67. **Before kick-off a match shows its latest prediction. From kick-off on,
    it shows the prediction frozen at kick-off,** and every ✓/✗ is scored
    against that. Matches played before the first model run (21 Nov 2026)
    have no frozen prediction, so they carry no mark. The site never
    publishes a backfilled prediction as if it had been made in advance.
68. **Accuracy page.** The live section (this season, scored against frozen
    predictions) is empty until results arrive after the first run. Until
    then the page shows the walk-forward test, clearly labelled, with its
    calibration chart. Always-home can't be scored by log-loss (it's
    infinite), so the comparison with it uses accuracy and the Brier score:
    0.515 for our percentages, 0.718 for always home. Log-loss is compared
    with league averages.
69. **The test scores are read with the service role, server-side only.**
    `model_runs` stays admin-only, and only `metrics.walk_forward` reaches a
    page.
70. **Navigation without JavaScript where possible.** The top menu, the
    matchday dropdown and the team filter are `<details>` elements, and the
    H2H picker is a plain GET form. The only client components are the tab
    bar (for the active tab), the countdown and the two lazy-loaded Recharts
    charts.
71. **Placeholders the owner confirms:** table zone sizes in
    `web/src/config/site.ts` (1 champion, places 1–3 continental, bottom 4
    relegated) and the contact email (`NEXT_PUBLIC_CONTACT_EMAIL`, empty
    until set). The 2022/23 group table shows no zones.
72. **Not in Stage 4, by design:** the pick panel, the Pick-all sheet, the
    fan split, the Beat the Ballboy figures, the Leaderboard and Me arrive
    with accounts in Stage 5. Their places show plain empty states.
73. **Lighthouse (mobile, production build, warm cache, median of 3):**
    Home 96, Match detail 97. Accessibility, best practices and SEO are
    90–100. First-load JavaScript is about 155 KB gzipped, inside the 200 KB
    budget.
74. **CI builds with the live project** (pages prerender with real data). It
    needs the repository variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
    publishable key, which is not a secret). Until that is set, the build
    step is skipped with a warning, while lint and type checks still run.

## Stage 5 — Accounts and picks

75. **Scoring lives in the database** (migration 0600). `score_match()`
    scores every pick for a match. A trigger runs it whenever a match's
    status, score or kick-off changes, so saving, correcting or undoing a
    result rescores at once, and `rescore_all()` rescores everything. It
    also stores each pick's `points_if_correct` from the prediction frozen
    at kick-off. A postponed match uses the prediction frozen at its new
    kick-off.
76. **Edge cases.** A correct pick on a match with no prediction published
    before kick-off earns 1 point (the minimum). Abandoned and cancelled
    matches leave picks void (null points), and they don't count on the
    leaderboard. Undoing a result clears the points.
77. **Points on the buttons** use the same formula on the latest
    prediction. `round` is half away from zero in Postgres, and half up in
    JavaScript, which is the same for positive numbers.
78. **Leaderboard and fan split are database functions** (`leaderboard`,
    `fan_split`). They return only totals, names and counts, never anyone's
    pick before kick-off. The fan split leaves out The Ballboy and banned
    fans, and returns zeros before kick-off. The Ballboy is always included
    in the leaderboard (with 0 points before its first scored pick), so its
    row can be pinned. Its rank is its real rank among fans.
79. **"This Matchday" is the latest matchday that has kicked off.**
    Leaderboard pages are cached for a minute. The signed-in fan's own row
    is streamed in separately and pinned at the bottom when it isn't on the
    page.
80. **Personal data never enters a cached page.** Public pages stay cached
    and stream the signed-in fan's picks in a separate `<Suspense>` block,
    which fills a tiny client store that the pick buttons read. Guests skip
    the session check entirely: the proxy only touches requests that carry
    a Supabase session cookie.
81. **Saving a pick** is a server action. It inserts or updates as the fan,
    so RLS decides whether the window is open, and the action never upserts,
    because fans may update only the outcome and score columns. A score must
    agree with the outcome, as the database also checks.
82. **Guest taps** go to `/login?next=…&pick=<match>:<outcome>`. The pick is
    saved after logging in, signing up (including after an email
    confirmation link) or Google sign-in, if the match is still open.
83. **The Pick-all sheet is the page `/pick-all`.** It steps through the
    matchday's open matches one at a time, and the Home page's "Make your
    picks" button opens it.
84. **Light mode** is stored on the device (localStorage) and applied
    before the first paint by a one-line script, so cached pages stay shared
    between fans. Display name and weekly email are saved to the profile.
85. **Google accounts get a placeholder name** ("Fan 1a2b3c4d") until the
    fan picks one. The Me page asks for it.
86. **End-to-end test** (`supabase/tests/run_e2e.sh`, plus the browser
    script `web/e2e/picks.e2e.mjs`) runs on a throwaway local stack: fresh
    Postgres with every migration and the seed, PostgREST, and a production
    build of the site. Auth is a small test stand-in in `fake_supabase.py`
    that issues real signed tokens, so RLS is exercised for real, because
    Supabase's Auth server binary couldn't be run in this sandbox. It has 20
    checks, including the formula (5 for a correct Home with exact score at
    65%, 4 for a Draw at 26%), the lock at kick-off and a rescore after a
    correction. It runs in CI.
87. **Lighthouse after adding picks** (mobile, median of 3): Home 94,
    Match detail 98, accessibility 100. First-load JavaScript is 169 KB.

## Stage 6 — Admin

88. **/admin is a 404 for everyone but admins,** with a real 404 status.
    The proxy checks the session and the profile's role before anything
    renders, each page checks again on the server, and RLS checks every
    write. `/api/admin/*` is covered the same way.
89. **Saving a result:** score steppers plus a status (Played, Postponed,
    Abandoned, Awarded), then a confirmation summary, plus "Are you sure?"
    for any score above 6. Postponed needs the new date and kick-off time,
    and the picks carry over. Awarded needs the awarded score, and the
    database sets `exclude_from_model`. Abandoned makes picks void. The save
    runs as the admin (RLS, audit log), the scoring trigger updates points
    at once, the public pages refresh (`updateTag`), and a model run is
    dispatched.
90. **Model runs from the site.** The site creates the `model_runs` row
    (`queued`, with the service role, since admins only read that table) and
    passes its id to GitHub. A saved result uses `repository_dispatch`
    (`result_saved`), and "Run now" uses `workflow_dispatch` of `model.yml`
    on `main`. If GitHub can't be reached, or the token isn't set, the run
    is marked `failed` with the reason, and the result itself stays saved.
91. **The run status line** (queued → running → done, or failed with its
    error) polls `/api/admin/runs/<id>` every 3 seconds. It sits in a
    tracker at the top of the admin area, so it stays visible after the
    saved match leaves "Needs results".
92. **Fixture CSV import** uses the seed's format: date (YYYY-MM-DD or
    DD/MM/YYYY), time (24-hour Lagos time, blank = TBC), home, away,
    matchday. Names resolve through `team_aliases` only. The preview shows
    every error before saving, and nothing is saved while any row has one.
    Pairings already in the season are skipped, never overwritten.
93. **Editing a fixture** changes its date, time (blank = TBC) and matchday.
    A new matchday number creates the matchday.
94. **Teams & Seasons:** create a season, make it current (only one at a
    time), choose its teams with their status, edit each team's code, city
    and colours (with a badge preview), add or remove aliases, and record or
    remove point deductions.
95. **Users:** search by display name or email. Emails live in
    `auth.users`, so they're read server-side with the service role. The
    page also shows each fan's picks and lets the admin ban or unban
    (never The Ballboy). Banned fans can't pick and disappear from the
    leaderboard.
96. **The Emails screen** shows this matchday's queued, sent and failed
    counts. "Send a test to me" comes with Brevo in Stage 7.
97. **The audit log** shows the latest 100 admin changes, filterable by
    table, with each change shown field by field.
98. **Bug found and fixed:** the model job couldn't read kick-off times
    with fractions of a second, as pandas guessed one date format. It now
    reads them as ISO 8601, with a test.
99. **End-to-end test, admin part** (`web/e2e/admin.e2e.mjs`, run by
    `run_e2e.sh` after the picks test). It covers: 404s for guests and fans;
    the admin saving a result (points at once, a `result_saved` dispatch to
    a GitHub stand-in, then the real model job run with that run id, the
    status line reaching "done" and the match page showing the result); the
    "Are you sure?" check; the CSV preview and import; the audit log; and a
    ban.

## Stage 7 — Email and sharing

100. **The Matchday Preview** goes through Brevo's transactional API. It
     has the subject "Matchday 13 picks close Saturday 4pm" (the matchday's
     first kick-off, or just the day when no time is announced), the
     deadline, up to two Upset Alerts, the reader's points and rank from the
     last scored matchday (or "you didn't pick"), a Make your picks button
     (to the Pick-all sheet), and an unsubscribe link. It's a plain HTML
     table layout with no images, light by default with a dark-mode style
     for mail apps that support one, plus a plain-text version.
101. **"About 36 hours before."** A daily Vercel Cron job (`vercel.json`,
     03:00 UTC) queues the preview on the first run between 48 and 24 hours
     before the matchday's first kick-off. With one run a day, that lands
     about 36 hours ahead. Each run then sends what's queued, up to
     `EMAIL_DAILY_LIMIT` (280) counted across all of that UTC day's sends,
     only while picks are open. Fans who picked last matchday go first,
     then by sign-up date. `email_sends` is unique per fan and matchday, and
     a row moves from queued to sent or failed once, so nobody gets two.
     Failed sends are not retried (the admin sees them). Fans who
     unsubscribe or are banned after queuing are skipped and their row is
     removed.
102. **Fail-safe limit.** If the day's count can't be read, the run stops
     instead of sending. (The test found this when its stand-in couldn't
     answer a count.)
103. **Unsubscribe** links are signed per fan (HMAC with
     `UNSUBSCRIBE_SECRET`) and never expire. The link opens a page with one
     Unsubscribe button and no login. The page doesn't act on load, because
     mail scanners open links. Mail apps' own button uses the standard
     one-click POST (`List-Unsubscribe` and `List-Unsubscribe-Post`
     headers).
104. **Test sends:** the admin's "Send a test to me" (Emails screen), and
     `/api/cron/email?test=1` with the cron secret. The latter sends to
     `EMAIL_TEST_ADDRESS`, a server setting, never an address from the
     request.
105. **Auth emails** (confirm sign-up, reset password) use the branded
     templates in `supabase/templates`. They go through Brevo once custom
     SMTP is set in Supabase (owner checklist, Stage 8).
106. **Share images** are generated with `next/og` at 1200×630 in Barlow
     Condensed (bundled from @fontsource, OFL). There are three: the match
     image (teams, score or the three percentages with the bar, matchday
     and date); the same image with an UPSET ALERT banner when the match
     has one, so sharing an Upset Alert shares its match page; and "My
     Matchday" (`/share/<fan>/<matchday>`: points, rank, right and exact,
     against The Ballboy). The Me page shares it to WhatsApp and X with
     plain links, so no extra JavaScript. The share page shows only what
     the public leaderboard already shows.
107. **`metadataBase`** comes from `NEXT_PUBLIC_SITE_URL`, so share links
     carry absolute image URLs.
108. **End-to-end test, email part** (`web/e2e/email.e2e.mjs`), with Brevo
     replaced by a recording stand-in and a daily limit of 3. It checks: the
     cron secret; 6 queued and 3 sent on day 1; the fan who picked last
     matchday first; the subject format and contents; one-click headers;
     nothing more the same day; unsubscribe without login (and forged links
     refused); the rest on day 2 with nobody twice and never more than 3 a
     day; the admin's test send; and both share images (a 1200×630 PNG)
     plus the share page's og:image.

## Stage 8 — Launch prep

109. **Keep-awake:** a second daily Vercel Cron job calls `/api/health`,
     which runs one tiny query. The site still works if it's missed: free
     Supabase projects pause only after a week without activity, and the
     daily email job queries the database too.
110. **Region:** `vercel.json` pins the site's server functions to
     Frankfurt (`fra1`), next to the Supabase project (`eu-central-1`), so
     each page load avoids a long database round trip. Vercel Hobby allows
     one region.
111. **Search engines:** `robots.txt` keeps out admin, accounts, APIs,
     sign-in and unsubscribe pages. Share pages are not blocked there
     (X's preview crawler obeys `robots.txt`), but they carry a "noindex"
     tag. The sitemap lists the main pages, every team and every match of
     the current season (419 URLs today), refreshed daily.
112. **Share metadata:** site-wide Open Graph defaults (site name, `en_NG`,
     large Twitter/X card) and a default share image. Match and My Matchday
     pages use their own images.
113. **Error pages:** the page-level error and not-found pages from Stage 4,
     plus a plain last-resort `global-error` page for when the root layout
     itself fails.
114. **The deploy is the owner's to do.** This session has no Vercel access,
     and the remaining steps (Vercel project, Google OAuth client, Brevo
     SMTP in Supabase, the revalidate secret on GitHub, merging to `main`)
     need the owner's accounts. The README's launch checklist lists each
     step.

## After launch

115. **Missing-result reminder.** The daily email job also emails every
     admin when any match kicked off more than 3 hours ago without a
     result, listing the matches with a link to Needs results. It repeats
     daily until they're entered, and records nothing. It's the owner's
     backup while running the site alone. Automatic results from a licensed
     feed (option 3) wait on confirming a provider that covers the NPFL.
116. **Substack and X.** The site is the base. "Read on Substack" sits in
     the menu, and Substack and @NaijaBallboy links in the footer. Home
     shows the three latest Substack articles from its public RSS feed
     (text only, cached for an hour, hidden if the feed can't be read). The
     Matchday Preview stays the short picks reminder, and Substack carries
     the longer weekly articles.
117. **Weekly recap (/admin/recap).** For any matchday with results, it
     builds article notes and X post drafts from published data only: the
     model's record against always picking home, the biggest upsets (the
     results the frozen prediction gave 30% or less), Upset Alert hits, Beat
     the Ballboy (The Ballboy's points, the average fan, how many fans beat
     it, the top score), table movers (positions before and after,
     deductions left out) and the next matchday's Upset Alerts. Drafts are
     280 characters or fewer and link to match pages, so X shows their share
     images. Posting stays manual: copy, check, post. The end-to-end test
     checks the lengths and that no betting words appear.
118. **Table zones confirmed by the owner:** 1st are champions (and go to
     the CAF Champions League), 2nd also goes to the CAF Champions League,
     3rd to the CAF Confederation Cup (its other place goes to the President
     Federation Cup winners, which the league table doesn't show), and the
     bottom 4 are relegated. They show as gold, blue, grey and red bars, and
     each is named for screen readers. The 2022/23 group letters A and B are
     confirmed too (decision 40).
119. **Table at 360 px:** the Pts column was being pushed off the right
     edge by long team names. The team column now takes the space left and
     long names shorten with "…" (the full name is in the link's title), so
     every column fits on a phone.
120. **Colours match the TNB logo:** the owner's logo is yellow #FED700 on
     navy #001F55, so the site, share images and emails use those in place
     of gold #F5C842 and navy #000E2E. Cards are #062664. The dark-mode
     neutral (Draw bar) is lighter, #7C8AA0, to stay above 3:1 on the
     lighter navy (4.5:1 on the page). Navy text on yellow is 11.3:1.
     The Supabase auth email templates changed too: paste them into the
     Supabase dashboard again.
121. **Light mode uses navy, not yellow, as its accent:** yellow on the light
     background is about 1.4:1, too faint for text, active tabs and bars.
     In light mode the accent is the logo navy #001F55 (buttons are navy
     with yellow text, 11.3:1), so the brand still reads as yellow-and-navy.
     The Home bar is navy, Away stays light blue, Draw grey.
122. **Match of the Week:** chosen automatically each week, in this order:
     the Upset Alert with the highest away-win chance; else the closest
     match (smallest home/away gap, "Closest call"); else, when the next
     matchday is over 8 days away or has no open matches, "The Ballboy's
     week" (last matchday's record and the top two); else, before any
     data, "Beat the Ballboy". The admin can choose any open match of the
     current matchday instead (site_settings.motw_override). Each week has
     its own link (/motw/md15, /motw/recap14, /motw/start) so X fetches a
     fresh card every week; /motw redirects to this week's.
123. **Sharing to X without the paid API:** "Post on X" opens X's post
     intent with the text, the link and "via @NaijaBallboy" filled in; X
     shows the 1200×630 card from the link. "Save image" downloads the
     1080×1350 portrait poster for Instagram, WhatsApp or a manual post.
     Auto-posting would need the paid X API, so it's out.
124. **Crests on the site, never on share images:** the owner chose to show
     club crests on the site while rights are sorted. Admin uploads them
     (PNG, WebP or JPEG, 512 KB, public "crests" bucket via the service
     role); the browser suggests the team's colours from the crest for the
     admin to confirm. A site-wide "Hide all crests" switch removes them at
     once for a quick takedown, and the footer says the site is not
     affiliated with the NPFL or any club. Share images use colours and
     codes only, so nothing trademarked travels on X or Instagram.
125. **No photos for now:** photos from X belong to their photographers
     and a credit isn't permission, so the site uses graphics only (team
     colours, codes, the Adire pattern, the logo).
126. **Desktop sidebar:** on wide screens the five tabs and the menu live in
     a left sidebar with the logo; phones keep the top bar and the bottom
     tabs, which now have icons and a clearer active state (bold, a bar on
     top) that also works in light mode.
127. **Header lockup:** the logo next to the site name clashed, so the
     header and sidebar show "Ballboy Sabi" in text with "by TNB." small
     underneath (the logo mark). Share images keep the logo beside the name.
128. **2026/27 club colours, cities and crests:** proposed from images the
     owner supplied (this season's kits, a crest sheet, a club map), in
     `supabase/data/2026-27-clubs.sql` for the owner to run and then check
     in admin. Main colour is the kit's dominant colour (or the crest's
     where the kit is white); text colour passes 4.5:1 on it. Crests are
     cut from the owner's sheet (about 65 px, transparent) and served from
     `web/public/crests`; sharper uploads through admin replace them. The
     kit photos are only a colour reference and never go on the site: they
     carry sponsors' logos, including betting brands.
129. **Short names:** the first three letters of the club's name; where two
     clubs share them, the first letter of the first word and the first two
     of the second. Exceptions: Shooting Stars 3SC, Abia Warriors AWA, Enugu
     Rangers RAN (so Ranchers Bees are RBE). Codes may contain digits.
130. **Owner's colour corrections:** Inter Lagos pink with navy-blue; Ikorodu
     City maroon and gold; Nasarawa United a pale (desaturated) yellow with
     green; Niger Tornadoes blue; Sporting Lagos blue and white. The
     green-and-yellow clubs (Kano Pillars, Katsina United, Plateau United,
     Kwara United) use yellow as the main colour and green as the second,
     like their yellow home and green away kits.
131. **Colour clashes:** on posters and match headers, when the two clubs'
     main colours look alike (redmean distance under 120), the away side
     switches to its second colour, like an away kit. Codes sit in each
     team's text colour, which passes 4.5:1 on its band.
132. **Big match tags:** derbies come from a short list of pairings
     confirmed by news reports (`web/src/config/rivalries.ts`, sources in
     `docs/club-research.md`). Table tags come from the site's own table,
     only before kick-off and once both clubs have played five games:
     Top-two clash (1st v 2nd), Top-of-table clash (both top three), Top v
     bottom (top three v bottom four), Relegation battle (both bottom five).
     They show on fixture cards, and /admin → Match of the Week lists the
     matchday's big matches for planning articles and posts.
133. **"Strength", not "Elo", on the site:** the Elo rating is shown as the
     club's strength ("6th strongest of 20", "Strength since 2021/22"),
     with one plain sentence saying it's an Elo rating worked out from
     results. Bendel Insurance's colours corrected to yellow first, green
     second (owner).
134. **"Refresh the site" button** (/admin → Teams & Seasons): after data is
     changed straight in Supabase, it marks every cached page stale so the
     change shows at once instead of within a few hours.
135. **Yellow is back in light mode (replaces part of 121):** the owner
     wanted yellow kept wherever it works. Light mode now uses yellow for
     fills, exactly as dark mode does: buttons, the active sidebar item,
     the Matchday banner, chosen picks, derby tags, the Home share of the
     probability bars, the champions' zone bar and the active-tab marker,
     all with navy text on yellow (11.3:1). Navy replaces yellow only where
     yellow would be text, a thin border or a focus ring on the light
     background (about 1.4:1). Two tokens: `bg-primary` (fill, yellow in
     both modes) and `text-ink` / `border-ink` / `ring` (yellow in dark
     mode, navy in light).
136. **"The Ballboy", not "the model", on the site:** fans play against the
     Ballboy, so every fan-facing mention says so ("Ballboy: 44% / 29% /
     27%", "results the Ballboy thought unlikely", "How the Ballboy works").
     The leaderboard marks the Ballboy's row "To beat". Code and admin
     screens still say "model".
137. **Table season picker is a dropdown** (no JavaScript): the current
     season shows by default; earlier seasons are one tap away.
138. **NPFL news on Home:** headlines from Nigerian outlets' public RSS feeds
     (`web/src/config/news.ts`), the same mechanism as the Substack card:
     headline, outlet, date and a link out, never the article text. Only
     stories from the last seven days that mention the league or a current
     club; duplicates dropped; six at most. Read once an hour; any feed that
     fails is skipped, and the card hides if none work. /admin → Match of
     the Week shows each feed's status. X and Facebook can't be read this
     way (X's API is paid; Facebook needs a business review), so they stay
     out.
139. **"Matchday N in numbers" on Home:** from the site's own data for the
     last matchday with results: how many the Ballboy called right, goals,
     biggest win, biggest upset (the result the Ballboy gave the lowest
     chance, under a third) and the longest current unbeaten run (three
     games or more).
140. **Fans play; the Ballboy's workings are for admins.** Fan pages no
     longer explain or expose the model: no expected goals, no "Why"
     reasons, no strength ratings, no accuracy statistics, no "how the
     Ballboy works". Accuracy moved to /admin/accuracy. "Upset Alert"
     becomes "One To Watch 🔥" everywhere fans see it (cards, Home, Match
     of the Week, share images, the weekly email). Fans' "Post on X" text
     has no numbers; the admin's "Post on X with the Ballboy's read" adds
     the percentages and the main reason, so hints at the model only go
     out in the owner's posts. Percentages, likely scores and points stay:
     they are what fans play against.
141. **Fan navigation is just the five tabs.** The fifth tab reads "Me" only
     for someone logged in; otherwise "Log in" on phones and "Sign up / Log
     in" on desktop, linking to /login (which links to sign-up). The phone
     "Menu" and the sidebar's secondary links (Teams, Head-to-Head, How It
     Works, Substack) are gone, per the owner; those pages still exist and
     are linked from where they're relevant (team names go to team pages).
     Home's second list of Ones To Watch is titled "Other matches".
142. **Compact footer:** the main pages; Follow: X, Instagram, Substack, and
     "Email me" once NEXT_PUBLIC_CONTACT_EMAIL is set; then one line of
     small print (©, free to play, not affiliated, times in WAT).
143. **Light/dark switch for everyone:** a sun/moon button in the phone
     header and the desktop sidebar (it was a setting on the Me page). Dark
     stays the default; the choice is kept on the device.
144. **Data check with one-tap fixes:** the scheduled NPFL data check (a
     Claude run, Sunday and Wednesday nights) posts the fixes it suggests to
     /api/data-check (Bearer DATA_CHECK_SECRET; the key lives in Vercel and
     in the Claude environment's network secrets, never in the repo). They
     wait in /admin → Data check with the source and what the site shows
     now; Apply goes through the same admin action as entering it by hand
     (result, postponement, kick-off time, point deduction), Dismiss drops
     it. Nothing changes until an admin taps Apply. Repeats of a waiting
     fix are skipped.
145. **Goal deductions:** the league often docks goals as well as points
     ("3 points and 3 goals"). A deduction now has points, goals or both;
     deducted goals come off goal difference in the table view
     (`goals_deducted` column), the admin form has a Goals field, the note
     under the table says "3 points and 3 goals deducted", and the data
     check sends both.
146. **News categories and image library:** NPFL headlines are sorted into
     twelve categories by their words (Discipline, Managers, Transfers,
     Injuries, Previews, Results, Table, Awards, Continental and cup, Super
     Eagles, Club business, Fans and stadiums; else General), in
     `web/src/config/news-categories.ts` with an image brief for each.
     Admins upload 3 to 5 generic images per category in /admin → Images
     (public "news-images" bucket, PNG/WebP/JPEG up to 1.5 MB, source noted
     for every image). Each headline on Home shows its category and a steady
     pick from that category's images (General if the category has none),
     in greyscale under a navy wash with a yellow edge so mixed sources look
     like one set. Rules: no crests, kits, faces, stadium names, sponsor
     logos or betting imagery.
147. **YouTube links on matches:** official channels only. For 2026/27 that
     is @NigeriaPFL and @MBI_Sport (the league's authorised streamers);
     2025/26 games were on @NPFLLive (`web/src/config/youtube.ts`). An admin
     pastes a video on the match in /admin → Fixtures or Results and marks it
     "Watch live", "Watch highlights" or "Watch the full match"; the data
     check can suggest one for one-tap Apply. The match page plays it in
     place (youtube-nocookie embed, nothing loads until the fan presses
     play) and the card links to it. With no video set, kicked-off and
     played matches link to a search of the official channel instead. Links
     are stored as plain `youtube.com/watch?v=` URLs; re-uploads are never
     linked.
148. **Share menu on every match:** "Post on X" became "Share…" on the
     Match of the Week, every match card and the match page: X, Facebook,
     WhatsApp, Instagram, Telegram, Threads, "Copy post and link", and the
     phone's own share sheet where there is one. Every post ends with the
     same sign-off ("Beat the Ballboy: the free NPFL predictions game by
     That Naija Ballboy (@NaijaBallboy). No money involved, ever.") and the
     link back (`web/src/lib/share-post.ts`); on X the handle comes from
     "via @NaijaBallboy" instead. Facebook and Instagram can't take text from
     a link, so the post is copied for the fan to paste; Instagram gets the
     share image through the phone's share sheet, or saved, where that isn't
     possible. Fans' posts carry no model numbers. The admin keeps "Post on
     X with the Ballboy's read" for their own posts.
149. **Google sign-in on phones:** the site asks Supabase to send fans back to
     `/auth/callback`. When Supabase doesn't accept that address it sends
     them to its Site URL instead, with the sign-in code on the page, where
     nothing finished the sign-in. Any page that gets a `?code=` now passes
     it on to `/auth/callback`, then returns to that page. The "logged in"
     test (proxy and header) now ignores Supabase's short-lived
     `...-code-verifier` cookies, so a half-finished sign-in no longer counts.
     Supabase → Authentication → URL Configuration must have Site URL
     `https://ballboy-sabi.vercel.app` and Redirect URL
     `https://ballboy-sabi.vercel.app/**` (README checklist).
150. **SEO and AEO:**
     - **Titles and descriptions.** Every public page has a keyword-first title,
       a plain description and a canonical link. Match pages are titled
       "<Home> vs <Away> prediction" (or the score once played), and their
       description gives the Ballboy's percentages.
     - **Structured data.** Built in `web/src/lib/seo.tsx`:
       - Every page: WebSite and Organization.
       - Match pages: SportsEvent.
       - Team pages: SportsTeam.
       - About: FAQPage, behind a new visible Questions section.
     - **Answer engines.** `/llms.txt` summarises the site.
     - **Search Console.** Verification uses `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
     - **Share posts.** They carry `#NPFL`.
     - **Writing rules.** `docs/seo-aeo.md` governs site copy, articles and
       posts. The weekly brief now includes an article pack (titles,
       subtitle, slug, question headings, links, alt text).
151. **Calmer dark mode:** dark mode's background moves from the logo navy
     #001F55 (fully saturated, it glowed on screens) to deep navy #0A1730, and
     cards from #062664 to #12223F: the same blue hue with less saturation.
     The logo navy stays wherever the brand mark is: text on yellow, light
     mode, share images, emails. The Match of the Week "Share…" button is now
     yellow with navy text instead of white.
152. **"No money involved, ever." only where it reassures:**
     - **Full line** (`FREE_TO_PLAY_LINE`): the sign-up and log-in pages, and
       About's "Is it free?" answer.
     - **"Free to play"** (`FREE_SHORT`): the footer, share images, the Match
       of the Week poster and emails.
     - **Dropped:** share sign-offs, X posts and llms.txt. The owner found it
       preachy when repeated everywhere.
     - This supersedes the sign-off wording in 148.
153. **The Share menu floats over the page:** it renders in a portal with a
     fixed position, below the button or above it when there isn't room
     (allowing for the phone tab bar), so cards with hidden overflow, like
     the Match of the Week, can't clip it. It follows its button when the
     page scrolls or resizes, and closes on Escape or a tap elsewhere.
