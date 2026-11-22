#!/usr/bin/env bash
# Load the seed into a brand-new database through the same HTTP API Supabase
# exposes (a local PostgREST plus fake_supabase.py for the Auth admin calls),
# then check the result and that a second run changes nothing.
#
# Usage: supabase/tests/run_seed_test.sh [ADMIN_DATABASE_URL]
#   ADMIN_DATABASE_URL: a superuser on a disposable Postgres server, never the
#   Supabase project. Needs `postgrest` on PATH (or POSTGREST_BIN) and the
#   packages in supabase/seed/requirements.txt.
set -euo pipefail

ADMIN_URL="${1:-${ADMIN_DATABASE_URL:-postgresql://postgres@localhost:5432/postgres}}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
TEST_DB="ballboy_seed_test_$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
REST_PORT=3101
API_PORT=3100
WORK="$(mktemp -d)"

DB_URL="$(python3 -c 'import sys,urllib.parse as u; p=u.urlparse(sys.argv[1]); print(u.urlunparse(p._replace(path="/"+sys.argv[2])))' "$ADMIN_URL" "$TEST_DB")"

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${REST_PID:-}" ]] && kill "$REST_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  psql "$ADMIN_URL" -q -c "drop database if exists $TEST_DB" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== Fresh database with migrations"
psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "create database $TEST_DB"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -1 -f "$f"
done

echo "== Local API (PostgREST + Auth admin stand-in)"
JWT_SECRET="local-test-secret-$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
SERVICE_KEY="$(python3 - "$JWT_SECRET" <<'PY'
import base64, hashlib, hmac, json, sys
enc = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
head = enc(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
body = enc(json.dumps({"role": "service_role"}).encode())
sig = enc(hmac.new(sys.argv[1].encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
print(f"{head}.{body}.{sig}")
PY
)"
PGRST_DB_URI="$DB_URL" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=crit \
  "$POSTGREST_BIN" >"$WORK/postgrest.log" 2>&1 &
REST_PID=$!
python3 "$HERE/fake_supabase.py" $API_PORT "http://127.0.0.1:$REST_PORT" "$DB_URL" "$SERVICE_KEY" "$JWT_SECRET" &
API_PID=$!
for _ in $(seq 1 50); do
  curl -sf -o /dev/null "http://127.0.0.1:$REST_PORT/" && break
  sleep 0.2
done

# The site owner's account, as if they had signed up.
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c \
  "insert into auth.users (email, raw_user_meta_data) values ('owner@example.com', '{\"display_name\": \"Site Owner\"}')"

export SUPABASE_URL="http://127.0.0.1:$API_PORT" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
SEED=(python3 "$ROOT/supabase/seed/seed.py" --fixtures "$HERE/seed_sample_fixtures.csv" --admin-email owner@example.com)

counts() {
  psql "$DB_URL" -At -c "select (select count(*) from public.teams), (select count(*) from public.team_aliases),
    (select count(*) from public.seasons), (select count(*) from public.season_teams),
    (select count(*) from public.matchdays), (select count(*) from public.matches),
    (select count(*) from public.profiles), (select count(*) from auth.users),
    (select md5(string_agg(id::text || status || coalesce(home_goals, -1) || kickoff_at, ',' order by id)) from public.matches)"
}

echo "== Seed, first run"
"${SEED[@]}" | tee "$WORK/run1.txt"
FIRST="$(counts)"

echo "== Seed checks"
psql "$DB_URL" -q -f "$HERE/seed_test.sql"

echo "== Seed, second run (must change nothing)"
"${SEED[@]}" >"$WORK/run2.txt"
SECOND="$(counts)"
grep -q "added 0 teams, 0 aliases, 0 seasons and 0 matches, and updated 0 fixtures" "$WORK/run2.txt" \
  || { echo "FAIL: second run reported changes"; grep "This run" "$WORK/run2.txt"; exit 1; }
[[ "$FIRST" == "$SECOND" ]] || { echo "FAIL: second run changed the data: $FIRST vs $SECOND"; exit 1; }
grep -q "The Ballboy: already set up" "$WORK/run2.txt" || { echo "FAIL: Ballboy re-created"; exit 1; }
echo "   second run changed nothing"

echo "== Seed, corrected fixtures file (fills one result, moves one kick-off)"
sed -e 's/^2026-09-05,18:00,3SC,Rivers United,1,,$/2026-09-05,18:00,3SC,Rivers United,1,0,0/' \
    -e 's/^2026-09-12,16:00,Rivers United,Enyimba,2,,$/2026-09-13,17:00,Rivers United,Enyimba,2,,/' \
    "$HERE/seed_sample_fixtures.csv" >"$WORK/fixtures_v2.csv"
python3 "$ROOT/supabase/seed/seed.py" --fixtures "$WORK/fixtures_v2.csv" >"$WORK/run3.txt"
grep -q "and 0 matches, and updated 2 fixtures" "$WORK/run3.txt" \
  || { echo "FAIL: expected 2 fixture updates"; grep "This run" "$WORK/run3.txt"; exit 1; }
CHECK="$(psql "$DB_URL" -At -c "select string_agg(t.name || ':' || m.status || ':' || coalesce(m.home_goals::text, '') || ':' ||
  to_char(m.kickoff_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI'), ',' order by m.kickoff_at, t.name)
  from public.matches m join public.teams t on t.id = m.home_team_id
  join public.seasons s on s.id = m.season_id where s.label = '2026/27'")"
EXPECTED="Enyimba:played:2:2026-09-05 16:00,Shooting Stars:played:0:2026-09-05 18:00,Kano Pillars:scheduled::2026-09-12 16:00,Rivers United:scheduled::2026-09-13 17:00"
[[ "$CHECK" == "$EXPECTED" ]] || { echo "FAIL: 2026/27 after correction: $CHECK"; exit 1; }
echo "   fixtures updated, played matches untouched"

echo "== Seed with no fixtures file"
python3 "$ROOT/supabase/seed/seed.py" --fixtures "$WORK/missing.csv" >"$WORK/run4.txt"
grep -q "missing.csv is missing" "$WORK/run4.txt" || { echo "FAIL: missing file not reported"; exit 1; }
echo "   missing file reported"
echo "All seed tests passed"
