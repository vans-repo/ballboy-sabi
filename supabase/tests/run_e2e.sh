#!/usr/bin/env bash
# Stage 5 end-to-end test, on a throwaway local stack (never the real project):
# fresh Postgres with every migration and the seed, PostgREST, the Auth
# stand-in (fake_supabase.py) and a production build of the site.
# The browser test itself is web/e2e/picks.e2e.mjs.
#
# Usage: supabase/tests/run_e2e.sh [ADMIN_DATABASE_URL]
#   Needs postgrest on PATH (or POSTGREST_BIN), Node with Playwright, and the
#   seed's Python packages.
set -euo pipefail

ADMIN_URL="${1:-${ADMIN_DATABASE_URL:-postgresql://postgres@localhost:5432/postgres}}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TEST_DB="ballboy_e2e_$$"
REST_PORT=3301 API_PORT=3300 WEB_PORT=3302
WORK="$(mktemp -d)"
DB_URL="$(python3 -c 'import sys,urllib.parse as u; p=u.urlparse(sys.argv[1]); print(u.urlunparse(p._replace(path="/"+sys.argv[2])))' "$ADMIN_URL" "$TEST_DB")"

cleanup() {
  for pid in ${WEB_PID:-} ${API_PID:-} ${REST_PID:-}; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  psql "$ADMIN_URL" -q -c "drop database if exists $TEST_DB" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== Database"
psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "create database $TEST_DB"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql "$DB_URL" -q -v ON_ERROR_STOP=1 -1 -f "$f"; done

echo "== Local API"
JWT_SECRET="e2e-secret-$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
jwt() {
  python3 - "$JWT_SECRET" "$1" <<'PY'
import base64, hashlib, hmac, json, sys
enc = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
h = enc(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
b = enc(json.dumps({"role": sys.argv[2], "exp": 4102444800}).encode())
print(f"{h}.{b}." + enc(hmac.new(sys.argv[1].encode(), f"{h}.{b}".encode(), hashlib.sha256).digest()))
PY
}
ANON_KEY="$(jwt anon)" SERVICE_KEY="$(jwt service_role)"
PGRST_DB_URI="$DB_URL" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
  PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=crit "$POSTGREST_BIN" >"$WORK/postgrest.log" 2>&1 &
REST_PID=$!
python3 "$HERE/fake_supabase.py" $API_PORT "http://127.0.0.1:$REST_PORT" "$DB_URL" "$ANON_KEY,$SERVICE_KEY" "$JWT_SECRET" &
API_PID=$!
for _ in $(seq 1 50); do curl -sf -o /dev/null "http://127.0.0.1:$REST_PORT/" && break; sleep 0.2; done
API="http://127.0.0.1:$API_PORT"

echo "== Seed"
SUPABASE_URL="$API" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  python3 "$ROOT/supabase/seed/seed.py" --fixtures "$HERE/seed_sample_fixtures.csv" >"$WORK/seed.txt"
grep "This run" "$WORK/seed.txt"

echo "== Admin account"
curl -sf -o /dev/null "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"admin@e2e.invalid","password":"admin-password-1","data":{"display_name":"E2E Admin"}}'
psql "$DB_URL" -q -c "update public.profiles set role = 'admin' where display_name = 'E2E Admin'"

echo "== Site (production build)"
cd "$ROOT/web"
export NEXT_PUBLIC_SUPABASE_URL="$API" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  REVALIDATE_SECRET="e2e-revalidate" NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$WEB_PORT" NEXT_TELEMETRY_DISABLED=1
node node_modules/next/dist/bin/next build >"$WORK/build.log" 2>&1 || { tail -40 "$WORK/build.log"; exit 1; }
PORT=$WEB_PORT node node_modules/next/dist/bin/next start >"$WORK/web.log" 2>&1 &
WEB_PID=$!
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/about" && break; sleep 0.5; done

echo "== Browser test"
BASE="http://127.0.0.1:$WEB_PORT" API="$API" ANON_KEY="$ANON_KEY" DB_URL="$DB_URL" \
  node "$ROOT/web/e2e/picks.e2e.mjs" || { echo "--- web log"; tail -30 "$WORK/web.log"; exit 1; }
