import pytest

from model.data import load_from_files
from model.settings import load_settings


@pytest.fixture(scope="session")
def data():
    return load_from_files()


@pytest.fixture(scope="session")
def settings():
    return load_settings()
