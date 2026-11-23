"""Read the source files: the team catalogue and the three match files.

Nothing here touches the database. Team names are kept exactly as written in
the files; they are resolved to teams later, through the team_aliases table.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path

import yaml

CODE_RE = re.compile(r"^[A-Z0-9]{3}$")
COLOUR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalise_name(raw: str) -> str:
    """The form every alias is stored in: lowercase, single spaces, no padding."""
    return " ".join(raw.lower().split())


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def season_label_from_file(value: str) -> str:
    """'2021-22' (as written in the CSVs) -> '2021/22' (as stored)."""
    m = re.fullmatch(r"(\d{4})[-/](\d{2})", value.strip())
    if not m:
        raise ValueError(f"not a season: {value!r}")
    return f"{m.group(1)}/{m.group(2)}"


def season_label_for_date(d: date) -> str:
    """Seasons run from July to June: a match in October 2023 is in 2023/24."""
    start = d.year if d.month >= 7 else d.year - 1
    return f"{start}/{(start + 1) % 100:02d}"


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class TeamSpec:
    name: str
    code: str
    lat: float | None = None
    lon: float | None = None
    city: str | None = None
    primary_colour: str | None = None
    secondary_colour: str | None = None
    extra_aliases: tuple[str, ...] = ()

    @property
    def slug(self) -> str:
        return slugify(self.name)

    @property
    def aliases(self) -> list[str]:
        """Every alias for this team, normalised, without duplicates."""
        base = normalise_name(self.name)
        names = [base, f"{base} fc", *(normalise_name(a) for a in self.extra_aliases)]
        return list(dict.fromkeys(names))


def load_team_catalogue(path: Path) -> list[TeamSpec]:
    data = yaml.safe_load(path.read_text())
    teams: list[TeamSpec] = []
    for entry in data["teams"]:
        spec = TeamSpec(
            name=entry["name"].strip(),
            code=entry["code"],
            lat=entry.get("lat"),
            lon=entry.get("lon"),
            city=entry.get("city"),
            primary_colour=entry.get("primary_colour"),
            secondary_colour=entry.get("secondary_colour"),
            extra_aliases=tuple(entry.get("aliases") or ()),
        )
        if not CODE_RE.match(spec.code):
            raise ValueError(f"{spec.name}: code must be 3 capital letters or digits, got {spec.code!r}")
        for colour in (spec.primary_colour, spec.secondary_colour):
            if colour is not None and not COLOUR_RE.match(colour):
                raise ValueError(f"{spec.name}: colour must look like #1A2B3C, got {colour!r}")
        teams.append(spec)

    for attr in ("name", "code", "slug"):
        values = [getattr(t, attr) for t in teams]
        dupes = {v for v in values if values.count(v) > 1}
        if dupes:
            raise ValueError(f"duplicate team {attr}: {sorted(dupes)}")
    owners: dict[str, str] = {}
    for t in teams:
        for alias in t.aliases:
            if alias in owners and owners[alias] != t.name:
                raise ValueError(f"alias {alias!r} used by both {owners[alias]} and {t.name}")
            owners[alias] = t.name
    return teams


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SourceMatch:
    """One match as written in a source file."""

    source: str  # file name, for reports
    line: int  # line number in that file (header is line 1)
    season: str  # '2023/24'
    home: str  # raw team names
    away: str
    home_goals: int | None
    away_goals: int | None
    match_date: date | None = None  # None when the file has no dates
    kickoff_time: time | None = None  # WAT; None when not announced (or not in the file)
    matchday: int | None = None
    status: str | None = None  # only the 2026/27 file: abandoned, postponed, ...
    notes: str | None = None
    order: int = 0  # position among this file's matches in the same season (1-based)


@dataclass
class FixturesFile:
    matches: list[SourceMatch] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    found: bool = True


def _goals(value: str, where: str) -> int:
    value = value.strip()
    if not value.isdigit():
        raise ValueError(f"{where}: goals must be a whole number, got {value!r}")
    return int(value)


def _number_within_season(rows: list[SourceMatch]) -> list[SourceMatch]:
    counts: dict[str, int] = {}
    out = []
    for r in rows:
        counts[r.season] = counts.get(r.season, 0) + 1
        out.append(SourceMatch(**{**r.__dict__, "order": counts[r.season]}))
    return out


def read_historical(path: Path) -> list[SourceMatch]:
    """npfl_historical_data.csv: Season,Home_Team,Away_Team,Home_Goals,Away_Goals,Outcome.

    No dates. File order within a season is kept in `order`.
    """
    rows = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        for line, rec in enumerate(csv.DictReader(f), start=2):
            where = f"{path.name} line {line}"
            rows.append(
                SourceMatch(
                    source=path.name,
                    line=line,
                    season=season_label_from_file(rec["Season"]),
                    home=rec["Home_Team"].strip(),
                    away=rec["Away_Team"].strip(),
                    home_goals=_goals(rec["Home_Goals"], where),
                    away_goals=_goals(rec["Away_Goals"], where),
                )
            )
    return _number_within_season(rows)


def read_chronological(path: Path) -> list[SourceMatch]:
    """npfl_chronological_data.csv: Date (DD/MM/YYYY),Home_Team,Away_Team,Home_Goals,..."""
    rows = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        for line, rec in enumerate(csv.DictReader(f), start=2):
            where = f"{path.name} line {line}"
            d = datetime.strptime(rec["Date"].strip(), "%d/%m/%Y").date()
            rows.append(
                SourceMatch(
                    source=path.name,
                    line=line,
                    season=season_label_for_date(d),
                    home=rec["Home_Team"].strip(),
                    away=rec["Away_Team"].strip(),
                    home_goals=_goals(rec["Home_Goals"], where),
                    away_goals=_goals(rec["Away_Goals"], where),
                    match_date=d,
                )
            )
    return _number_within_season(rows)


FIXTURE_COLUMNS = ["date", "time", "home", "away", "matchday", "home_goals", "away_goals", "status", "notes"]
REQUIRED_FIXTURE_COLUMNS = ["date", "time", "home", "away", "matchday"]
# A status other than these comes from the score: played if it has one, else scheduled.
FIXTURE_STATUSES = {"postponed", "abandoned", "cancelled", "awarded"}


def _parse_date(value: str) -> date:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"date must be YYYY-MM-DD or DD/MM/YYYY, got {value!r}")


def read_fixtures(path: Path, season: str) -> FixturesFile:
    """The 2026/27 fixtures file (see data/fixtures_2026_27.template.csv).

    Columns: date, time (24-hour, Lagos time; blank if not announced), home,
    away, matchday, home_goals / away_goals for matches already played, and
    optional status (postponed, abandoned, cancelled, awarded) and notes.
    Every row is checked; any error means none of the file is loaded.
    """
    result = FixturesFile()
    if not path.exists():
        result.found = False
        return result
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = [h.strip().lower() for h in (reader.fieldnames or [])]
        missing = [c for c in REQUIRED_FIXTURE_COLUMNS if c not in header]
        if missing:
            result.errors.append(f"{path.name}: missing columns {', '.join(missing)}")
            return result
        for line, raw in enumerate(reader, start=2):
            rec = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            if not any(rec.values()):
                continue  # blank line
            where = f"{path.name} line {line}"
            try:
                d = _parse_date(rec["date"])
                t = None
                if rec["time"]:
                    try:
                        t = datetime.strptime(rec["time"], "%H:%M").time()
                    except ValueError:
                        raise ValueError(
                            f"time must be 24-hour HH:MM (Lagos time) or blank, got {rec['time']!r}"
                        ) from None
                if not rec["home"] or not rec["away"]:
                    raise ValueError("home and away are required")
                if not rec["matchday"].isdigit() or int(rec["matchday"]) < 1:
                    raise ValueError(f"matchday must be a whole number from 1, got {rec['matchday']!r}")
                hg, ag = rec.get("home_goals", ""), rec.get("away_goals", "")
                if bool(hg) != bool(ag):
                    raise ValueError("give both home_goals and away_goals, or neither")
                status = rec.get("status", "").lower() or None
                if status is not None and status not in FIXTURE_STATUSES:
                    raise ValueError(f"status must be one of {', '.join(sorted(FIXTURE_STATUSES))} or blank")
                if status == "awarded" and not hg:
                    raise ValueError("an awarded match needs its awarded score")
                if status in ("postponed", "abandoned", "cancelled") and hg:
                    raise ValueError(f"a {status} match has no result: leave the goals blank (use notes)")
                result.matches.append(
                    SourceMatch(
                        source=path.name,
                        line=line,
                        season=season,
                        home=rec["home"],
                        away=rec["away"],
                        home_goals=_goals(hg, where) if hg else None,
                        away_goals=_goals(ag, where) if ag else None,
                        match_date=d,
                        kickoff_time=t,
                        matchday=int(rec["matchday"]),
                        status=status,
                        notes=rec.get("notes") or None,
                    )
                )
            except ValueError as e:
                result.errors.append(f"{where}: {e}")
    result.matches = _number_within_season(result.matches)
    return result
