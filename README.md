# That Naija Ballboy: NPFL predictions

A free, mobile-first site with data-driven NPFL match predictions and the
*Beat the Ballboy* prediction game. Free to play. No money involved, ever.

| Folder | What it holds |
| --- | --- |
| `web/` | The site: Next.js (App Router), TypeScript, Tailwind, shadcn/ui. Hosted on Vercel. |
| `model/` | The prediction engine (Python), run by GitHub Actions |
| `supabase/` | Database migrations, seed script, auth email templates, tests |
| `data/` | Source CSVs (the 2026/27 fixtures) |
| `.github/workflows/` | CI, and the model run |

Choices the spec left open are recorded in `DECISIONS.md`.

## Adding results (the weekly job)

1. Log in and open **/admin**. *Needs results* lists every match that has
   kicked off without a score, oldest first.
2. Set the score with + and −, pick the status (Played, Postponed, Abandoned,
   Awarded) and press **Save**, then **Confirm**.
3. That's it: the table and everyone's points update at once, and a model
   run starts. The line at the top shows *queued → running → done* (about a
   minute). If it says *failed*, the reason is shown and the previous
   predictions stay up.

Wrong score? Fix it in **Results history**: picks are rescored and the
model runs again. New fixtures or changed kick-off times go in **Fixtures**
(one at a time, or a CSV with `date,time,home,away,matchday`).

## Running it locally

```bash
cp .env.example web/.env.local          # fill in the Supabase values
cd web && npm install && npm run dev    # http://localhost:3000
```

The model (Python 3.11):

```bash
pip install -r model/requirements.txt
python -m model.evaluate --source files   # walk-forward test from the source files
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m model.run --dry-run
```

## Tests

CI runs all of these on every push.

```bash
supabase/tests/run_db_tests.sh postgresql://postgres@localhost:5432/postgres   # migrations, RLS, scoring
supabase/tests/run_seed_test.sh postgresql://postgres@localhost:5432/postgres  # seed, needs postgrest
supabase/tests/run_e2e.sh postgresql://postgres@localhost:5432/postgres        # end to end, needs postgrest + Playwright
python -m pytest -q model/tests && (cd supabase/seed && pytest -q)
cd web && npm run lint && npm run typecheck && npm run build
```

Point these at a throwaway Postgres server, never at the Supabase project.

## Deploying

The site deploys to **Vercel** from `main`. In Vercel: *Add New → Project →*
import this repository, set **Root Directory** to `web`, add the environment
variables below, and deploy. Vercel picks up the two daily cron jobs from
`web/vercel.json` (email at 03:00 UTC, keep-awake at 06:17 UTC).

Database changes go in `supabase/migrations`. Apply them with
`npx supabase link --project-ref <ref>` then `npx supabase db push`, and
regenerate `web/src/lib/supabase/database.types.ts` with
`npx supabase gen types typescript --project-id <ref> --schema public`.

### Environment variables (Vercel → Project → Settings → Environment Variables)

Every variable is described in `.env.example`. For three of them, invent a
long random string (32 or more characters) and keep a copy:
`REVALIDATE_SECRET`, `CRON_SECRET` and `UNSUBSCRIBE_SECRET`.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The site's address, e.g. `https://ballboy-sabi.vercel.app` (your real address, no slash at the end) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (`sb_secret_…`) |
| `GITHUB_DISPATCH_TOKEN` | Fine-grained GitHub token, this repo only: Contents and Actions, read and write |
| `GITHUB_REPOSITORY` | `vans-repo/ballboy-sabi` |
| `REVALIDATE_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET` | Your random strings |
| `BREVO_API_KEY` | Brevo → SMTP & API → API keys |
| `EMAIL_FROM_ADDRESS` | A sender verified in Brevo |
| `EMAIL_FROM_NAME` | `That Naija Ballboy` |
| Optional | `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `EMAIL_DAILY_LIMIT`, `EMAIL_TEST_ADDRESS` |

## Launch checklist

- [ ] **Merge to `main`.** GitHub runs the model workflow only from the default branch.
- [ ] **Vercel:** project created (Root Directory `web`), every variable above set, deployed.
- [ ] **GitHub → Settings → Secrets and variables → Actions:**
  secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (done),
  `REVALIDATE_URL` = `https://<your site>/api/revalidate`, `REVALIDATE_SECRET` (same as Vercel);
  variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` (done).
- [ ] **Supabase → Authentication → URL Configuration:** Site URL = your site;
  add `https://<your site>/auth/callback` to Redirect URLs.
- [ ] **Google sign-in:** in Google Cloud Console create an OAuth client (Web
  application) with the redirect URI
  `https://<project-ref>.supabase.co/auth/v1/callback`; then Supabase →
  Authentication → Sign In / Providers → Google: paste the client ID and secret, enable.
- [ ] **Brevo SMTP for auth emails:** Supabase → Authentication → Emails →
  SMTP settings: host `smtp-relay.brevo.com`, port `587`, the SMTP login and
  key from Brevo (SMTP & API → SMTP), sender = your verified Brevo sender.
  Then paste `supabase/templates/confirm.html` and `recovery.html` into the
  Confirm signup and Reset password templates (subjects in `supabase/templates/README.md`).
- [ ] **Make yourself admin:** sign up on the site, then in Supabase → SQL Editor run
  `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
- [ ] **Smoke test:** open `/api/health` (should say `ok`), save a result in
  /admin and watch the run reach *done*, send a test preview from
  /admin → Emails, and share a match on WhatsApp to see its image.

### Redesign, Match of the Week and crests (November 2026)

- [ ] **Before merging**, run `supabase/migrations/20261123000100_crests_and_settings.sql`
  in Supabase → SQL Editor (paste the whole file, Run). It adds the crest
  column, the `crests` storage bucket and two settings. The new site reads
  the crest column, so it must exist first.
- [ ] Paste `supabase/templates/confirm.html` and `recovery.html` into the
  Supabase auth email templates again (new colours).
- [ ] **After it's live**, run `supabase/data/2026-27-clubs.sql` in the SQL
  Editor: colours, cities and crests for the 20 clubs. Then check them in admin.
- [ ] /admin → Teams & Seasons: check each team's colours (they appear on the
  Match of the Week images) and upload crests if you want them on the site.
  "Hide all crests" removes every crest at once.
- [ ] /admin → Match of the Week: check this week's pick, or choose another match.

### Data check (November 2026)

- [ ] Run `supabase/migrations/20261124000100_data_suggestions.sql` in the SQL Editor.
- [ ] Vercel → Environment Variables: `DATA_CHECK_SECRET` (Sensitive) = the same
  value saved as the "Data check key" in the Claude environment. Redeploy.

### Goal deductions and news images (November 2026)

- [ ] Run `supabase/migrations/20261124000200_goal_deductions_and_news_images.sql`
  in the SQL Editor before merging.
- [ ] /admin → Images: add 3 to 5 generic images per category.

Free tiers only: Vercel Hobby (non-commercial, so ads and sponsors stay
off), Supabase Free, GitHub Actions free minutes, Brevo Free (300 emails a day).
