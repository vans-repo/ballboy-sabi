#!/usr/bin/env bash
# Apply every migration to a brand-new database, then run the RLS test.
#
# Usage: supabase/tests/run_db_tests.sh [ADMIN_DATABASE_URL]
#   ADMIN_DATABASE_URL must point at a superuser on a disposable Postgres
#   server (local or CI), never at the Supabase project. Defaults to
#   postgresql://postgres@localhost:5432/postgres.
set -euo pipefail

ADMIN_URL="${1:-${ADMIN_DATABASE_URL:-postgresql://postgres@localhost:5432/postgres}}"
TEST_DB="ballboy_test_$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

test_url() {
  # Swap the database name at the end of ADMIN_URL for TEST_DB, keeping any ?query.
  python3 -c 'import sys,urllib.parse as u; p=u.urlparse(sys.argv[1]); print(u.urlunparse(p._replace(path="/"+sys.argv[2])))' "$ADMIN_URL" "$TEST_DB"
}

cleanup() { psql "$ADMIN_URL" -q -c "drop database if exists $TEST_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "create database $TEST_DB"
DB_URL="$(test_url)"

echo "== Supabase stand-in (test only)"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$HERE/supabase_stub.sql"

echo "== Migrations"
for f in "$MIGRATIONS"/*.sql; do
  echo "   $(basename "$f")"
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -1 -f "$f"
done

echo "== RLS test"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$HERE/rls_test.sql"

echo "== Scoring test"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$HERE/scoring_test.sql"
