#!/usr/bin/env python3
"""Backfill ``distribution`` and ``disk_total_gb`` from existing ``ansible_facts``.

Usage (from ``backend/``)::

    python scripts/backfill_server_search_columns.py
    python scripts/backfill_server_search_columns.py --env-file .env
    python scripts/backfill_server_search_columns.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402


def _load_env(env_file: Optional[Path]) -> str:
    if env_file is not None:
        if not env_file.is_file():
            print(f"ERROR: env file not found: {env_file}", file=sys.stderr)
            sys.exit(1)
        load_dotenv(env_file)
        return str(env_file)

    env_dev = BACKEND_DIR / ".env"
    env_test = BACKEND_DIR / ".env.test"
    if env_dev.is_file():
        load_dotenv(env_dev)
        return str(env_dev)
    if env_test.is_file():
        load_dotenv(env_test)
        return str(env_test)
    print("WARNING: No .env or .env.test found; using process environment.")
    return "(process environment)"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill distribution and disk_total_gb from ansible_facts."
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Path to dotenv file (default: backend/.env, then .env.test).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows that would be updated without writing.",
    )
    args = parser.parse_args()

    env_loaded = _load_env(args.env_file)
    print(f"Env file: {env_loaded}")

    from repositories.servers.servers_repository import ServersRepository

    repo = ServersRepository()

    if args.dry_run:
        from core.models.servers import Server
        from services.servers.ansible_facts_parser import parse_ansible_facts

        would_update = 0
        with repo._db_session() as session:
            for server in session.query(Server).all():
                facts = server.ansible_facts
                if not facts:
                    continue
                if "ansible_facts" in facts:
                    output = {"facts": facts}
                else:
                    output = {"facts": {"ansible_facts": facts}}
                parsed = parse_ansible_facts(output)
                needs_dist = not server.distribution and bool(parsed.distribution)
                needs_disk = (
                    server.disk_total_gb is None and parsed.disk_total_gb is not None
                )
                if needs_dist or needs_disk:
                    would_update += 1
        print(f"[dry-run] would update {would_update} server(s)")
        return

    updated = repo.backfill_search_columns_from_facts()
    print(f"Updated {updated} server(s)")


if __name__ == "__main__":
    main()
