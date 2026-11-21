from datetime import date, time
from pathlib import Path

from seedlib.plan import build_plan, to_utc
from seedlib.sources import SourceMatch, normalise_name, read_fixtures, season_label_for_date


def test_every_name_in_the_files_resolves(historical, chronological, alias_map):
    aliases, _ = alias_map
    names = {m.home for m in historical + chronological} | {m.away for m in historical + chronological}
    assert {n for n in names if normalise_name(n) not in aliases} == set()


def test_season_from_date():
    assert season_label_for_date(date(2023, 10, 2)) == "2023/24"
    assert season_label_for_date(date(2024, 6, 23)) == "2023/24"
    assert season_label_for_date(date(2025, 8, 22)) == "2025/26"


def test_plan_on_reference_files(historical, chronological, alias_map):
    aliases, _ = alias_map
    plan = build_plan(historical, chronological, [], aliases)
    assert plan.unresolved == {}
    assert plan.duplicates == []
    per_season = {}
    for m in plan.matches:
        per_season[m.season] = per_season.get(m.season, 0) + 1
    # 2023/24 and 2024/25: dated file (372, 379) plus matches only in the undated file (8, 1)
    assert per_season == {"2021/22": 380, "2022/23": 180, "2023/24": 380, "2024/25": 380, "2025/26": 376}
    assert len(plan.undated_only) == 9
    assert len(plan.score_mismatches) == 2
    assert any("Lobi Stars v Plateau United" in s for s in plan.score_mismatches)
    assert any("Sunshine Stars v Kwara United" in s for s in plan.score_mismatches)


def test_estimated_dates_and_file_order(historical, chronological, alias_map):
    aliases, _ = alias_map
    plan = build_plan(historical, chronological, [], aliases)
    early = [m for m in plan.matches if m.season in ("2021/22", "2022/23")]
    assert all(m.kickoff_estimated and m.source_order for m in early)
    assert [m.source_order for m in early if m.season == "2021/22"] == list(range(1, 381))
    # Same estimated kick-off for a whole season: its midpoint.
    assert len({m.kickoff_at for m in early if m.season == "2021/22"}) == 1
    dated = [m for m in plan.matches if m.season == "2025/26"]
    assert not any(m.kickoff_estimated for m in dated)
    assert all(m.source_order is None for m in dated)


def test_2022_23_has_two_groups_of_ten(historical, chronological, alias_map):
    aliases, _ = alias_map
    plan = build_plan(historical, chronological, [], aliases)
    rows = [r for r in plan.season_teams if r.season == "2022/23"]
    groups = {}
    for r in rows:
        groups.setdefault(r.group_name, set()).add(r.team_id)
    assert sorted(len(g) for g in groups.values()) == [10, 10]
    assert all(r.group_name is None for r in plan.season_teams if r.season != "2022/23")


def test_promoted_and_relegated(historical, chronological, alias_map):
    aliases, ids = alias_map
    plan = build_plan(historical, chronological, [], aliases)
    status = {(r.season, r.team_id): r.status for r in plan.season_teams}
    assert status[("2021/22", ids["MFM"])] == "relegated"  # not in 2022/23
    assert status[("2022/23", ids["Doma United"])] == "promoted"
    assert status[("2023/24", ids["Doma United"])] == "relegated"
    assert status[("2025/26", ids["Barau"])] == "promoted"
    assert status[("2021/22", ids["Enyimba"])] == "stayed"  # first season: nothing to compare
    # 2025/26 has no next season loaded yet, so nobody is marked relegated.
    assert not any(r.status == "relegated" for r in plan.season_teams if r.season == "2025/26")


def test_kickoff_is_stored_in_utc():
    assert to_utc(date(2026, 9, 5), time(16, 0)).isoformat() == "2026-09-05T15:00:00+00:00"


def test_fixtures_file(tmp_path: Path, alias_map):
    aliases, ids = alias_map
    f = tmp_path / "fixtures.csv"
    f.write_text(
        "date,time,home,away,matchday,home_goals,away_goals\n"
        "2026-09-05,16:00,Enyimba FC,Kano Pillars,1,2,1\n"
        "06/09/2026,18:30,3SC,Rivers United,1,,\n"
    )
    parsed = read_fixtures(f, "2026/27")
    assert parsed.errors == []
    plan = build_plan([], [], parsed.matches, aliases)
    played, upcoming = plan.matches
    assert (played.status, played.home_goals, played.away_goals, played.matchday) == ("played", 2, 1, 1)
    assert played.home_team_id == ids["Enyimba"]
    assert upcoming.status == "scheduled" and upcoming.home_team_id == ids["Shooting Stars"]
    assert upcoming.kickoff_at.isoformat() == "2026-09-06T17:30:00+00:00"
    assert plan.matchdays["2026/27"] == [1]
    season = next(s for s in plan.seasons if s.label == "2026/27")
    assert (season.start_date, season.end_date) == (date(2026, 9, 5), date(2026, 9, 6))


def test_fixtures_file_errors(tmp_path: Path):
    f = tmp_path / "fixtures.csv"
    f.write_text(
        "date,time,home,away,matchday,home_goals,away_goals\n"
        "2026-13-05,16:00,Enyimba,Kano Pillars,1,,\n"
        "2026-09-05,4pm,Enyimba,Kano Pillars,1,,\n"
        "2026-09-05,16:00,Enyimba,Kano Pillars,one,,\n"
        "2026-09-05,16:00,Enyimba,Kano Pillars,1,2,\n"
    )
    parsed = read_fixtures(f, "2026/27")
    assert len(parsed.errors) == 4
    assert [e.split(":")[0] for e in parsed.errors] == [f"fixtures.csv line {n}" for n in (2, 3, 4, 5)]


def test_missing_fixtures_file(tmp_path: Path):
    assert read_fixtures(tmp_path / "nope.csv", "2026/27").found is False


def test_unresolved_names_are_reported(alias_map):
    aliases, _ = alias_map
    m = SourceMatch("x.csv", 2, "2025/26", "Enyimba", "Mystery FC", 1, 0, match_date=date(2025, 9, 1))
    plan = build_plan([], [m], [], aliases)
    assert plan.matches == []
    assert plan.unresolved == {"Mystery FC": ["x.csv line 2"]}


def test_partial_next_season_does_not_mark_relegations(historical, chronological, alias_map, tmp_path):
    aliases, _ = alias_map
    f = tmp_path / "fixtures.csv"
    f.write_text("date,time,home,away,matchday\n2026-09-05,16:00,Enyimba,Kano Pillars,1\n")
    plan = build_plan(historical, chronological, read_fixtures(f, "2026/27").matches, aliases)
    assert not any(r.status == "relegated" for r in plan.season_teams if r.season == "2025/26")
