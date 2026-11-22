"""Two or three short, factual lines per prediction, from the data only.

Every line is computed from matches played before the prediction is made,
so nothing is invented. Examples:
    "Enugu Rangers rated 4th, Kwara United 15th"
    "Enugu Rangers unbeaten in 9 home games this season"
    "Kwara United have won 1 of their last 12 away games"
    "Kwara United are newly promoted"
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import pandas as pd

from model.elo import Elo

STREAK_MIN = 4  # shortest home/away run worth a line
AWAY_RECORD_GAMES = 12
AWAY_RECORD_MIN = 8


def ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _result(row: pd.Series | tuple, team: str) -> str:
    hg, ag = row.home_goals, row.away_goals
    mine, theirs = (hg, ag) if row.home_id == team else (ag, hg)
    return "W" if mine > theirs else "D" if mine == theirs else "L"


def _run(results: list[str], keep: Callable[[str], bool]) -> int:
    """Length of the most recent run of results satisfying keep (newest first)."""
    n = 0
    for r in results:
        if not keep(r):
            break
        n += 1
    return n


@dataclass
class ReasonContext:
    played: pd.DataFrame  # model inputs before the cutoff, oldest first
    elo: Elo
    names: dict[str, str]
    season_teams: dict[int, set[str]]  # season_index -> teams in that season


def reasons_for(fixture: pd.Series | tuple, ctx: ReasonContext) -> list[str]:
    home, away, season = fixture.home_id, fixture.away_id, fixture.season_index
    hn, an = ctx.names[home], ctx.names[away]
    teams = ctx.season_teams.get(season, {home, away})
    ranked = sorted(teams, key=lambda t: -ctx.elo.rating(t, season))
    lines = [f"{hn} rated {ordinal(ranked.index(home) + 1)}, {an} {ordinal(ranked.index(away) + 1)}"]

    p = ctx.played
    this_season = p[p.season_index == season]

    def recent(team: str, where: str, frame: pd.DataFrame) -> list[str]:
        col = "home_id" if where == "home" else "away_id"
        games = frame[frame[col] == team].iloc[::-1]
        return [_result(r, team) for r in games.itertuples(index=False)]

    extras: list[str] = []
    prev = ctx.season_teams.get(season - 1)
    for team, name in ((home, hn), (away, an)):
        if prev is not None and team not in prev:
            extras.append(f"{name} are newly promoted")

    home_games = recent(home, "home", this_season)
    if (n := _run(home_games, lambda r: r != "L")) >= STREAK_MIN:
        extras.append(f"{hn} unbeaten in {n} home games this season")
    elif (n := _run(home_games, lambda r: r != "W")) >= STREAK_MIN:
        extras.append(f"{hn} without a win in their last {n} home games")

    away_games = recent(away, "away", this_season)
    away_all = recent(away, "away", p)[:AWAY_RECORD_GAMES]
    wins = away_all.count("W")
    if (n := _run(away_games, lambda r: r != "L")) >= STREAK_MIN:
        extras.append(f"{an} unbeaten in {n} away games this season")
    elif len(away_all) >= AWAY_RECORD_MIN and (wins <= len(away_all) / 6 or wins >= len(away_all) / 2):
        extras.append(f"{an} have won {wins} of their last {len(away_all)} away games")

    meetings = p[((p.home_id == home) & (p.away_id == away)) | ((p.home_id == away) & (p.away_id == home))]
    if len(meetings):
        last = meetings.iloc[-1]
        extras.append(
            f"Last meeting: {ctx.names[last.home_id]} {int(last.home_goals)}-{int(last.away_goals)} "
            f"{ctx.names[last.away_id]} ({last.season})"
        )
    for team, name in ((home, hn), (away, an)):
        form = [
            _result(r, team) for r in p[(p.home_id == team) | (p.away_id == team)].iloc[::-1][:5].itertuples()
        ]
        if len(form) == 5:
            extras.append(f"{name} have won {form.count('W')} of their last 5 games")

    return lines + extras[:2]
