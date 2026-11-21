import ast
import uuid
from pathlib import Path

import pytest
import yaml

from seedlib.sources import load_team_catalogue, read_chronological, read_historical

ROOT = Path(__file__).resolve().parents[3]
REF = ROOT / "reference"
NAIJABALL = REF / "naijaball-main/npfl_system"


@pytest.fixture(scope="session")
def catalogue():
    return load_team_catalogue(ROOT / "supabase/seed/teams.yaml")


@pytest.fixture(scope="session")
def alias_map(catalogue):
    """alias -> fake team id, as the team_aliases table would hold it."""
    ids = {t.name: str(uuid.uuid5(uuid.NAMESPACE_DNS, t.name)) for t in catalogue}
    return {a: ids[t.name] for t in catalogue for a in t.aliases}, ids


@pytest.fixture(scope="session")
def historical():
    return read_historical(REF / "npfl_historical_data.csv")


@pytest.fixture(scope="session")
def chronological():
    return read_chronological(NAIJABALL / "data/raw/npfl_chronological_data.csv")


@pytest.fixture(scope="session")
def reference_config():
    return yaml.safe_load((NAIJABALL / "config/config.yaml").read_text())


@pytest.fixture(scope="session")
def reference_alias_map():
    tree = ast.parse((NAIJABALL / "src/utils/helpers.py").read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", None) == "ALIAS_MAP":
            return ast.literal_eval(node.value)
    raise AssertionError("ALIAS_MAP not found")
