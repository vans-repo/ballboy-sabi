"""Model A: Elo ratings, turned into Home / Draw / Away by a multinomial
logistic regression on the pre-match rating difference."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from model.settings import EloSettings

HOME, DRAW, AWAY = 0, 1, 2


def outcome_codes(home_goals: np.ndarray, away_goals: np.ndarray) -> np.ndarray:
    return np.where(home_goals > away_goals, HOME, np.where(home_goals == away_goals, DRAW, AWAY))


@dataclass
class Elo:
    """Ratings as they stand after the matches fed in so far."""

    s: EloSettings
    first_season: int  # season_index of the oldest season in the data
    ratings: dict[str, float] = field(default_factory=dict)
    season: int | None = None  # season of the last match processed

    def copy(self) -> Elo:
        return Elo(self.s, self.first_season, dict(self.ratings), self.season)

    def _regressed(self, rating: float) -> float:
        return rating + self.s.season_regression * (self.s.initial_rating - rating)

    def rating(self, team: str, season: int) -> float:
        """Rating a team takes into a match in `season` (without changing state)."""
        if team not in self.ratings:
            return self.s.initial_rating if season == self.first_season else self.s.newcomer_rating
        r = self.ratings[team]
        return self._regressed(r) if self.season is not None and season > self.season else r

    def diff(self, home: str, away: str, season: int) -> float:
        """Pre-match difference, home advantage included."""
        return self.rating(home, season) + self.s.home_advantage - self.rating(away, season)

    def update(
        self, home: str, away: str, hg: int, ag: int, season: int, estimated: bool
    ) -> tuple[float, float]:
        if self.season is not None and season > self.season:
            self.ratings = {t: self._regressed(r) for t, r in self.ratings.items()}
        self.season = season
        rh, ra = self.rating(home, season), self.rating(away, season)
        expected = 1.0 / (1.0 + 10 ** (-(rh + self.s.home_advantage - ra) / 400.0))
        actual = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        multiplier = math.log(abs(hg - ag) + 1) + 1 if hg != ag else 1.0
        k = self.s.k * (self.s.estimated_date_k_multiplier if estimated else 1.0)
        delta = k * multiplier * (actual - expected)
        self.ratings[home], self.ratings[away] = rh + delta, ra - delta
        return self.ratings[home], self.ratings[away]


def replay(played: pd.DataFrame, s: EloSettings, first_season: int) -> tuple[Elo, np.ndarray, np.ndarray]:
    """Run every played match in order. Returns the final state, each match's
    pre-match difference, and each match's (home, away) rating afterwards."""
    elo = Elo(s, first_season)
    diffs = np.empty(len(played))
    after = np.empty((len(played), 2))
    for i, m in enumerate(played.itertuples(index=False)):
        diffs[i] = elo.diff(m.home_id, m.away_id, m.season_index)
        after[i] = elo.update(
            m.home_id,
            m.away_id,
            int(m.home_goals),
            int(m.away_goals),
            m.season_index,
            bool(m.estimated),
        )
    return elo, diffs, after


class OutcomeModel:
    """Multinomial logistic regression: rating difference -> H/D/A."""

    def __init__(self, diffs: np.ndarray, outcomes: np.ndarray) -> None:
        self.model = LogisticRegression()
        self.model.fit((diffs / 400.0).reshape(-1, 1), outcomes)
        if list(self.model.classes_) != [HOME, DRAW, AWAY]:
            raise ValueError("training data must contain home wins, draws and away wins")

    def predict(self, diffs: np.ndarray) -> np.ndarray:
        return self.model.predict_proba((np.asarray(diffs, dtype=float) / 400.0).reshape(-1, 1))
