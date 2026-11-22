"""TEST ONLY: a local stand-in for a Supabase project's HTTP API.

Serves /rest/v1/* by passing requests to a local PostgREST, and implements
the Auth calls the seed and the site make, against the stub auth.users table
from supabase_stub.sql:
  admin: create a user, list users (seed)
  fans: sign up (auto-confirmed), log in with a password, refresh, get the
  current user, log out (site, end-to-end test)
Tokens are HS256 JWTs signed with the same secret as PostgREST, so RLS sees
the real user. Passwords live in memory only. Never used with the real project.

Usage: python fake_supabase.py PORT POSTGREST_URL DATABASE_URL API_KEYS JWT_SECRET
  API_KEYS: comma-separated keys accepted in the apikey header (anon, service)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT, POSTGREST, DB_URL = int(sys.argv[1]), sys.argv[2].rstrip("/"), sys.argv[3]
API_KEYS = set(sys.argv[4].split(","))
JWT_SECRET = sys.argv[5] if len(sys.argv) > 5 else ""
PASSWORDS: dict[str, str] = {}  # email -> password
REFRESH: dict[str, str] = {}  # refresh token -> user id
GITHUB_CALLS: list[dict] = []  # dispatches received at /github/... (stand-in for api.github.com)
USER_COLS = "id, email, raw_user_meta_data as user_metadata, created_at"


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_jwt(claims: dict) -> str:
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps(claims).encode())
    sig = b64(hmac.new(JWT_SECRET.encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
    return f"{head}.{body}.{sig}"


def read_jwt(token: str) -> dict | None:
    try:
        head, body, sig = token.split(".")
        good = b64(hmac.new(JWT_SECRET.encode(), f"{head}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        return claims if claims.get("exp", 0) > time.time() else None
    except ValueError:
        return None


def user_json(row: dict) -> dict:
    return {
        "id": row["id"], "aud": "authenticated", "role": "authenticated", "email": row["email"],
        "email_confirmed_at": row["created_at"], "user_metadata": row["user_metadata"] or {},
        "app_metadata": {"provider": "email", "providers": ["email"]}, "identities": [],
        "created_at": row["created_at"], "updated_at": row["created_at"],
    }  # fmt: skip


def session_for(row: dict) -> dict:
    now = int(time.time())
    access = make_jwt({
        "sub": row["id"], "role": "authenticated", "aud": "authenticated", "email": row["email"],
        "iat": now, "exp": now + 3600, "session_id": secrets.token_hex(8),
    })  # fmt: skip
    refresh = secrets.token_hex(16)
    REFRESH[refresh] = row["id"]
    return {
        "access_token": access, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
        "refresh_token": refresh, "user": user_json(row),
    }  # fmt: skip


def sql(query: str, *params: str) -> list[dict]:
    """Run one query with psql variables; returns rows as dicts."""
    args = ["psql", DB_URL, "-qAt", "-v", "ON_ERROR_STOP=1"]
    for i, p in enumerate(params):
        args += ["-v", f"p{i}={p}"]
    wrapped = f"with t as ({query}) select coalesce(json_agg(t), '[]') from t"
    out = subprocess.run(args, input=wrapped, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args: object) -> None:  # keep test output quiet
        pass

    def reply(self, status: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_any(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/github/"):
            return self.github(path)
        if self.headers.get("apikey") not in API_KEYS:
            return self.reply(401, b'{"message":"bad apikey"}')
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        path = urlparse(self.path).path
        if path.startswith("/rest/v1/"):
            return self.proxy(body)
        if path == "/auth/v1/admin/users":
            return self.users(body)
        if path.startswith("/auth/v1/"):
            return self.auth(path, body)
        self.reply(404, b'{"message":"not found"}')

    def proxy(self, body: bytes | None) -> None:
        url = POSTGREST + self.path[len("/rest/v1") :]
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() in ("authorization", "prefer", "content-type", "accept")
        }
        req = urllib.request.Request(url, data=body, method=self.command, headers=headers)
        try:
            with urllib.request.urlopen(req) as r:
                self.reply(r.status, r.read(), r.headers.get("Content-Type", "application/json"))
        except urllib.error.HTTPError as e:
            self.reply(e.code, e.read())

    def users(self, body: bytes | None) -> None:
        cols = "id, email, raw_user_meta_data as user_metadata"
        if self.command == "GET":
            rows = sql(f"select {cols} from auth.users order by created_at")
            return self.reply(200, json.dumps({"users": rows}).encode())
        data = json.loads(body or b"{}")
        if sql("select 1 from auth.users where lower(email) = lower(:'p0')", data["email"]):
            return self.reply(422, b'{"msg":"A user with this email address has already been registered"}')
        meta = json.dumps(data.get("user_metadata") or {})
        row = sql(
            f"insert into auth.users (email, raw_user_meta_data) values (:'p0', :'p1'::jsonb) returning {cols}",
            data["email"], meta,
        )[0]  # fmt: skip
        self.reply(200, json.dumps(row).encode())

    def github(self, path: str) -> None:
        """Records model-run dispatches; GET /github/_calls lists them."""
        if self.command == "GET" and path == "/github/_calls":
            return self.send_json(200, GITHUB_CALLS)
        if not (self.headers.get("Authorization") or "").startswith("Bearer "):
            return self.send_json(401, {"message": "Requires authentication"})
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        GITHUB_CALLS.append({"path": path, "body": body})
        self.send_response(204)
        self.end_headers()
        return None

    def send_json(self, status: int, data: object) -> None:
        self.reply(status, json.dumps(data, default=str).encode())

    def auth(self, path: str, body: bytes | None) -> None:
        data = json.loads(body) if body else {}
        query = urlparse(self.path).query
        if path == "/auth/v1/signup" and self.command == "POST":
            email = data.get("email", "").strip().lower()
            if sql("select 1 from auth.users where lower(email) = :'p0'", email):
                return self.send_json(422, {"code": 422, "error_code": "user_already_exists",
                                            "msg": "User already registered"})  # fmt: skip
            meta = json.dumps(data.get("data") or {})
            row = sql(
                f"insert into auth.users (email, raw_user_meta_data) values (:'p0', :'p1'::jsonb) returning {USER_COLS}",
                email, meta,
            )[0]  # fmt: skip
            PASSWORDS[email] = data.get("password", "")
            return self.send_json(200, session_for(row))
        if path == "/auth/v1/token" and self.command == "POST":
            if "grant_type=password" in query:
                email = data.get("email", "").strip().lower()
                rows = sql(f"select {USER_COLS} from auth.users where lower(email) = :'p0'", email)
                if not rows or PASSWORDS.get(email) != data.get("password"):
                    return self.send_json(400, {"error": "invalid_grant", "error_code": "invalid_credentials",
                                                "error_description": "Invalid login credentials"})  # fmt: skip
                return self.send_json(200, session_for(rows[0]))
            if "grant_type=refresh_token" in query:
                uid = REFRESH.pop(data.get("refresh_token", ""), None)
                rows = sql(f"select {USER_COLS} from auth.users where id = :'p0'::uuid", uid) if uid else []
                if not rows:
                    return self.send_json(
                        400, {"error": "invalid_grant", "error_code": "refresh_token_not_found"}
                    )
                return self.send_json(200, session_for(rows[0]))
        bearer = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
        claims = read_jwt(bearer) if bearer else None
        if path == "/auth/v1/user" and self.command == "GET":
            rows = (
                sql(f"select {USER_COLS} from auth.users where id = :'p0'::uuid", claims["sub"])
                if claims
                else []
            )
            if not rows:
                return self.send_json(401, {"code": 401, "error_code": "bad_jwt", "msg": "invalid JWT"})
            return self.send_json(200, user_json(rows[0]))
        if path == "/auth/v1/logout" and self.command == "POST":
            self.send_response(204)
            self.end_headers()
            return None
        return self.send_json(404, {"msg": f"not implemented in the test stand-in: {self.command} {path}"})

    do_GET = do_POST = do_PATCH = do_DELETE = handle_any


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
