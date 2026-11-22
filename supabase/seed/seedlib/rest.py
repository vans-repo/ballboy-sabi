"""A small client for the two Supabase APIs the seed uses: the database REST
API (PostgREST, /rest/v1) and the Auth admin API (/auth/v1/admin).

Uses the service role key, which bypasses RLS. Server-side only.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

import httpx

PAGE = 1000  # Supabase returns at most 1000 rows per request by default
CHUNK = 500


class SupabaseError(RuntimeError):
    pass


class Supabase:
    def __init__(self, url: str, service_key: str, timeout: float = 60.0) -> None:
        # The project URL, e.g. https://abc.supabase.co. A copied REST URL
        # (ending in /rest/v1) is accepted too.
        self.url = url.rstrip("/").removesuffix("/rest/v1")
        headers = {"apikey": service_key, "Content-Type": "application/json"}
        # Supabase secret keys (sb_secret_...) go in the apikey header only.
        # Legacy JWT keys (and the local test API) also need Authorization.
        if service_key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {service_key}"
        self.http = httpx.Client(timeout=timeout, headers=headers)

    def close(self) -> None:
        self.http.close()

    def _check(self, r: httpx.Response) -> httpx.Response:
        if r.status_code >= 400:
            raise SupabaseError(f"{r.request.method} {r.request.url.path} -> {r.status_code}: {r.text}")
        return r

    # --- Database ---------------------------------------------------------
    def select(self, table: str, columns: str = "*", **filters: str) -> list[dict[str, Any]]:
        """All rows matching PostgREST filters, e.g. select('matches', season_id='eq.<id>')."""
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            params = {"select": columns, "order": "id", "limit": str(PAGE), "offset": str(offset), **filters}
            batch = self._check(self.http.get(f"{self.url}/rest/v1/{table}", params=params)).json()
            rows += batch
            if len(batch) < PAGE:
                return rows
            offset += PAGE

    def insert(
        self, table: str, rows: Iterable[dict[str, Any]], on_conflict: str | None = None
    ) -> list[dict[str, Any]]:
        """Insert rows; with on_conflict, rows that already exist are skipped."""
        rows = list(rows)
        out: list[dict[str, Any]] = []
        prefer = "return=representation"
        params = {}
        if on_conflict:
            prefer += ",resolution=ignore-duplicates"
            params["on_conflict"] = on_conflict
        for i in range(0, len(rows), CHUNK):
            r = self.http.post(
                f"{self.url}/rest/v1/{table}",
                params=params,
                headers={"Prefer": prefer},
                content=json.dumps(rows[i : i + CHUNK], default=str),
            )
            out += self._check(r).json()
        return out

    def update(self, table: str, values: dict[str, Any], **filters: str) -> list[dict[str, Any]]:
        r = self.http.patch(
            f"{self.url}/rest/v1/{table}",
            params=filters,
            headers={"Prefer": "return=representation"},
            content=json.dumps(values, default=str),
        )
        return self._check(r).json()

    # --- Auth admin -------------------------------------------------------
    def create_user(self, email: str, password: str, metadata: dict[str, Any]) -> dict[str, Any]:
        r = self.http.post(
            f"{self.url}/auth/v1/admin/users",
            content=json.dumps(
                {"email": email, "password": password, "email_confirm": True, "user_metadata": metadata}
            ),
        )
        return self._check(r).json()

    def find_user_by_email(self, email: str) -> dict[str, Any] | None:
        wanted = email.strip().lower()
        page = 1
        while True:
            r = self.http.get(f"{self.url}/auth/v1/admin/users", params={"page": page, "per_page": 1000})
            users = self._check(r).json().get("users", [])
            for u in users:
                if (u.get("email") or "").lower() == wanted:
                    return u
            if len(users) < 1000:
                return None
            page += 1
