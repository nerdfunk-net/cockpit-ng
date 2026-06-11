#!/usr/bin/env python3
"""Initialize the cockpit_test database.

Loads .env.test, then calls init_db() to create all tables and run
auto-schema migrations against the test database.

Usage (from backend/)::

    python tests/scripts/init_test_db.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

env_file = BACKEND_DIR / ".env.test"
if not env_file.is_file():
    print(f"ERROR: {env_file} not found. Copy .env.test.example and fill in values.")
    sys.exit(1)

load_dotenv(env_file)

import logging  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

from core.database import engine, init_db  # noqa: E402

url = engine.url.render_as_string(hide_password=True)
print(f"Database: {url}")

init_db()
print("Done.")
