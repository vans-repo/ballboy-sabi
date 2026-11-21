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

## Applying migrations to Supabase

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

See `DECISIONS.md` for choices made where the spec left room.
