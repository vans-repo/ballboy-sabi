"""Turn a fixture list copied from a results page into data/fixtures_2026_27.csv.

The paste looks like this, one value per line:

    Matchday 1
    28.08.2026          <- date for the matches that follow
    Shooting Stars      <- home team (each name appears twice)
    Shooting Stars
    2:1                 <- score if played, 16:00 if a time is set, -:- if neither
    abor.               <- optional: the match was abandoned
    Inter Lagos         <- away team (twice)
    Inter Lagos

Usage: python supabase/seed/tools/paste_to_csv.py PASTE.txt [OUT.csv]
Checks the result is a full double round robin before writing.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

MATCHDAY = re.compile(r"^Matchday (\d+)$")
DATE = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")
SCORE = re.compile(r"^(\d+):(\d)$")
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
COLUMNS = ["date", "time", "home", "away", "matchday", "home_goals", "away_goals", "status", "notes"]


def parse(lines: list[str]) -> list[dict[str, str]]:
    lines = [ln.strip() for ln in lines if ln.strip()]
    rows: list[dict[str, str]] = []
    matchday = day = None
    i = 0

    def take(n: int = 1) -> str:
        nonlocal i
        if i >= len(lines):
            raise ValueError("paste ends in the middle of a match")
        value = lines[i]
        i += n
        return value

    while i < len(lines):
        line = lines[i]
        if m := MATCHDAY.match(line):
            matchday = int(m.group(1))
            i += 1
            continue
        if DATE.match(line):
            day = datetime.strptime(line, "%d.%m.%Y").date()
            i += 1
            continue
        if matchday is None or day is None:
            raise ValueError(f"line {i + 1}: a match before any matchday or date: {line!r}")
        start = i + 1
        home = take()
        if take() != home:
            raise ValueError(f"line {start}: expected {home!r} twice")
        middle = take()
        abandoned = False
        if lines[i] == "abor.":
            abandoned = True
            i += 1
        away = take()
        if take() != away:
            raise ValueError(f"line {start}: expected {away!r} twice")
        row = dict.fromkeys(COLUMNS, "")
        row.update(date=day.isoformat(), home=home, away=away, matchday=str(matchday))
        if s := SCORE.match(middle):
            if abandoned:
                row.update(status="abandoned", notes=f"Abandoned at {s.group(1)}-{s.group(2)}")
            else:
                row.update(home_goals=s.group(1), away_goals=s.group(2))
        elif TIME.match(middle):
            row["time"] = middle
        elif middle != "-:-":
            raise ValueError(f"line {start + 2}: not a score, time or -:-: {middle!r}")
        rows.append(row)
    return rows


def check(rows: list[dict[str, str]]) -> None:
    teams = {r["home"] for r in rows} | {r["away"] for r in rows}
    n = len(teams)
    pairs = Counter((r["home"], r["away"]) for r in rows)
    problems = [f"{h} v {a} appears {c} times" for (h, a), c in pairs.items() if c > 1]
    problems += [f"{h} v {a} is missing" for h in teams for a in teams if h != a and (h, a) not in pairs]
    by_md: dict[str, Counter[str]] = {}
    for r in rows:
        by_md.setdefault(r["matchday"], Counter()).update([r["home"], r["away"]])
    for md, c in by_md.items():
        if len(c) != n or set(c.values()) != {1}:
            problems.append(f"matchday {md} doesn't have each team exactly once")
    if problems:
        raise ValueError("not a full double round robin:\n  " + "\n  ".join(problems))


def main() -> int:
    src = Path(sys.argv[1])
    out = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[3] / "data/fixtures_2026_27.csv"
    )
    rows = parse(src.read_text(encoding="utf-8").splitlines())
    check(rows)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    played = sum(bool(r["home_goals"]) for r in rows)
    timed = sum(bool(r["time"]) for r in rows)
    abandoned = sum(r["status"] == "abandoned" for r in rows)
    to_play = len(rows) - played - abandoned
    print(
        f"{len(rows)} matches, {len({r['home'] for r in rows})} teams, "
        f"{len({r['matchday'] for r in rows})} matchdays: {played} played, {abandoned} abandoned, "
        f"{to_play} to play ({timed} with a kick-off time). Wrote {out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
