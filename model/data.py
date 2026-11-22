"""Load matches into one DataFrame, from Supabase or from the source files.

Columns: id, season, season_index (0 = oldest), kickoff (UTC), estimated,
source_order, home_id, away_id, home_goals, away_goals, status,
exclude_from_model, matchday, time_confirmed.
Teams: id -> name.

Loading from files (reference CSVs plus data/fixtures_2026_27.csv) goes
through the seed's own parsing, so it matches what the seed loads. It is used
by the tests and by `python -m model.evaluate --source files`.
"""

from __future__ import annotations

import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from model.db import Supabase

ROOT = Path(__file__).resolve().parents[1]
PLAYED = ("played", "awarded")
UPCOMING = ("scheduled", "postponed")
COLUMNS = [
    "id", "season", "kickoff", "estimated", "source_order", "home_id", "away_id", "home_goals",
    "away_goals", "status", "exclude_from_model", "matchday", "time_confirmed",
]  # fmt: skip


@dataclass
class Dataset:
    matches: pd.DataFrame
    teams: dict[str, str]  # id -> name
    seasons: list[str]  # oldest first

    @property
    def model_inputs(self) -> pd.DataFrame:
        """Matches the model learns from: played (or awarded), not excluded."""
        m = self.matches
        return m[m.status.isin(PLAYED) & ~m.exclude_from_model]

    def completed_seasons(self) -> list[str]:
        """Seasons with no matches left to play, oldest first."""
        open_seasons = set(self.matches.loc[self.matches.status.isin(UPCOMING), "season"])
        return [s for s in self.seasons if s not in open_seasons]


def _finish(df: pd.DataFrame, teams: dict[str, str], season_order: list[str]) -> Dataset:
    df = df[COLUMNS].copy()
    # ISO 8601 with or without fractions of a second ("…:00+00:00", "…:24.367965+00:00").
    df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, format="ISO8601")
    df["season_index"] = df["season"].map({s: i for i, s in enumerate(season_order)})
    df["source_order"] = df["source_order"].astype("Float64")
    df = df.sort_values(["kickoff", "season_index", "source_order", "id"], na_position="last")
    return Dataset(df.reset_index(drop=True), teams, season_order)


def load_from_supabase(db: Supabase) -> Dataset:
    seasons = sorted(db.select("seasons", "id,label,start_date"), key=lambda s: s["start_date"])
    label = {s["id"]: s["label"] for s in seasons}
    matchdays = {m["id"]: m["number"] for m in db.select("matchdays", "id,number")}
    teams = {t["id"]: t["name"] for t in db.select("teams", "id,name")}
    rows = db.select(
        "matches",
        "id,season_id,matchday_id,home_team_id,away_team_id,kickoff_at,kickoff_estimated,"
        "kickoff_time_confirmed,source_order,status,home_goals,away_goals,exclude_from_model",
    )
    df = pd.DataFrame(rows)
    df = df.rename(
        columns={
            "home_team_id": "home_id", "away_team_id": "away_id", "kickoff_at": "kickoff",
            "kickoff_estimated": "estimated", "kickoff_time_confirmed": "time_confirmed",
        }
    )  # fmt: skip
    df["season"] = df["season_id"].map(label)
    df["matchday"] = df["matchday_id"].map(matchdays)
    return _finish(df, teams, [s["label"] for s in seasons])


def load_from_files(fixtures: Path | None = None) -> Dataset:
    """Same data as the seed loads, with stable fake ids (uuid5 of the name)."""
    sys.path.insert(0, str(ROOT / "supabase/seed"))
    from seedlib.plan import ALL_SEASONS, build_plan  # noqa: PLC0415
    from seedlib.sources import (  # noqa: PLC0415
        load_team_catalogue,
        read_chronological,
        read_fixtures,
        read_historical,
    )

    catalogue = load_team_catalogue(ROOT / "supabase/seed/teams.yaml")
    ids = {t.name: str(uuid.uuid5(uuid.NAMESPACE_DNS, t.name)) for t in catalogue}
    aliases = {a: ids[t.name] for t in catalogue for a in t.aliases}
    ref = ROOT / "reference"
    fixtures_file = read_fixtures(fixtures or ROOT / "data/fixtures_2026_27.csv", "2026/27")
    plan = build_plan(
        read_historical(ref / "npfl_historical_data.csv"),
        read_chronological(ref / "naijaball-main/npfl_system/data/raw/npfl_chronological_data.csv"),
        fixtures_file.matches if not fixtures_file.errors else [],
        aliases,
    )
    rows = [
        {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{m.season}/{m.home_team_id}/{m.away_team_id}")),
            "season": m.season,
            "kickoff": m.kickoff_at,
            "estimated": m.kickoff_estimated,
            "source_order": m.source_order,
            "home_id": m.home_team_id,
            "away_id": m.away_team_id,
            "home_goals": m.home_goals,
            "away_goals": m.away_goals,
            "status": m.status,
            "exclude_from_model": m.status == "awarded",
            "matchday": m.matchday,
            "time_confirmed": m.time_confirmed,
        }  # fmt: skip
        for m in plan.matches
    ]
    seasons = [s for s in ALL_SEASONS if any(r["season"] == s for r in rows)]
    return _finish(pd.DataFrame(rows), {v: k for k, v in ids.items()}, seasons)
