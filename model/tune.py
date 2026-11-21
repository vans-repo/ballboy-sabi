"""Small grid search over the settings, scored by walk-forward log-loss.

    python -m model.tune [--source files]

Elo and Poisson settings are searched separately (they don't affect each
other), then the blend weight on the best pair. Prints the best settings next
to the current ones; config.yaml is never changed automatically. To adopt new
settings, edit config.yaml and raise model_version: the release rule then
checks the new version against the one in production.
"""

from __future__ import annotations

import argparse
import itertools
from dataclasses import replace

import numpy as np

from model.blend import blend
from model.elo import outcome_codes
from model.evaluate import elo_walk_forward, load, poisson_walk_forward, scores, test_set
from model.settings import load_settings

ELO_GRID = {
    "k": [15, 20, 25, 30],
    "home_advantage": [60, 90, 120],
    "season_regression": [0.15, 0.25, 0.35],
}
POISSON_GRID = {"time_decay_per_day": [0.0015, 0.0025, 0.0035], "l2_penalty": [1.0, 2.0, 4.0]}
BLEND_WEIGHTS = [0.3, 0.4, 0.5, 0.6, 0.7]


def grid(values: dict[str, list[float]]) -> list[dict[str, float]]:
    return [dict(zip(values, combo, strict=True)) for combo in itertools.product(*values.values())]


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--source", choices=["supabase", "files"], default="supabase")
    args = parser.parse_args()
    s = load_settings()
    ts = test_set(load(args.source))
    y = outcome_codes(ts.test.home_goals.to_numpy(), ts.test.away_goals.to_numpy())

    def ll(p: np.ndarray) -> float:
        return scores(p, y)["log_loss"]

    elo_runs = [(c, elo_walk_forward(ts, replace(s.elo, **c))) for c in grid(ELO_GRID)]
    best_elo, p_elo = min(elo_runs, key=lambda r: ll(r[1]))
    pois_runs = [(c, poisson_walk_forward(ts, replace(s.poisson, **c))) for c in grid(POISSON_GRID)]
    best_pois, p_pois = min(pois_runs, key=lambda r: ll(r[1]))
    best_w = min(BLEND_WEIGHTS, key=lambda w: ll(blend(p_elo, p_pois, w)))

    current = ll(blend(elo_walk_forward(ts, s.elo), poisson_walk_forward(ts, s.poisson), s.elo_weight))
    tuned = ll(blend(p_elo, p_pois, best_w))
    print(f"Walk-forward log-loss on {len(ts.test)} matches ({', '.join(ts.seasons)}), lower is better\n")
    print(f"  Current settings ({s.model_version}): {current:.4f}")
    print(f"  Best in grid:                    {tuned:.4f}  ({current - tuned:+.4f})\n")
    print("Best settings found:")
    for k, v in best_elo.items():
        print(f"  elo.{k}: {v}  (now {getattr(s.elo, k)})")
    for k, v in best_pois.items():
        print(f"  poisson.{k}: {v}  (now {getattr(s.poisson, k)})")
    print(f"  blend.elo_weight: {best_w}  (now {s.elo_weight})")
    print("\nTop 5 Elo settings:")
    for c, p in sorted(elo_runs, key=lambda r: ll(r[1]))[:5]:
        print(f"  {ll(p):.4f}  {c}")
    print("Top 5 Poisson settings:")
    for c, p in sorted(pois_runs, key=lambda r: ll(r[1]))[:5]:
        print(f"  {ll(p):.4f}  {c}")


if __name__ == "__main__":
    main()
