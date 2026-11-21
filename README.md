# That Naija Ballboy: NPFL predictions

A free, mobile-first site with data-driven NPFL match predictions and the
*Beat the Ballboy* prediction game. Free to play. No money involved, ever.

> Work in progress. The full guide to running, deploying and adding results
> arrives in Stage 8.

| Folder | What it holds |
| --- | --- |
| `web/` | Next.js app (App Router, TypeScript, Tailwind, shadcn/ui) |
| `model/` | Python prediction engine and tests, run by GitHub Actions |
| `supabase/` | SQL migrations, RLS tests, seed scripts |
| `data/` | Cleaned source CSVs |
| `.github/workflows/` | CI and the model workflow |

## Quick start (web)

```bash
cp .env.example web/.env.local   # then fill in the Supabase values
cd web && npm install && npm run dev
```

## Database tests

Applies every migration to a brand-new database on a disposable Postgres
server, then runs the RLS test. Never point it at the Supabase project.

```bash
supabase/tests/run_db_tests.sh postgresql://postgres@localhost:5432/postgres
```

## Loading the data (seed)

Loads teams and aliases, five seasons of results (2021/22 to 2025/26), the
2026/27 season with `data/fixtures_2026_27.csv` when it exists, and The
Ballboy, then prints a summary. Safe to run again: it only adds what is
missing, and fills in 2026/27 fixtures that are still scheduled.

```bash
pip install -r supabase/seed/requirements.txt
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret key> \
  python supabase/seed/seed.py
```

To refresh 2026/27 from a fixture list copied off a results page (one value
per line), convert it first:

```bash
python supabase/seed/tools/paste_to_csv.py pasted.txt   # writes data/fixtures_2026_27.csv
```

After signing up on the site, make your account the admin with
`--admin-email you@example.com`.

Seed tests (unit tests, then a full load into a disposable database through a
local PostgREST, the same API Supabase runs):

```bash
cd supabase/seed && pytest -q && cd ../..
supabase/tests/run_seed_test.sh postgresql://postgres@localhost:5432/postgres
```

## Prediction engine

From the repo root, with `pip install -r model/requirements.txt`:

```bash
python -m pytest -q model/tests                 # tests, from the source files
python -m model.evaluate --source files         # walk-forward report (or omit --source for Supabase)
python -m model.tune --source files             # grid search; never edits config.yaml
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m model.run --dry-run
```

In production, `.github/workflows/model.yml` runs `python -m model.run` when a
result is saved, every day at 05:00 UTC, and on demand. It needs the GitHub
secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (and, once the site is
live, `REVALIDATE_URL` and `REVALIDATE_SECRET`).

## Applying migrations to Supabase

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

After changing a migration, regenerate `web/src/lib/supabase/database.types.ts`:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public
```

See `DECISIONS.md` for choices made where the spec left room.
