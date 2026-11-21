"""Typed access to config.yaml: every tunable number lives there."""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

import yaml

CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


@dataclass(frozen=True)
class EloSettings:
    initial_rating: float
    newcomer_rating: float
    season_regression: float
    k: float
    home_advantage: float
    estimated_date_k_multiplier: float


@dataclass(frozen=True)
class PoissonSettings:
    time_decay_per_day: float
    l2_penalty: float
    newcomer_attack: float
    newcomer_defence: float
    max_goals: int


@dataclass(frozen=True)
class Settings:
    model_version: str
    elo: EloSettings
    poisson: PoissonSettings
    elo_weight: float
    upset_away_win_ratio: float
    upset_lookback_seasons: int
    upset_max_per_matchday: int

    def with_changes(self, **changes: Any) -> Settings:
        """Copy with dotted overrides, e.g. with_changes(**{"elo.k": 25})."""
        elo, poisson, top = {}, {}, {}
        for key, value in changes.items():
            group, _, name = key.rpartition(".")
            {"elo": elo, "poisson": poisson, "": top}[group][name] = value
        return replace(self, elo=replace(self.elo, **elo), poisson=replace(self.poisson, **poisson), **top)


def load_settings(path: Path = CONFIG_PATH) -> Settings:
    raw = yaml.safe_load(path.read_text())
    return Settings(
        model_version=str(raw["model_version"]),
        elo=EloSettings(**raw["elo"]),
        poisson=PoissonSettings(**raw["poisson"]),
        elo_weight=float(raw["blend"]["elo_weight"]),
        upset_away_win_ratio=float(raw["upset_alert"]["away_win_ratio"]),
        upset_lookback_seasons=int(raw["upset_alert"]["lookback_seasons"]),
        upset_max_per_matchday=int(raw["upset_alert"]["max_per_matchday"]),
    )
