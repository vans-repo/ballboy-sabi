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
30. **Typed Supabase queries come later.** `supabase gen types` needs a
    linked project, so the database types will be generated in Stage 2.
