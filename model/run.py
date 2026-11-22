"""A production run: rebuild ratings, predict every upcoming match, write
predictions, team ratings and The Ballboy's picks, and log the run.

    python -m model.run [--trigger manual|scheduled|result_saved] [--dry-run]

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; optional MODEL_RUN_ID (a queued
model_runs row to fill in), REVALIDATE_URL and REVALIDATE_SECRET.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import traceback
from dataclasses import dataclass, field
from typing import Any

import httpx
import numpy as np
import pandas as pd

from model.blend import best_score_for_outcome, blend, whole_percentages
from model.data import UPCOMING, Dataset, load_from_supabase
from model.db import Supabase
from model.elo import OutcomeModel, outcome_codes, replay
from model.evaluate import evaluate
from model.poisson import fit, outcome_probs, top_scores
from model.reasons import ReasonContext, reasons_for
from model.settings import Settings, load_settings

OUTCOMES = ("home", "draw", "away")
LAGOS = "Africa/Lagos"


@dataclass
class RunOutput:
    predictions: list[dict[str, Any]] = field(default_factory=list)  # without model_run_id
    ratings: list[dict[str, Any]] = field(default_factory=list)
    ballboy_picks: list[dict[str, Any]] = field(default_factory=list)  # without user_id
    away_win_rate: float = 0.0


def _day_start(ts: pd.Timestamp) -> pd.Timestamp:
    return ts.tz_convert(LAGOS).normalize().tz_convert("UTC")


def compute(data: Dataset, s: Settings, now: pd.Timestamp) -> RunOutput:
    """Everything a run writes, from data known before `now`."""
    out = RunOutput()
    played = data.model_inputs[data.model_inputs.kickoff < now].reset_index(drop=True)
    first = int(data.matches.season_index.min())

    # --- Elo, and team ratings after every played match ---------------------
    elo, diffs, after = replay(played, s.elo, first)
    outcomes = outcome_codes(played.home_goals.to_numpy(), played.away_goals.to_numpy())
    lr = OutcomeModel(diffs, outcomes)

    # Attack and defence as of the end of each match day (warm-started fits).
    days = played.kickoff.map(_day_start)
    x = None
    strengths: dict[pd.Timestamp, Any] = {}
    for day in sorted(days.unique()):
        end = day + pd.Timedelta(days=1)
        model, x = fit(played[played.kickoff < end], end, s.poisson, x)
        strengths[day] = model
    for i, m in enumerate(played.itertuples(index=False)):
        model = strengths[days.iloc[i]]
        for team, rating in ((m.home_id, after[i, 0]), (m.away_id, after[i, 1])):
            att, dfn = model.strengths(team)
            out.ratings.append(
                {"team_id": team, "match_id": m.id, "rated_at": m.kickoff.isoformat(),
                 "elo": round(float(rating), 2), "attack": round(att, 4), "defence": round(dfn, 4)}
            )  # fmt: skip

    # --- Upcoming matches ---------------------------------------------------
    m = data.matches
    upcoming = m[m.status.isin(UPCOMING) & (m.kickoff > now)].reset_index(drop=True)
    completed = [data.seasons.index(x) for x in data.completed_seasons()][-s.upset_lookback_seasons :]
    recent = played[played.season_index.isin(completed)]
    out.away_win_rate = float(np.mean(recent.away_goals > recent.home_goals)) if len(recent) else 0.0
    threshold = s.upset_away_win_ratio * out.away_win_rate

    season_teams = {
        int(si): set(g.home_id) | set(g.away_id) for si, g in data.matches.groupby("season_index")
    }
    ctx = ReasonContext(played, elo, data.teams, season_teams)
    fits: dict[pd.Timestamp, Any] = {}
    x = None
    for f in upcoming.itertuples(index=False):
        day = _day_start(f.kickoff)
        if day not in fits:
            fits[day], x = fit(played, day, s.poisson, x)
        grid = fits[day].grid(f.home_id, f.away_id)
        p_elo = lr.predict(np.array([elo.diff(f.home_id, f.away_id, f.season_index)]))[0]
        p = blend(p_elo, outcome_probs(grid), s.elo_weight)
        pct = whole_percentages(p)
        xg_h, xg_a = fits[day].expected_goals(f.home_id, f.away_id)
        out.predictions.append(
            {
                "match_id": f.id,
                "p_home": pct[0] / 100, "p_draw": pct[1] / 100, "p_away": pct[2] / 100,
                "xg_home": round(xg_h, 2), "xg_away": round(xg_a, 2),
                "top_scores": [{"home": h, "away": a, "p": round(q, 3)} for h, a, q in top_scores(grid)],
                "reasons": reasons_for(f, ctx),
                "upset_alert": bool(p[2] >= threshold),
            }
        )  # fmt: skip
        pick = int(np.argmax(p))
        hg, ag = best_score_for_outcome(grid, pick)
        out.ballboy_picks.append(
            {
                "match_id": f.id,
                "outcome": OUTCOMES[pick],
                "pred_home_goals": hg,
                "pred_away_goals": ag,
            }
        )
    return out


def release_check(metrics: dict, production: dict | None) -> str | None:
    """None if this version may publish, else the reason it may not."""
    blend_ll = metrics["blend"]["log_loss"]
    league_ll = metrics["league_average"]["log_loss"]
    if blend_ll >= league_ll:
        return f"walk-forward log-loss {blend_ll:.4f} does not beat league averages ({league_ll:.4f})"
    if production and production["model_version"] != metrics["model_version"]:
        prod_ll = production["metrics"]["walk_forward"]["blend"]["log_loss"]
        if blend_ll >= prod_ll:
            return (
                f"{metrics['model_version']} log-loss {blend_ll:.4f} does not beat "
                f"{production['model_version']} in production ({prod_ll:.4f})"
            )
    return None


def revalidate() -> str:
    url, secret = os.environ.get("REVALIDATE_URL"), os.environ.get("REVALIDATE_SECRET")
    if not url or not secret:
        return "skipped (REVALIDATE_URL not set)"
    try:
        r = httpx.post(url, headers={"Authorization": f"Bearer {secret}"}, timeout=30)
        return f"HTTP {r.status_code}"
    except httpx.HTTPError as e:
        return f"failed: {e}"  # pages still refresh on their normal schedule


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--trigger", choices=["manual", "scheduled", "result_saved"],
                        default=os.environ.get("MODEL_TRIGGER") or "manual")  # fmt: skip
    parser.add_argument("--dry-run", action="store_true", help="compute and print, write nothing")
    args = parser.parse_args()

    settings = load_settings()
    db = Supabase.from_env()
    started = time.monotonic()
    now = pd.Timestamp.now(tz="UTC")
    run_id = os.environ.get("MODEL_RUN_ID") or None
    start_row = {
        "status": "running",
        "started_at": now.isoformat(),
        "model_version": settings.model_version,
    }
    if args.dry_run:
        pass
    elif run_id:
        db.update("model_runs", start_row, id=f"eq.{run_id}")
    else:
        run_id = db.insert_one("model_runs", {**start_row, "trigger": args.trigger})["id"]

    try:
        data = load_from_supabase(db)
        metrics = evaluate(data, settings)
        done = db.select(
            "model_runs",
            "model_version,metrics,finished_at",
            status="eq.done",
            metrics="not.is.null",
        )
        production = max(done, key=lambda r: r["finished_at"]) if done else None
        refusal = release_check(metrics, production)
        if refusal:
            raise RuntimeError(f"Release rule: {refusal}. The last published predictions stay up.")

        out = compute(data, settings, now)
        ballboy = db.select("profiles", "id", role="eq.system")
        if not ballboy:
            raise RuntimeError("The Ballboy's profile is missing: run the seed first")

        summary = {
            "walk_forward": metrics,
            "predictions": len(out.predictions),
            "upset_alerts": sum(p["upset_alert"] for p in out.predictions),
            "team_ratings": len(out.ratings),
            "league_away_win_rate": round(out.away_win_rate, 4),
        }
        wf, league = metrics["blend"]["log_loss"], metrics["league_average"]["log_loss"]
        print(
            f"Walk-forward blend log-loss {wf:.4f} (league averages {league:.4f}, "
            f"{metrics['matches']} matches)"
        )
        print(
            f"{len(out.predictions)} predictions, {summary['upset_alerts']} upset alerts, "
            f"{len(out.ratings)} team ratings, {len(out.ballboy_picks)} Ballboy picks"
        )
        if args.dry_run:
            for p in out.predictions[:3]:
                print(p)
            return 0

        db.insert("team_ratings", out.ratings, on_conflict="team_id,match_id", merge=True)
        picks = [{**p, "user_id": ballboy[0]["id"]} for p in out.ballboy_picks]
        db.insert("picks", picks, on_conflict="user_id,match_id", merge=True)
        db.insert("predictions", [{**p, "model_run_id": run_id} for p in out.predictions])
        summary["duration_seconds"] = round(time.monotonic() - started, 1)
        db.update(
            "model_runs",
            {
                "status": "done",
                "finished_at": pd.Timestamp.now(tz="UTC").isoformat(),
                "metrics": summary,
            },
            id=f"eq.{run_id}",
        )
        print(f"Done in {summary['duration_seconds']}s. Revalidate: {revalidate()}")
        return 0
    except Exception as e:
        traceback.print_exc()
        if run_id and not args.dry_run:
            db.update(
                "model_runs",
                {
                    "status": "failed",
                    "finished_at": pd.Timestamp.now(tz="UTC").isoformat(),
                    "error": str(e)[:2000],
                },
                id=f"eq.{run_id}",
            )
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
