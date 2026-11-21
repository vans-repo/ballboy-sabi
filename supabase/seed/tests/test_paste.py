import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from paste_to_csv import check, parse  # noqa: E402

PASTE = """Matchday 1
28.08.2026
Shooting Stars
Shooting Stars
2:1
Inter Lagos
Inter Lagos
30.08.2026
Abia Warriors
Abia Warriors
2:1
abor.
Barau FC
Barau FC
Matchday 2
05.09.2026
Inter Lagos
Inter Lagos
16:00
Shooting Stars
Shooting Stars
Barau FC
Barau FC
-:-
Abia Warriors
Abia Warriors
""".splitlines()


def test_parse():
    played, abandoned, timed, tbc = parse(PASTE)
    assert (played["date"], played["home_goals"], played["away_goals"], played["matchday"]) == (
        "2026-08-28", "2", "1", "1",
    )  # fmt: skip
    assert (abandoned["status"], abandoned["home_goals"], abandoned["notes"]) == (
        "abandoned", "", "Abandoned at 2-1",
    )  # fmt: skip
    assert (timed["time"], timed["home_goals"], timed["matchday"]) == ("16:00", "", "2")
    assert (tbc["time"], tbc["home_goals"]) == ("", "")


def test_check_needs_a_full_round_robin():
    with pytest.raises(ValueError, match="is missing"):
        check(parse(PASTE))


def test_name_must_repeat():
    with pytest.raises(ValueError, match="twice"):
        parse(["Matchday 1", "28.08.2026", "Enyimba", "Rangers", "1:0", "Kano", "Kano"])
