"""
Load ``backend/.env.test`` once per pytest session.

See ``.env.test.example`` for all supported variables (Nautobot, CheckMK,
PostgreSQL repository tests).
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_ENV_PATH = _BACKEND_DIR / ".env.test"
_LOADED = False


def load_test_env(*, override: bool = True) -> bool:
    """
    Load ``.env.test`` and enable env-backed integration settings.

    Returns True if the file existed and was loaded.
    """
    global _LOADED
    if _LOADED:
        return os.getenv("COCKPIT_TEST_ENV") == "1"

    if not TEST_ENV_PATH.is_file():
        return False

    load_dotenv(TEST_ENV_PATH, override=override)
    os.environ["COCKPIT_TEST_ENV"] = "1"
    _LOADED = True

    # Allow PG tests to use COCKPIT_DATABASE_* only
    from test_runtime_config import postgres_test_database_url

    if not os.getenv("TEST_DATABASE_URL", "").strip():
        derived = postgres_test_database_url()
        if derived:
            os.environ["TEST_DATABASE_URL"] = derived

    return True


def test_env_path() -> Path:
    return TEST_ENV_PATH
