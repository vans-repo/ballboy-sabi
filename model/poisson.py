"""Model B: Poisson goals model with team attack and defence strengths.

  expected home goals = exp(intercept + home advantage + home attack + away defence)
  expected away goals = exp(intercept + away attack + home defence)

Fitted by weighted maximum likelihood (weight exp(-decay * days before the
prediction date)) with an L2 penalty on every attack and defence strength.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

from model.settings import PoissonSettings


@dataclass(frozen=True)
class PoissonFit:
    intercept: float
    home_advantage: float
    attack: dict[str, float]
    defence: dict[str, float]
    s: PoissonSettings

    def strengths(self, team: str) -> tuple[float, float]:
        """(attack, defence); a team with no matches gets the newcomer values."""
        if team in self.attack:
            return self.attack[team], self.defence[team]
        return self.s.newcomer_attack, self.s.newcomer_defence

    def expected_goals(self, home: str, away: str) -> tuple[float, float]:
        ha, hd = self.strengths(home)
        aa, ad = self.strengths(away)
        return (
            float(np.exp(self.intercept + self.home_advantage + ha + ad)),
            float(np.exp(self.intercept + aa + hd)),
        )

    def grid(self, home: str, away: str) -> np.ndarray:
        """P(home scores i, away scores j) for 0..max_goals each, summing to 1."""
        lh, la = self.expected_goals(home, away)
        goals = np.arange(self.s.max_goals + 1)
        g = np.outer(poisson.pmf(goals, lh), poisson.pmf(goals, la))
        return g / g.sum()


def outcome_probs(grid: np.ndarray) -> np.ndarray:
    """[home, draw, away] from a score grid."""
    return np.array([np.tril(grid, -1).sum(), np.trace(grid), np.triu(grid, 1).sum()])


def top_scores(grid: np.ndarray, n: int = 3) -> list[tuple[int, int, float]]:
    flat = np.argsort(grid, axis=None)[::-1][:n]
    return [
        (int(i), int(j), float(grid[i, j])) for i, j in zip(*np.unravel_index(flat, grid.shape), strict=True)
    ]


def fit(
    played: pd.DataFrame, as_of: pd.Timestamp, s: PoissonSettings, start: np.ndarray | None = None
) -> tuple[PoissonFit, np.ndarray]:
    """Fit on `played` (all before `as_of`). Returns the fit and the raw
    parameter vector, which can warm-start the next fit."""
    teams = sorted(set(played.home_id) | set(played.away_id))
    index = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    hi = played.home_id.map(index).to_numpy()
    ai = played.away_id.map(index).to_numpy()
    hg = played.home_goals.to_numpy(dtype=float)
    ag = played.away_goals.to_numpy(dtype=float)
    days = (as_of - played.kickoff).dt.total_seconds().to_numpy() / 86400.0
    w = np.exp(-s.time_decay_per_day * np.maximum(days, 0.0))
    lam = s.l2_penalty

    def objective(x: np.ndarray) -> tuple[float, np.ndarray]:
        mu, home, att, dfn = x[0], x[1], x[2 : 2 + n], x[2 + n :]
        log_h = mu + home + att[hi] + dfn[ai]
        log_a = mu + att[ai] + dfn[hi]
        eh, ea = np.exp(log_h), np.exp(log_a)
        nll = np.sum(w * (eh - hg * log_h)) + np.sum(w * (ea - ag * log_a))
        nll += lam * (np.sum(att**2) + np.sum(dfn**2))
        rh, ra = w * (eh - hg), w * (ea - ag)  # d nll / d log-rate
        grad = np.empty_like(x)
        grad[0] = rh.sum() + ra.sum()
        grad[1] = rh.sum()
        grad[2 : 2 + n] = np.bincount(hi, rh, n) + np.bincount(ai, ra, n) + 2 * lam * att
        grad[2 + n :] = np.bincount(ai, rh, n) + np.bincount(hi, ra, n) + 2 * lam * dfn
        return nll, grad

    x0 = start if start is not None and len(start) == 2 + 2 * n else np.zeros(2 + 2 * n)
    if start is None or len(start) != 2 + 2 * n:
        x0[0] = np.log(max(np.average(np.r_[hg, ag], weights=np.r_[w, w]), 0.1))
    res = minimize(objective, x0, jac=True, method="L-BFGS-B")
    x = res.x
    return (
        PoissonFit(
            intercept=float(x[0]),
            home_advantage=float(x[1]),
            attack={t: float(x[2 + i]) for t, i in index.items()},
            defence={t: float(x[2 + n + i]) for t, i in index.items()},
            s=s,
        ),
        x,
    )
