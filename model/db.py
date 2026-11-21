"""Minimal client for Supabase's REST API with the service role key.

The key bypasses RLS, so this runs only in the GitHub Actions job (or a
trusted shell), never in the browser.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable
from typing import Any

import httpx

PAGE = 1000
CHUNK = 500


class SupabaseError(RuntimeError):
    pass


class Supabase:
    def __init__(self, url: str, key: str, timeout: float = 60.0) -> None:
        self.url = url.rstrip("/").removesuffix("/rest/v1")
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # legacy JWT keys also need Authorization
            headers["Authorization"] = f"Bearer {key}"
        self.http = httpx.Client(timeout=timeout, headers=headers)

    @classmethod
    def from_env(cls) -> Supabase:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        return cls(url, key)

    def close(self) -> None:
        self.http.close()

    def _check(self, r: httpx.Response) -> Any:
        if r.status_code >= 400:
            raise SupabaseError(f"{r.request.method} {r.request.url.path} -> {r.status_code}: {r.text}")
        return r.json() if r.content else None

    def select(self, table: str, columns: str = "*", **filters: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            params = {
                "select": columns,
                "order": "id",
                "limit": str(PAGE),
                "offset": str(offset),
                **filters,
            }
            batch = self._check(self.http.get(f"{self.url}/rest/v1/{table}", params=params))
            rows += batch
            if len(batch) < PAGE:
                return rows
            offset += PAGE

    def insert(
        self,
        table: str,
        rows: Iterable[dict[str, Any]],
        on_conflict: str | None = None,
        merge: bool = False,
    ) -> int:
        """Insert rows. With on_conflict, existing rows are updated (merge) or skipped."""
        rows = list(rows)
        prefer, params = "return=minimal", {}
        if on_conflict:
            prefer += ",resolution=" + ("merge-duplicates" if merge else "ignore-duplicates")
            params["on_conflict"] = on_conflict
        for i in range(0, len(rows), CHUNK):
            self._check(
                self.http.post(
                    f"{self.url}/rest/v1/{table}",
                    params=params,
                    headers={"Prefer": prefer},
                    content=json.dumps(rows[i : i + CHUNK], default=str),
                )
            )
        return len(rows)

    def insert_one(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        r = self.http.post(
            f"{self.url}/rest/v1/{table}",
            headers={"Prefer": "return=representation"},
            content=json.dumps(row, default=str),
        )
        return self._check(r)[0]

    def update(self, table: str, values: dict[str, Any], **filters: str) -> list[dict[str, Any]]:
        r = self.http.patch(
            f"{self.url}/rest/v1/{table}",
            params=filters,
            headers={"Prefer": "return=representation"},
            content=json.dumps(values, default=str),
        )
        return self._check(r)
