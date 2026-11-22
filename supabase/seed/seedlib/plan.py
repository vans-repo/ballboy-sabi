"""Turn the source files into the rows the database should hold.

Pure: takes the parsed files and an alias -> team id map, returns plain data
plus everything the summary report needs. No network, no database.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .sources import SourceMatch, normalise_name

LAGOS = ZoneInfo("Africa/Lagos")

UNDATED_SEASONS = ("2021/22", "2022/23")  # historical file only
OVERLAP_SEASONS = ("2023/24", "2024/25")  # in both files: the dated file wins
DATED_ONLY_SEASONS = ("2025/26",)
CURRENT_SEASON = "2026/27"
ALL_SEASONS = (*UNDATED_SEASONS, *OVERLAP_SEASONS, *DATED_ONLY_SEASONS, CURRENT_SEASON)
GROUP_SEASON = "2022/23"

# The historical files have dates but no kick-off times. Matches are stored at
# this placeholder time (Lagos) so a date never shifts when shown in WAT, with
# kickoff_time_confirmed = false.
PLACEHOLDER_KICKOFF = time(16, 0)
# An upcoming match with no announced time: picks lock at noon on match day
# (earlier than any likely kick-off) until the real time is entered.
UNANNOUNCED_KICKOFF = time(12, 0)


@dataclass(frozen=True)
class SeasonRow:
    label: str
    start_date: date
    end_date: date
    format_note: str | None
    dates_estimated: bool  # start/end are a nominal August-July span


@dataclass(frozen=True)
class MatchRow:
    season: str
    home_team_id: str
    away_team_id: str
    kickoff_at: datetime  # UTC
    kickoff_estimated: bool
    source_order: int | None
    status: str  # played / scheduled, or the file's status
    home_goals: int | None
    away_goals: int | None
    matchday: int | None
    source: str  # "file line N", for reports
    time_confirmed: bool = False
    notes: str | None = None

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.season, self.home_team_id, self.away_team_id)


@dataclass(frozen=True)
class SeasonTeamRow:
    season: str
    team_id: str
    status: str  # stayed / promoted / relegated
    group_name: str | None


@dataclass
class Plan:
    seasons: list[SeasonRow] = field(default_factory=list)
    matches: list[MatchRow] = field(default_factory=list)
    season_teams: list[SeasonTeamRow] = field(default_factory=list)
    matchdays: dict[str, list[int]] = field(default_factory=dict)
    # Report items
    unresolved: dict[str, list[str]] = field(default_factory=dict)  # raw name -> where
    score_mismatches: list[str] = field(default_factory=list)
    undated_only: list[str] = field(default_factory=list)
    duplicates: list[str] = field(default_factory=list)
    unmatched_seasons: list[str] = field(default_factory=list)
    group_names: dict[str, str] = field(default_factory=dict)  # team id -> group


def nominal_span(label: str) -> tuple[date, date]:
    """1 August to 31 July, for seasons whose real dates are not in the data."""
    start = int(label[:4])
    return date(start, 8, 1), date(start + 1, 7, 31)


def midpoint(start: date, end: date) -> date:
    return start + timedelta(days=(end - start).days // 2)


def to_utc(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=LAGOS).astimezone(UTC)


def build_plan(
    historical: list[SourceMatch],
    chronological: list[SourceMatch],
    fixtures: list[SourceMatch],
    alias_to_team: dict[str, str],
) -> Plan:
    plan = Plan()

    def resolve(raw: str, m: SourceMatch) -> str | None:
        team_id = alias_to_team.get(normalise_name(raw))
        if team_id is None:
            plan.unresolved.setdefault(raw, []).append(f"{m.source} line {m.line}")
        return team_id

    def resolved(rows: list[SourceMatch]) -> list[tuple[SourceMatch, str, str]]:
        out = []
        for m in rows:
            h, a = resolve(m.home, m), resolve(m.away, m)
            if h and a:
                out.append((m, h, a))
        return out

    hist_by_season: dict[str, list[tuple[SourceMatch, str, str]]] = defaultdict(list)
    for item in resolved(historical):
        hist_by_season[item[0].season].append(item)
    chrono_by_season: dict[str, list[tuple[SourceMatch, str, str]]] = defaultdict(list)
    for item in resolved(chronological):
        chrono_by_season[item[0].season].append(item)
    fixture_rows = resolved(fixtures)

    known = set(ALL_SEASONS)
    for label in sorted(set(hist_by_season) | set(chrono_by_season)):
        if label not in known:
            plan.unmatched_seasons.append(label)

    # --- Seasons ------------------------------------------------------------
    season_rows: dict[str, SeasonRow] = {}
    for label in ALL_SEASONS:
        dates = [m.match_date for m, _, _ in chrono_by_season.get(label, []) if m.match_date]
        dates += [m.match_date for m, _, _ in (fixture_rows if label == CURRENT_SEASON else [])]
        if dates:
            start, end = min(dates), max(dates)
            estimated = False
            if end <= start:
                end = start + timedelta(days=1)
        else:
            start, end = nominal_span(label)
            estimated = True
        note = None
        if label == GROUP_SEASON:
            note = (
                "Played in two groups of 10 teams. The data holds the group stage only: "
                "each team played the other nine in its group home and away."
            )
        season_rows[label] = SeasonRow(label, start, end, note, estimated)
    plan.seasons = list(season_rows.values())

    # --- Matches ------------------------------------------------------------
    def add(
        m: SourceMatch,
        h: str,
        a: str,
        *,
        estimated: bool,
        kickoff: datetime,
        order: int | None,
        time_confirmed: bool = False,
    ) -> None:
        played = m.home_goals is not None
        plan.matches.append(
            MatchRow(
                season=m.season,
                home_team_id=h,
                away_team_id=a,
                kickoff_at=kickoff,
                kickoff_estimated=estimated,
                source_order=order,
                status=m.status or ("played" if played else "scheduled"),
                home_goals=m.home_goals,
                away_goals=m.away_goals,
                matchday=m.matchday,
                source=f"{m.source} line {m.line}",
                time_confirmed=time_confirmed,
                notes=m.notes,
            )
        )

    def season_midpoint_kickoff(label: str) -> datetime:
        s = season_rows[label]
        return to_utc(midpoint(s.start_date, s.end_date), PLACEHOLDER_KICKOFF)

    for label in UNDATED_SEASONS:
        for m, h, a in hist_by_season.get(label, []):
            add(m, h, a, estimated=True, kickoff=season_midpoint_kickoff(label), order=m.order)

    for label in (*OVERLAP_SEASONS, *DATED_ONLY_SEASONS):
        dated = chrono_by_season.get(label, [])
        dated_keys = {}
        for m, h, a in dated:
            dated_keys[(h, a)] = m
            assert m.match_date is not None
            add(m, h, a, estimated=False, kickoff=to_utc(m.match_date, PLACEHOLDER_KICKOFF), order=None)
        for m, h, a in hist_by_season.get(label, []):
            other = dated_keys.get((h, a))
            if other is None:
                # Only in the undated file: keep it, with an estimated date.
                plan.undated_only.append(
                    f"{label}  {m.home} {m.home_goals}-{m.away_goals} {m.away}  ({m.source} line {m.line})"
                )
                add(m, h, a, estimated=True, kickoff=season_midpoint_kickoff(label), order=m.order)
            elif (other.home_goals, other.away_goals) != (m.home_goals, m.away_goals):
                plan.score_mismatches.append(
                    f"{label}  {m.home} v {m.away}: "
                    f"{other.home_goals}-{other.away_goals} in {other.source} "
                    f"(used, {other.match_date:%d %b %Y}) / "
                    f"{m.home_goals}-{m.away_goals} in {m.source} line {m.line}"
                )

    for m, h, a in fixture_rows:
        assert m.match_date is not None
        if m.kickoff_time is not None:
            t, confirmed = m.kickoff_time, True
        elif m.home_goals is None and m.status in (None, "postponed"):
            t, confirmed = UNANNOUNCED_KICKOFF, False
        else:
            t, confirmed = PLACEHOLDER_KICKOFF, False  # already played: only the date matters
        add(m, h, a, estimated=False, kickoff=to_utc(m.match_date, t), order=None, time_confirmed=confirmed)
    plan.matchdays[CURRENT_SEASON] = sorted({m.matchday for m, _, _ in fixture_rows if m.matchday})

    # Each pairing appears once per season; anything else is a file error.
    seen: dict[tuple[str, str, str], str] = {}
    unique = []
    for row in plan.matches:
        if row.key in seen:
            plan.duplicates.append(f"{row.source} repeats {seen[row.key]}")
            continue
        seen[row.key] = row.source
        unique.append(row)
    plan.matches = unique

    # --- 2022/23 groups: teams that played each other ----------------------
    adjacency: dict[str, set[str]] = defaultdict(set)
    group_order: list[str] = []
    for row in plan.matches:
        if row.season == GROUP_SEASON:
            adjacency[row.home_team_id].add(row.away_team_id)
            adjacency[row.away_team_id].add(row.home_team_id)
            group_order += [row.home_team_id, row.away_team_id]
    letters = iter("ABCDEFGH")
    for start in dict.fromkeys(group_order):
        if start in plan.group_names:
            continue
        letter = f"Group {next(letters)}"
        stack = [start]
        while stack:
            t = stack.pop()
            if t not in plan.group_names:
                plan.group_names[t] = letter
                stack.extend(adjacency[t])

    # --- Season teams --------------------------------------------------------
    teams_in: dict[str, set[str]] = defaultdict(set)
    for row in plan.matches:
        teams_in[row.season] |= {row.home_team_id, row.away_team_id}
    for i, label in enumerate(ALL_SEASONS):
        prev = teams_in.get(ALL_SEASONS[i - 1]) if i > 0 else None
        nxt = teams_in.get(ALL_SEASONS[i + 1]) if i + 1 < len(ALL_SEASONS) else None
        if nxt and len(nxt) < len(teams_in.get(label, ())):
            nxt = None  # a partial fixtures file: too early to tell who went down
        for team in sorted(teams_in.get(label, ())):
            if nxt and team not in nxt:
                status = "relegated"
            elif prev and team not in prev:
                status = "promoted"
            else:
                status = "stayed"
            group = plan.group_names.get(team) if label == GROUP_SEASON else None
            plan.season_teams.append(SeasonTeamRow(label, team, status, group))

    return plan
