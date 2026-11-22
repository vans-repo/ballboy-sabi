"""Combine the two models and round for publishing."""

from __future__ import annotations

import numpy as np


def blend(elo: np.ndarray, poisson: np.ndarray, elo_weight: float) -> np.ndarray:
    return elo_weight * np.asarray(elo) + (1.0 - elo_weight) * np.asarray(poisson)


def whole_percentages(p: np.ndarray) -> list[int]:
    """Round to whole percentages that sum to exactly 100 (largest remainder)."""
    scaled = np.asarray(p, dtype=float) / np.sum(p) * 100.0
    floors = np.floor(scaled).astype(int)
    short = 100 - int(floors.sum())
    for i in np.argsort(-(scaled - floors), kind="stable")[:short]:
        floors[i] += 1
    return [int(v) for v in floors]


def best_score_for_outcome(grid: np.ndarray, outcome: int) -> tuple[int, int]:
    """Most likely scoreline within an outcome (0 home, 1 draw, 2 away)."""
    n = grid.shape[0]
    i, j = np.indices((n, n))
    mask = [i > j, i == j, i < j][outcome]
    masked = np.where(mask, grid, -1.0)
    hi, ai = np.unravel_index(int(np.argmax(masked)), grid.shape)
    return int(hi), int(ai)
