"""TEST ONLY: a local stand-in for a Supabase project's HTTP API.

Serves /rest/v1/* by passing requests to a local PostgREST, and implements
the two Auth admin calls the seed makes (create a user, list users) against
the stub auth.users table from supabase_stub.sql. Never used with the real
project.

Usage: python fake_supabase.py PORT POSTGREST_URL DATABASE_URL API_KEY
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT, POSTGREST, DB_URL, API_KEY = int(sys.argv[1]), sys.argv[2].rstrip("/"), sys.argv[3], sys.argv[4]


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
        if self.headers.get("apikey") != API_KEY:
            return self.reply(401, b'{"message":"bad apikey"}')
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        path = urlparse(self.path).path
        if path.startswith("/rest/v1/"):
            return self.proxy(body)
        if path == "/auth/v1/admin/users":
            return self.users(body)
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

    do_GET = do_POST = do_PATCH = do_DELETE = handle_any


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
