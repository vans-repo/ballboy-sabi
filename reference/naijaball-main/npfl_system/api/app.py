"""
api/app.py
NaijaBall Analytics Platform — Flask REST API
Production-ready. Loads model once at startup, serves predictions in-memory.
"""
import os
import sys
import json
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── PATH SETUP ────────────────────────────────────────────────────────────────
# Ensure src/ is importable when running from api/ or project root
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.models.predict import Predictor
from src.utils.config import load

# ── APP SETUP ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# Allow requests from any origin (tighten this to your Vercel URL in production)
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("najaball-api")

# ── LOAD MODEL AT STARTUP ─────────────────────────────────────────────────────
log.info("Loading model and rebuilding team trackers…")
predictor = Predictor()
cfg = load()
log.info("Model ready.")

# Active 2026/27 teams
ACTIVE_TEAMS = sorted([
    "Abia Warriors", "Barau", "Bendel Insurance", "Doma United FC",
    "Enugu Rangers", "Enyimba", "Ikorodu City", "Inter Lagos FC",
    "Kano Pillars", "Katsina United", "Kun Khalifat", "Kwara United",
    "Nasarawa United", "Niger Tornadoes", "Plateau United", "Ranchers Bees",
    "Rivers United", "Shooting Stars", "Sporting Lagos", "Warri Wolves",
])

HISTORICAL_TEAMS = sorted([
    "Akwa United", "Bayelsa United", "El-Kanemi Warriors", "Gombe United",
    "Heartland", "Lobi Stars", "Remo Stars", "Sunshine Stars", "Wikki Tourists",
])

# Final 2025/26 standings (all 38 rounds)
STANDINGS = [
    {"team":"Enugu Rangers",    "p":38,"w":19,"d":11,"l":8,  "gf":47,"ga":27,"gd":20, "pts":68,"form":["D","W","W","W","W"]},
    {"team":"Rivers United",    "p":36,"w":18,"d":10,"l":8,  "gf":41,"ga":26,"gd":15, "pts":64,"form":["W","L","W","W","W"]},
    {"team":"Shooting Stars",   "p":38,"w":18,"d":6, "l":14, "gf":41,"ga":40,"gd":1,  "pts":60,"form":["D","W","W","W","L"]},
    {"team":"Ikorodu City",     "p":38,"w":16,"d":10,"l":12, "gf":43,"ga":39,"gd":4,  "pts":58,"form":["W","L","W","L","L"]},
    {"team":"Bendel Insurance", "p":38,"w":14,"d":14,"l":10, "gf":45,"ga":38,"gd":7,  "pts":56,"form":["W","W","W","L","D"]},
    {"team":"Nasarawa United",  "p":38,"w":16,"d":8, "l":14, "gf":37,"ga":34,"gd":3,  "pts":56,"form":["L","W","L","W","L"]},
    {"team":"Abia Warriors",    "p":38,"w":16,"d":7, "l":15, "gf":31,"ga":34,"gd":-3, "pts":55,"form":["L","W","L","L","L"]},
    {"team":"Kano Pillars",     "p":38,"w":15,"d":6, "l":17, "gf":37,"ga":39,"gd":-2, "pts":51,"form":["L","W","L","W","L"]},
    {"team":"Katsina United",   "p":37,"w":14,"d":9, "l":14, "gf":36,"ga":39,"gd":-3, "pts":51,"form":["L","W","L","W","L"]},
    {"team":"Kwara United",     "p":38,"w":13,"d":11,"l":14, "gf":35,"ga":36,"gd":-1, "pts":50,"form":["D","W","D","W","L"]},
    {"team":"Enyimba",          "p":38,"w":13,"d":10,"l":15, "gf":44,"ga":42,"gd":2,  "pts":49,"form":["W","L","W","L","W"]},
    {"team":"Kun Khalifat",     "p":37,"w":13,"d":10,"l":14, "gf":42,"ga":40,"gd":2,  "pts":49,"form":["W","D","W","W","W"]},
    {"team":"Barau",            "p":37,"w":12,"d":13,"l":12, "gf":30,"ga":29,"gd":1,  "pts":49,"form":["W","L","W","L","W"]},
    {"team":"Plateau United",   "p":36,"w":15,"d":4, "l":17, "gf":38,"ga":38,"gd":0,  "pts":49,"form":["L","D","L","L","W"]},
    {"team":"Warri Wolves",     "p":38,"w":13,"d":10,"l":15, "gf":36,"ga":41,"gd":-5, "pts":49,"form":["L","L","W","L","W"]},
    {"team":"Niger Tornadoes",  "p":38,"w":13,"d":9, "l":16, "gf":37,"ga":36,"gd":1,  "pts":48,"form":["D","L","D","D","W"]},
    {"team":"Remo Stars",       "p":38,"w":14,"d":5, "l":19, "gf":42,"ga":47,"gd":-5, "pts":47,"form":["L","W","L","W","D"]},
    {"team":"El-Kanemi Warriors","p":37,"w":12,"d":8,"l":17,  "gf":27,"ga":47,"gd":-20,"pts":44,"form":["W","L","L","D","L"]},
    {"team":"Bayelsa United",   "p":38,"w":11,"d":10,"l":17, "gf":37,"ga":42,"gd":-5, "pts":43,"form":["L","L","L","L","W"]},
    {"team":"Wikki Tourists",   "p":38,"w":9, "d":13,"l":16, "gf":36,"ga":48,"gd":-12,"pts":40,"form":["W","L","L","L","L"]},
]

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    """Health check — confirms API and model are alive."""
    return jsonify({
        "status": "ok",
        "model": "npfl_brain.pkl",
        "dataset": "1,127 matches · 2023–2026",
        "accuracy": "68.24%",
        "season": "2026/27",
    })


@app.route("/api/teams", methods=["GET"])
def teams():
    """Return active and historical team lists."""
    return jsonify({
        "active":     ACTIVE_TEAMS,
        "historical": HISTORICAL_TEAMS,
        "season":     "2026/27",
    })


@app.route("/api/standings", methods=["GET"])
def standings():
    """Return final 2025/26 league standings."""
    return jsonify({
        "season":    "2025/26",
        "rounds":    38,
        "standings": STANDINGS,
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Predict the outcome of a fixture.
    Body: { "home": "Enugu Rangers", "away": "Rivers United" }
    Returns: probabilities for each outcome class.
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    home = data.get("home", "").strip()
    away = data.get("away", "").strip()

    if not home or not away:
        return jsonify({"error": "Both 'home' and 'away' fields are required"}), 400
    if home == away:
        return jsonify({"error": "Home and away teams must be different"}), 400

    try:
        result = predictor.predict(home, away)
        return jsonify({
            "home":         result["home"],
            "away":         result["away"],
            "prediction":   result["prediction"],
            "confidence":   round(result["confidence"], 4),
            "probabilities": {k: round(v, 4) for k, v in result["probabilities"].items()},
            "travel_km":    result["travel_km"],
            "home_quality": result["home_quality"],
            "away_quality": result["away_quality"],
            "home_form":    result["home_form"],
            "away_form":    result["away_form"],
            "cold_start_home": result["cold_start_home"],
            "cold_start_away": result["cold_start_away"],
        })
    except Exception as e:
        log.error(f"Prediction error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/h2h", methods=["GET"])
def h2h():
    """
    Head-to-head record between two teams.
    Query params: ?home=Enugu Rangers&away=Rivers United
    """
    home = request.args.get("home", "").strip()
    away = request.args.get("away", "").strip()

    if not home or not away:
        return jsonify({"error": "Both 'home' and 'away' query params are required"}), 400

    import pandas as pd
    try:
        df = pd.read_csv(cfg["paths"]["raw"])
        mask = (
            ((df["Home_Team"] == home) & (df["Away_Team"] == away)) |
            ((df["Home_Team"] == away) & (df["Away_Team"] == home))
        )
        matches = df[mask].tail(10).to_dict(orient="records")

        wins_home  = sum(1 for m in matches if
                         (m["Home_Team"]==home and m["Outcome"]=="Home Win") or
                         (m["Away_Team"]==home and m["Outcome"]=="Away Win"))
        wins_away  = sum(1 for m in matches if
                         (m["Home_Team"]==away and m["Outcome"]=="Home Win") or
                         (m["Away_Team"]==away and m["Outcome"]=="Away Win"))
        draws      = sum(1 for m in matches if m["Outcome"]=="Draw")

        return jsonify({
            "home":       home,
            "away":       away,
            "matches":    matches,
            "summary":    {"home_wins": wins_home, "away_wins": wins_away, "draws": draws},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def stats():
    """Return high-level dataset and model statistics."""
    return jsonify({
        "total_matches":    1127,
        "seasons":          ["2023/24", "2024/25", "2025/26"],
        "date_range":       "02/10/2023 – 24/05/2026",
        "unique_teams":     27,
        "model_accuracy":   0.6824,
        "train_accuracy":   0.7576,
        "overfit_gap":      0.0752,
        "home_win_rate":    0.656,
        "home_win_rate_2526": 0.638,
        "top_feature":      "Travel_Distance_Km",
        "top_feature_importance": 0.200,
        "feature_importance": {
            "Travel_Distance_Km": 0.200,
            "Home_Quality":       0.117,
            "Away_Quality":       0.115,
            "Away_Form_Pts":      0.104,
            "Away_Defense_L5":    0.100,
            "Home_Form_Pts":      0.094,
            "Away_Rest_Days":     0.092,
            "Home_Rest_Days":     0.090,
            "Home_Attack_L5":     0.088,
        },
    })


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
