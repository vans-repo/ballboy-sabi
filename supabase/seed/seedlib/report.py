"""The summary printed at the end of a seed run, read back from the database."""

from __future__ import annotations

from collections import Counter, defaultdict

from .load import Result
from .plan import ALL_SEASONS, CURRENT_SEASON
from .rest import Supabase
from .sources import FixturesFile

PLACEHOLDER_PRIMARY = "#64748B"
PLACEHOLDER_SECONDARY = "#FFFFFF"


def _section(title: str, lines: list[str], empty: str) -> list[str]:
    out = [f"\n{title}"]
    out += [f"  {line}" for line in lines] if lines else [f"  {empty}"]
    return out


def build_report(db: Supabase, result: Result, fixtures: FixturesFile, fixtures_path: str) -> str:
    plan = result.plan
    seasons = {s["id"]: s for s in db.select("seasons", "id,label,start_date,end_date,is_current")}
    matches = db.select("matches", "season_id,status,kickoff_estimated,kickoff_time_confirmed")
    season_teams = db.select("season_teams", "season_id,team_id,status,group_name")
    teams = db.select("teams", "id,name,code,city,lat,lon,primary_colour,secondary_colour")
    team_names = {t["id"]: t["name"] for t in teams}

    by_season: dict[str, Counter[str]] = defaultdict(Counter)
    estimated: Counter[str] = Counter()
    time_tbc: Counter[str] = Counter()
    for m in matches:
        label = seasons[m["season_id"]]["label"]
        by_season[label][m["status"]] += 1
        estimated[label] += m["kickoff_estimated"]
        time_tbc[label] += m["status"] == "scheduled" and not m["kickoff_time_confirmed"]
    st_by_season: dict[str, list[dict]] = defaultdict(list)
    for st in season_teams:
        st_by_season[seasons[st["season_id"]]["label"]].append(st)

    out = ["=" * 78, "SEED SUMMARY", "=" * 78]
    out.append(
        f"\nThis run added {len(result.teams_added)} teams, {result.aliases_added} aliases, "
        f"{len(result.seasons_added)} seasons and {result.matches_added} matches, "
        f"and updated {result.matches_updated} fixtures."
    )

    out.append("\nMatches and teams per season")
    out.append(f"  {'Season':<9}{'Dates':<27}{'Matches':>8}{'Played':>8}{'To play':>8}{'Teams':>7}  Notes")
    labels = sorted({s["label"] for s in seasons.values()} | set(ALL_SEASONS))
    for label in labels:
        s = next((x for x in seasons.values() if x["label"] == label), None)
        c = by_season.get(label, Counter())
        total = sum(c.values())
        notes = []
        if s and s["is_current"]:
            notes.append("current")
        if estimated[label]:
            notes.append(f"{estimated[label]} with estimated dates")
        if time_tbc[label]:
            notes.append(f"{time_tbc[label]} upcoming with time TBC")
        other = {k: v for k, v in c.items() if k not in ("played", "scheduled")}
        if other:
            notes.append(", ".join(f"{v} {k}" for k, v in sorted(other.items())))
        sts = st_by_season.get(label, [])
        groups = Counter(st["group_name"] for st in sts if st["group_name"])
        if groups:
            notes.append(", ".join(f"{g}: {n} teams" for g, n in sorted(groups.items())))
        promoted = sum(st["status"] == "promoted" for st in sts)
        relegated = sum(st["status"] == "relegated" for st in sts)
        if promoted or relegated:
            notes.append(f"{promoted} new, {relegated} not in next season")
        dates = f"{s['start_date']} to {s['end_date']}" if s else "(not created)"
        out.append(
            f"  {label:<9}{dates:<27}{total:>8}{c['played']:>8}{c['scheduled']:>8}{len(sts):>7}  "
            + "; ".join(notes)
        )

    # Names
    unresolved = [f"{name!r} ({', '.join(where[:3])}{' ...' if len(where) > 3 else ''})"
                  for name, where in sorted(plan.unresolved.items())]  # fmt: skip
    out += _section("Team names that did not resolve", unresolved, "None. Every name resolved.")
    out += _section("Alias problems", result.alias_conflicts, "None.")

    # Overlap
    out += _section(
        "Scores that disagree between the two files (2023/24 and 2024/25; the dated file is used)",
        plan.score_mismatches,
        "None.",
    )
    out += _section(
        "Matches only in the undated file (kept, with an estimated date)",
        plan.undated_only,
        "None.",
    )
    out += _section("Repeated matches in a file (skipped)", plan.duplicates, "None.")
    out += _section("Seasons in the files that the seed does not load", plan.unmatched_seasons, "None.")
    out += _section("Database rows kept although a file differs", result.kept_db_version, "None.")

    # 2026/27 file
    if not fixtures.found:
        status = [
            f"{fixtures_path} is missing, so {CURRENT_SEASON} has no fixtures yet.",
            "Add it (see data/fixtures_2026_27.template.csv) and run the seed again.",
        ]
    elif fixtures.errors:
        status = ["Not loaded. Fix these rows and run the seed again:", *fixtures.errors]
    else:
        status = [f"Loaded {len(fixtures.matches)} rows from {fixtures_path}."]
    out += _section(f"{CURRENT_SEASON} fixtures file", status, "")

    # Placeholders for the owner
    placeholder = (PLACEHOLDER_PRIMARY, PLACEHOLDER_SECONDARY)
    colours = [t["name"] for t in teams if (t["primary_colour"], t["secondary_colour"]) == placeholder]
    no_city = [t["name"] for t in teams if not t["city"]]
    no_coords = [t["name"] for t in teams if t["lat"] is None or t["lon"] is None]
    out.append("\nPlaceholders for you to fill in (Teams & Seasons screen, Stage 6)")
    out.append(f"  Colours ({len(colours)}): {', '.join(sorted(colours)) or 'none'}")
    out.append(f"  City ({len(no_city)}): {', '.join(sorted(no_city)) or 'none'}")
    out.append(f"  Coordinates ({len(no_coords)}): {', '.join(sorted(no_coords)) or 'none'}")
    if plan.group_names:
        groups: dict[str, list[str]] = defaultdict(list)
        for tid, g in plan.group_names.items():
            groups[g].append(team_names.get(tid, tid))
        out.append("  2022/23 group letters were assigned by the seed (the file has no names):")
        for g in sorted(groups):
            out.append(f"    {g}: {', '.join(sorted(groups[g]))}")

    out.append("\nThe Ballboy: " + result.ballboy)
    if result.admin:
        out.append("Admin: " + result.admin)
    out.append("Predictions and team ratings: filled by the first model run (Stage 3).")
    return "\n".join(out)
