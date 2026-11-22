"""Walk-forward test: refit every week on everything played before that week,
predict the week's matches, and score the unrounded probabilities.

    python -m model.evaluate                  # data from Supabase
    python -m model.evaluate --source files   # data from the source files

Scores the last two completed seasons by default, comparing the blend with
each model alone, plain league averages and always picking home.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np
import pandas as pd

from model.blend import blend
from model.data import Dataset, load_from_files, load_from_supabase
from model.db import Supabase
from model.elo import Elo, OutcomeModel, outcome_codes
from model.poisson import fit, outcome_probs
from model.settings import EloSettings, PoissonSettings, Settings, load_settings

LAGOS = "Africa/Lagos"
EPS = 1e-15


def week_start(kickoff: pd.Series) -> pd.Series:
    """Monday 00:00 in Lagos of each kickoff's week, as UTC."""
    local = kickoff.dt.tz_convert(LAGOS)
    monday = local.dt.normalize() - pd.to_timedelta(local.dt.weekday, unit="D")
    return monday.dt.tz_convert("UTC")


@dataclass
class TestSet:
    played: pd.DataFrame  # every model input, in order
    test: pd.DataFrame  # the matches being predicted, with a `week` column
    seasons: list[str]


def test_set(data: Dataset, n_seasons: int = 2) -> TestSet:
    played = data.model_inputs.reset_index(drop=True)
    seasons = data.completed_seasons()[-n_seasons:]
    test = played[played.season.isin(seasons) & ~played.estimated].copy()
    test["week"] = week_start(test.kickoff)
    return TestSet(played, test, seasons)


def elo_walk_forward(ts: TestSet, s: EloSettings) -> np.ndarray:
    """Elo probabilities for every test match, using only matches before its week."""
    played = ts.played
    first = int(played.season_index.min())
    outcomes = outcome_codes(played.home_goals.to_numpy(), played.away_goals.to_numpy())
    elo = Elo(s, first)
    diffs = np.empty(len(played))
    out = np.empty((len(ts.test), 3))
    kickoffs = list(played.kickoff)
    done = 0  # matches fed into elo so far
    rows = list(played.itertuples(index=False))
    for week, idx in ts.test.groupby("week").indices.items():
        while done < len(rows) and kickoffs[done] < week:
            m = rows[done]
            diffs[done] = elo.diff(m.home_id, m.away_id, m.season_index)
            elo.update(
                m.home_id,
                m.away_id,
                int(m.home_goals),
                int(m.away_goals),
                m.season_index,
                bool(m.estimated),
            )
            done += 1
        lr = OutcomeModel(diffs[:done], outcomes[:done])
        week_rows = ts.test.iloc[idx]
        week_diffs = [elo.diff(r.home_id, r.away_id, r.season_index) for r in week_rows.itertuples()]
        out[idx] = lr.predict(np.array(week_diffs))
    return out


def poisson_walk_forward(ts: TestSet, s: PoissonSettings) -> np.ndarray:
    played = ts.played
    out = np.empty((len(ts.test), 3))
    x = None
    for week, idx in ts.test.groupby("week").indices.items():
        train = played[played.kickoff < week]
        model, x = fit(train, week, s, x)
        for j, r in zip(idx, ts.test.iloc[idx].itertuples(), strict=True):
            out[j] = outcome_probs(model.grid(r.home_id, r.away_id))
    return out


def league_average_walk_forward(ts: TestSet) -> np.ndarray:
    played = ts.played
    codes = outcome_codes(played.home_goals.to_numpy(), played.away_goals.to_numpy())
    out = np.empty((len(ts.test), 3))
    for week, idx in ts.test.groupby("week").indices.items():
        before = codes[(played.kickoff < week).to_numpy()]
        out[idx] = np.bincount(before, minlength=3) / len(before)
    return out


def scores(p: np.ndarray, outcomes: np.ndarray) -> dict[str, float]:
    onehot = np.eye(3)[outcomes]
    return {
        "log_loss": float(-np.mean(np.log(np.clip(p[np.arange(len(p)), outcomes], EPS, 1.0)))),
        "brier": float(np.mean(np.sum((p - onehot) ** 2, axis=1))),
        "accuracy": float(np.mean(np.argmax(p, axis=1) == outcomes)),
    }


def calibration(p_home: np.ndarray, home_won: np.ndarray, width: float = 0.1) -> list[dict[str, float]]:
    rows = []
    for lo in np.arange(0.0, 1.0, width):
        hi = lo + width
        mask = (p_home >= lo) & ((p_home < hi) | (hi >= 1.0))
        if mask.any():
            rows.append(
                {
                    "bucket": f"{lo:.0%}-{hi:.0%}",
                    "matches": int(mask.sum()),
                    "predicted": float(p_home[mask].mean()),
                    "actual": float(home_won[mask].mean()),
                }
            )
    return rows


def evaluate(data: Dataset, settings: Settings) -> dict:
    ts = test_set(data)
    outcomes = outcome_codes(ts.test.home_goals.to_numpy(), ts.test.away_goals.to_numpy())
    p_elo = elo_walk_forward(ts, settings.elo)
    p_poisson = poisson_walk_forward(ts, settings.poisson)
    p_blend = blend(p_elo, p_poisson, settings.elo_weight)
    p_league = league_average_walk_forward(ts)
    return {
        "model_version": settings.model_version,
        "seasons": ts.seasons,
        "matches": len(ts.test),
        "blend": scores(p_blend, outcomes),
        "elo": scores(p_elo, outcomes),
        "poisson": scores(p_poisson, outcomes),
        "league_average": scores(p_league, outcomes),
        "always_home_accuracy": float(np.mean(outcomes == 0)),
        "calibration": calibration(p_blend[:, 0], outcomes == 0),
    }


def format_report(r: dict) -> str:
    lines = [
        f"Walk-forward test, model {r['model_version']}: {r['matches']} matches in {', '.join(r['seasons'])}",
        "Refitted every week on all matches played before that week.",
        "",
        f"  {'Model':<18}{'Log-loss':>10}{'Brier':>9}{'Accuracy':>10}",
    ]
    for key, name in [("blend", "Blend"), ("elo", "Elo only"), ("poisson", "Poisson only"),
                      ("league_average", "League averages")]:  # fmt: skip
        s = r[key]
        lines.append(f"  {name:<18}{s['log_loss']:>10.4f}{s['brier']:>9.4f}{s['accuracy']:>10.1%}")
    lines.append(f"  {'Always home':<18}{'-':>10}{'-':>9}{r['always_home_accuracy']:>10.1%}")
    gap = r["league_average"]["log_loss"] - r["blend"]["log_loss"]
    verdict = "beats" if gap > 0 else "does NOT beat"
    lines += [
        "",
        f"The blend {verdict} league averages by {abs(gap):.4f} log-loss (lower is better).",
        "",
    ]
    lines.append("Calibration: predicted vs actual home-win rate")
    lines.append(f"  {'Predicted':<12}{'Matches':>8}{'Avg predicted':>15}{'Actual':>9}")
    for c in r["calibration"]:
        lines.append(f"  {c['bucket']:<12}{c['matches']:>8}{c['predicted']:>15.1%}{c['actual']:>9.1%}")
    return "\n".join(lines)


def load(source: str) -> Dataset:
    if source == "files":
        return load_from_files()
    db = Supabase.from_env()
    try:
        return load_from_supabase(db)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--source", choices=["supabase", "files"], default="supabase")
    args = parser.parse_args()
    print(format_report(evaluate(load(args.source), load_settings())))


if __name__ == "__main__":
    main()
