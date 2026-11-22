"""Write the plan to Supabase. Safe to run more than once.

What a re-run changes, and what it leaves alone:
  - teams, aliases, seasons, matchdays, matches: missing rows are added;
    existing rows are kept as they are (admin edits win).
  - season dates are widened if loaded matches fall outside them.
  - season_teams status and group are always set from the data.
  - a 2026/27 match still 'scheduled' in the database takes the file's
    kick-off, matchday and result, so the fixtures file can be corrected and
    loaded again until the admin screens exist. Any other difference between
    a file and the database is listed in the report, and the database wins.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .plan import CURRENT_SEASON, MatchRow, Plan, build_plan, nominal_span
from .rest import Supabase
from .sources import SourceMatch, TeamSpec

BALLBOY_NAME = "The Ballboy"
# Reserved .invalid domain: this address can never receive mail.
BALLBOY_EMAIL = "the-ballboy@system.invalid"


@dataclass
class Result:
    plan: Plan
    teams_added: list[str] = field(default_factory=list)
    aliases_added: int = 0
    alias_conflicts: list[str] = field(default_factory=list)
    seasons_added: list[str] = field(default_factory=list)
    matches_added: int = 0
    matches_updated: int = 0
    kept_db_version: list[str] = field(default_factory=list)
    ballboy: str = ""
    admin: str = ""


def _ts(value: str | datetime) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(value)


def seed(
    db: Supabase,
    catalogue: list[TeamSpec],
    historical: list[SourceMatch],
    chronological: list[SourceMatch],
    fixtures: list[SourceMatch],
    admin_email: str | None = None,
) -> Result:
    # --- Teams and aliases -------------------------------------------------
    aliases = {a["alias"]: a["team_id"] for a in db.select("team_aliases", "alias,team_id")}
    teams_added: list[str] = []
    new_teams = [t for t in catalogue if not any(a in aliases for a in t.aliases)]
    if new_teams:
        rows = []
        for t in new_teams:
            row: dict[str, Any] = {
                "name": t.name, "code": t.code, "slug": t.slug,
                "city": t.city, "lat": t.lat, "lon": t.lon,
            }  # fmt: skip
            if t.primary_colour:
                row["primary_colour"] = t.primary_colour
            if t.secondary_colour:
                row["secondary_colour"] = t.secondary_colour
            rows.append(row)
        db.insert("teams", rows, on_conflict="name")
        teams_added = [t.name for t in new_teams]

    team_ids = {t["name"]: t["id"] for t in db.select("teams", "id,name")}
    result_conflicts: list[str] = []
    alias_rows = []
    for t in catalogue:
        # The team this spec belongs to: by any alias already stored, else by name.
        tid = next((aliases[a] for a in t.aliases if a in aliases), team_ids.get(t.name))
        if tid is None:
            result_conflicts.append(f"{t.name}: no team found and none could be added")
            continue
        for a in t.aliases:
            if a not in aliases:
                alias_rows.append({"alias": a, "team_id": tid})
            elif aliases[a] != tid:
                result_conflicts.append(f"alias {a!r} already belongs to another team; left unchanged")
    added_aliases = db.insert("team_aliases", alias_rows, on_conflict="alias") if alias_rows else []
    aliases = {a["alias"]: a["team_id"] for a in db.select("team_aliases", "alias,team_id")}

    plan = build_plan(historical, chronological, fixtures, aliases)
    result = Result(
        plan=plan,
        teams_added=teams_added,
        aliases_added=len(added_aliases),
        alias_conflicts=result_conflicts,
    )

    # --- Seasons ------------------------------------------------------------
    existing = {s["label"]: s for s in db.select("seasons", "id,label,start_date,end_date,is_current")}
    has_current = any(s["is_current"] for s in existing.values())
    new_seasons = []
    for s in plan.seasons:
        if s.label in existing:
            cur = existing[s.label]
            start = min(s.start_date.isoformat(), cur["start_date"])
            end = max(s.end_date.isoformat(), cur["end_date"])
            nominal = tuple(d.isoformat() for d in nominal_span(s.label))
            if (cur["start_date"], cur["end_date"]) == nominal:
                start, end = (
                    s.start_date.isoformat(),
                    s.end_date.isoformat(),
                )  # real dates replace the placeholder
            if not s.dates_estimated and (start, end) != (cur["start_date"], cur["end_date"]):
                db.update("seasons", {"start_date": start, "end_date": end}, id=f"eq.{cur['id']}")
            continue
        new_seasons.append(
            {
                "label": s.label,
                "start_date": s.start_date.isoformat(),
                "end_date": s.end_date.isoformat(),
                "format_note": s.format_note,
                "is_current": s.label == CURRENT_SEASON and not has_current,
            }
        )
    if new_seasons:
        db.insert("seasons", new_seasons, on_conflict="label")
        result.seasons_added = [s["label"] for s in new_seasons]
    season_ids = {s["label"]: s["id"] for s in db.select("seasons", "id,label")}

    # --- Season teams ------------------------------------------------------
    current_st = {
        (r["season_id"], r["team_id"]): r
        for r in db.select("season_teams", "id,season_id,team_id,status,group_name")
    }
    st_new = []
    for row in plan.season_teams:
        sid = season_ids[row.season]
        cur = current_st.get((sid, row.team_id))
        if cur is None:
            st_new.append(
                {"season_id": sid, "team_id": row.team_id, "status": row.status, "group_name": row.group_name}
            )
        elif (cur["status"], cur["group_name"]) != (row.status, row.group_name):
            db.update(
                "season_teams", {"status": row.status, "group_name": row.group_name}, id=f"eq.{cur['id']}"
            )
    if st_new:
        db.insert("season_teams", st_new, on_conflict="season_id,team_id")

    # --- Matchdays -----------------------------------------------------------
    matchday_ids: dict[tuple[str, int], str] = {}
    for label, numbers in plan.matchdays.items():
        if numbers:
            sid = season_ids[label]
            db.insert(
                "matchdays",
                [{"season_id": sid, "number": n} for n in numbers],
                on_conflict="season_id,number",
            )
    for md in db.select("matchdays", "id,season_id,number"):
        matchday_ids[(md["season_id"], md["number"])] = md["id"]

    # --- Matches -------------------------------------------------------------
    cols = (
        "id,season_id,home_team_id,away_team_id,kickoff_at,kickoff_time_confirmed,"
        "status,home_goals,away_goals,matchday_id,notes"
    )
    in_db = {(m["season_id"], m["home_team_id"], m["away_team_id"]): m for m in db.select("matches", cols)}

    def wanted(row: MatchRow) -> dict[str, Any]:
        sid = season_ids[row.season]
        return {
            "season_id": sid,
            "home_team_id": row.home_team_id,
            "away_team_id": row.away_team_id,
            "kickoff_at": row.kickoff_at.isoformat(),
            "kickoff_estimated": row.kickoff_estimated,
            "kickoff_time_confirmed": row.time_confirmed,
            "notes": row.notes,
            "source_order": row.source_order,
            "status": row.status,
            "home_goals": row.home_goals,
            "away_goals": row.away_goals,
            "matchday_id": matchday_ids.get((sid, row.matchday)) if row.matchday else None,
        }

    to_insert = []
    for row in plan.matches:
        w = wanted(row)
        cur = in_db.get((w["season_id"], row.home_team_id, row.away_team_id))
        if cur is None:
            to_insert.append(w)
            continue
        same = (
            _ts(cur["kickoff_at"]) == row.kickoff_at
            and cur["kickoff_time_confirmed"] == w["kickoff_time_confirmed"]
            and cur["notes"] == w["notes"]
            and cur["status"] == w["status"]
            and cur["home_goals"] == w["home_goals"]
            and cur["away_goals"] == w["away_goals"]
            and (row.matchday is None or cur["matchday_id"] == w["matchday_id"])
        )
        if same:
            continue
        if row.season == CURRENT_SEASON and cur["status"] == "scheduled":
            fields = (
                "kickoff_at", "kickoff_time_confirmed", "status",
                "home_goals", "away_goals", "matchday_id", "notes",
            )  # fmt: skip
            db.update("matches", {k: w[k] for k in fields}, id=f"eq.{cur['id']}")
            result.matches_updated += 1
        else:
            result.kept_db_version.append(
                f"{row.source}: differs from the database (status {cur['status']}, "
                f"score {cur['home_goals']}-{cur['away_goals']}); database kept"
            )
    if to_insert:
        db.insert("matches", to_insert)
        result.matches_added = len(to_insert)

    result.ballboy = ensure_ballboy(db)
    if admin_email:
        result.admin = promote_admin(db, admin_email)
    return result


def ensure_ballboy(db: Supabase) -> str:
    """The Ballboy: an auth user nobody can log in as, with a 'system' profile."""
    system = db.select("profiles", "id,display_name", role="eq.system")
    if system:
        return f"already set up ({system[0]['display_name']})"
    user = db.find_user_by_email(BALLBOY_EMAIL)
    created = user is None
    if user is None:
        # A long random password that is never stored or shown: nobody can sign in.
        user = db.create_user(BALLBOY_EMAIL, secrets.token_urlsafe(48), {"display_name": BALLBOY_NAME})
    updated = db.update("profiles", {"role": "system", "display_name": BALLBOY_NAME}, id=f"eq.{user['id']}")
    if not updated:
        raise RuntimeError("The Ballboy's auth user exists but has no profile row")
    return "created" if created else "profile set to system"


def promote_admin(db: Supabase, email: str) -> str:
    user = db.find_user_by_email(email)
    if user is None:
        return f"no account for {email} yet: sign up on the site first, then run the seed again"
    rows = db.update("profiles", {"role": "admin"}, id=f"eq.{user['id']}", role="neq.system")
    return f"{email} is an admin" if rows else f"{email} has no profile row"
