import numpy as np
import pandas as pd
import pytest

from model.blend import best_score_for_outcome, blend, whole_percentages
from model.data import Dataset
from model.elo import Elo, replay
from model.evaluate import elo_walk_forward, evaluate, poisson_walk_forward
from model.evaluate import test_set as make_test_set
from model.poisson import fit, outcome_probs
from model.reasons import ordinal
from model.run import compute, release_check

NOW = pd.Timestamp("2026-11-21T12:00:00Z")


@pytest.fixture(scope="module")
def output(data, settings):
    return compute(data, settings, NOW)


@pytest.fixture(scope="module")
def report(data, settings):
    return evaluate(data, settings)


# --- Probabilities sum to 1 ---------------------------------------------------
def test_published_probabilities_sum_to_one(output):
    assert output.predictions
    for p in output.predictions:
        assert round(p["p_home"] * 100) + round(p["p_draw"] * 100) + round(p["p_away"] * 100) == 100


def test_model_probabilities_sum_to_one(data, settings):
    ts = make_test_set(data)
    for p in (elo_walk_forward(ts, settings.elo), poisson_walk_forward(ts, settings.poisson)):
        assert np.allclose(p.sum(axis=1), 1.0)
    grid = fit(ts.played, NOW, settings.poisson)[0].grid(*ts.played.iloc[0][["home_id", "away_id"]])
    assert np.isclose(grid.sum(), 1.0) and np.isclose(outcome_probs(grid).sum(), 1.0)


@pytest.mark.parametrize(
    "p", [[0.333, 0.333, 0.334], [0.655, 0.255, 0.09], [0.995, 0.004, 0.001], [1 / 3] * 3]
)
def test_whole_percentages(p):
    pct = whole_percentages(np.array(p))
    assert sum(pct) == 100 and all(v >= 0 for v in pct)


# --- No prediction uses a match played at or after its kickoff ------------------
def test_production_run_ignores_later_results(data, settings):
    """Run as of 1 October 2026, then change every result played after that.
    Nothing the run publishes may change."""
    cutoff = pd.Timestamp("2026-10-01T00:00:00Z")
    before = compute(data, settings, cutoff)
    m = data.matches.copy()
    later = (m.kickoff >= cutoff) & m.status.eq("played")
    assert later.sum() > 50
    m.loc[later, "home_goals"], m.loc[later, "away_goals"] = 0, 7
    after = compute(Dataset(m, data.teams, data.seasons), settings, cutoff)
    assert after.predictions == before.predictions
    assert after.ratings == before.ratings
    assert after.ballboy_picks == before.ballboy_picks


def test_walk_forward_ignores_matches_from_the_same_week_on(data, settings):
    ts = make_test_set(data)
    week = sorted(ts.test.week.unique())[20]
    idx = np.flatnonzero((ts.test.week == week).to_numpy())
    p_elo = elo_walk_forward(ts, settings.elo)[idx]
    p_pois = poisson_walk_forward(ts, settings.poisson)[idx]

    played = ts.played.copy()
    later = (played.kickoff >= week).to_numpy()
    played.loc[later, "home_goals"], played.loc[later, "away_goals"] = 0, 7
    ts2 = type(ts)(played, ts.test, ts.seasons)
    assert np.allclose(elo_walk_forward(ts2, settings.elo)[idx], p_elo)
    assert np.allclose(poisson_walk_forward(ts2, settings.poisson)[idx], p_pois)


def test_training_data_is_before_every_kickoff(data, output):
    kickoff = data.matches.set_index("id").kickoff
    latest_used = max(pd.Timestamp(r["rated_at"]) for r in output.ratings)
    assert all(kickoff[p["match_id"]] > latest_used for p in output.predictions)


# --- Promoted teams get the newcomer values -------------------------------------
def test_elo_newcomer_and_first_season(settings):
    elo = Elo(settings.elo, first_season=0)
    assert elo.rating("founder", 0) == 1500
    assert elo.rating("promoted", 3) == 1450


def test_promoted_team_starts_at_1450_in_the_data(data, settings):
    played = data.model_inputs.reset_index(drop=True)
    _, diffs, _ = replay(played, settings.elo, int(played.season_index.min()))
    inter = next(t for t, n in data.teams.items() if n == "Inter Lagos")  # first season: 2026/27
    first = played[(played.home_id == inter) | (played.away_id == inter)].index[0]
    m = played.loc[first]
    # Recover Inter Lagos's rating from the pre-match difference.
    elo, _, _ = replay(played.loc[: first - 1], settings.elo, 0)
    other = m.away_id if m.home_id == inter else m.home_id
    if m.home_id == inter:
        assert np.isclose(
            diffs[first], 1450 + settings.elo.home_advantage - elo.rating(other, m.season_index)
        )
    else:
        assert np.isclose(
            diffs[first], elo.rating(other, m.season_index) + settings.elo.home_advantage - 1450
        )


def test_season_regression(settings):
    elo = Elo(settings.elo, first_season=0, ratings={"a": 1600.0}, season=0)
    assert elo.rating("a", 1) == pytest.approx(1600 - 0.25 * 100)


def test_poisson_newcomer_values(data, settings):
    model, _ = fit(data.model_inputs[data.model_inputs.kickoff < NOW], NOW, settings.poisson)
    assert model.strengths("never-played") == (-0.15, 0.15)


def test_goal_difference_multiplier(settings):
    elo = Elo(settings.elo, 0)
    elo.update("h", "a", 3, 0, 0, estimated=False)
    big = elo.ratings["h"] - 1500
    elo2 = Elo(settings.elo, 0)
    elo2.update("h", "a", 1, 0, 0, estimated=False)
    small = elo2.ratings["h"] - 1500
    assert big / small == pytest.approx((np.log(4) + 1) / (np.log(2) + 1))
    elo3 = Elo(settings.elo, 0)
    elo3.update("h", "a", 1, 0, 0, estimated=True)
    assert elo3.ratings["h"] - 1500 == pytest.approx(small / 2)


# --- Evaluation ----------------------------------------------------------------------
def test_reproduces_the_reference_blend(report):
    assert report["matches"] == 755
    assert report["blend"]["log_loss"] == pytest.approx(0.876, abs=0.005)


def test_blend_beats_league_averages(report):
    assert report["blend"]["log_loss"] < report["league_average"]["log_loss"]


# --- Outputs ----------------------------------------------------------------------------
def test_ballboy_picks_agree_with_the_model(output):
    picks = {p["match_id"]: p for p in output.ballboy_picks}
    for pred in output.predictions:
        pick = picks[pred["match_id"]]
        probs = [pred["p_home"], pred["p_draw"], pred["p_away"]]
        assert ["home", "draw", "away"][int(np.argmax(probs))] == pick["outcome"] or max(probs) == sorted(
            probs
        )[-2]
        h, a = pick["pred_home_goals"], pick["pred_away_goals"]
        assert {"home": h > a, "draw": h == a, "away": h < a}[pick["outcome"]]


def test_best_score_for_outcome():
    g = np.zeros((4, 4))
    g[1, 0], g[1, 1], g[0, 2] = 0.5, 0.3, 0.2
    assert best_score_for_outcome(g, 0) == (1, 0)
    assert best_score_for_outcome(g, 1) == (1, 1)
    assert best_score_for_outcome(g, 2) == (0, 2)


def test_reasons_are_two_or_three_lines(output):
    assert all(2 <= len(p["reasons"]) <= 3 for p in output.predictions)
    assert all(" rated " in p["reasons"][0] for p in output.predictions)


def test_upset_alert_threshold(output, settings):
    threshold = settings.upset_away_win_ratio * output.away_win_rate
    for p in output.predictions:
        if p["upset_alert"]:
            assert p["p_away"] >= threshold - 0.005


def test_one_rating_row_per_team_per_match(data, output):
    keys = {(r["team_id"], r["match_id"]) for r in output.ratings}
    assert len(keys) == len(output.ratings) == 2 * len(data.model_inputs[data.model_inputs.kickoff < NOW])


def test_ordinal():
    assert [ordinal(n) for n in (1, 2, 3, 4, 11, 12, 13, 21, 22)] == [
        "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd",
    ]  # fmt: skip


def test_blend_weights():
    assert np.allclose(blend([1, 0, 0], [0, 0, 1], 0.5), [0.5, 0, 0.5])


# --- Release rule ---------------------------------------------------------------------
def _metrics(version, blend_ll, league_ll=0.88):
    return {
        "model_version": version,
        "blend": {"log_loss": blend_ll},
        "league_average": {"log_loss": league_ll},
    }


def test_release_rule():
    prod = {"model_version": "v1", "metrics": {"walk_forward": _metrics("v1", 0.875)}}
    assert release_check(_metrics("v1", 0.874), None) is None
    assert "league averages" in release_check(_metrics("v1", 0.881), None)
    assert release_check(_metrics("v2", 0.870), prod) is None
    assert "production" in release_check(_metrics("v2", 0.876), prod)
    assert release_check(_metrics("v1", 0.877), prod) is None  # same version: only the league check
