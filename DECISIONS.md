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
