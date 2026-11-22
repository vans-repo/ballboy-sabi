"""Initial data load: teams, aliases, five seasons of results, the 2026/27
fixtures and The Ballboy. Safe to run more than once.

Usage (from the repo root):
    pip install -r supabase/seed/requirements.txt
    python supabase/seed/seed.py [--admin-email you@example.com]

Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from seedlib.load import seed
from seedlib.plan import CURRENT_SEASON
from seedlib.report import build_report
from seedlib.rest import Supabase, SupabaseError
from seedlib.sources import (
    load_team_catalogue,
    read_chronological,
    read_fixtures,
    read_historical,
)

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "reference"
HISTORICAL = REFERENCE / "npfl_historical_data.csv"
CHRONOLOGICAL = REFERENCE / "naijaball-main/npfl_system/data/raw/npfl_chronological_data.csv"
FIXTURES = ROOT / "data/fixtures_2026_27.csv"
TEAMS = Path(__file__).resolve().parent / "teams.yaml"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--admin-email", help="make this existing account an admin")
    parser.add_argument("--fixtures", type=Path, default=FIXTURES, help=f"{CURRENT_SEASON} fixtures CSV")
    args = parser.parse_args(argv)

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.", file=sys.stderr)
        return 2

    catalogue = load_team_catalogue(TEAMS)
    historical = read_historical(HISTORICAL)
    chronological = read_chronological(CHRONOLOGICAL)
    fixtures = read_fixtures(args.fixtures, CURRENT_SEASON)
    fixture_rows = fixtures.matches if not fixtures.errors else []

    db = Supabase(url, key)
    try:
        result = seed(db, catalogue, historical, chronological, fixture_rows, args.admin_email)
        print(build_report(db, result, fixtures, os.path.relpath(args.fixtures, ROOT)))
    except SupabaseError as e:
        print(f"Supabase refused a request: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()

    plan = result.plan
    problems = plan.unresolved or plan.duplicates or result.alias_conflicts or fixtures.errors
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
