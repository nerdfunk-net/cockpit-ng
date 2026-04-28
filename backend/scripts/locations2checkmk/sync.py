#!/usr/bin/env python3
"""
Sync Nautobot locations to a CheckMK host tag group.

Reads a config.yaml that defines:
  - location_type: the Nautobot location type to query (e.g. "City")
  - nautobot_htg: the CheckMK host tag group name to populate (e.g. "location")

Fetches all Nautobot locations of that type, then creates or updates the
CheckMK host tag group so it contains an entry for every location.
The sync is additive: existing tags in CheckMK are never removed.

Usage:
    python scripts/locations2checkmk/sync.py
    python scripts/locations2checkmk/sync.py --dry-run
    python scripts/locations2checkmk/sync.py --activate
    python scripts/locations2checkmk/sync.py --config path/to/config.yaml
    python scripts/locations2checkmk/sync.py --log-level DEBUG

Requirements:
    Run from the /backend directory with the virtual environment active:
        cd backend
        python scripts/locations2checkmk/sync.py
"""

import argparse
import asyncio
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

# Allow imports from the backend root
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent


def slugify(name: str) -> str:
    """Convert a human-readable name to a valid CheckMK tag ID."""
    lowered = name.lower()
    slugged = re.sub(r"[^a-z0-9]+", "_", lowered)
    return slugged.strip("_")


class Locations2CheckMKSyncer:
    """Syncs Nautobot locations of a given type into a CheckMK host tag group."""

    def __init__(
        self,
        config: Dict[str, Any],
        nautobot_service: Any,
        checkmk_client: Any,
        dry_run: bool = False,
    ) -> None:
        self.location_type: str = config["location_type"]
        self.htg_name: str = config["nautobot_htg"]
        self.nautobot = nautobot_service
        self.client = checkmk_client
        self.dry_run = dry_run

    async def fetch_locations(self) -> List[Dict[str, str]]:
        """Query Nautobot for all locations of the configured type."""
        query = '{ locations(location_type: "%s") { id name } }' % self.location_type
        result = await self.nautobot.graphql_query(query)
        if "errors" in result:
            raise RuntimeError("GraphQL error: %s" % result["errors"])
        return result.get("data", {}).get("locations", [])

    def _get_existing_tag_group(self) -> Optional[Dict[str, Any]]:
        """Return the existing tag group from CheckMK, or None if not found."""
        from services.checkmk.exceptions import CheckMKAPIError

        try:
            return self.client.get_host_tag_group(self.htg_name)
        except CheckMKAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    @staticmethod
    def _build_tags(names: List[str]) -> List[Dict[str, str]]:
        return [{"id": slugify(name), "title": name} for name in names]

    async def sync(self) -> Dict[str, Any]:
        """
        Fetch locations and upsert them into the CheckMK host tag group.

        Returns a dict with keys: added, skipped, action ('created'|'updated'|'noop').
        """
        locations = await self.fetch_locations()
        print(
            "Fetched %d locations from Nautobot (type: %s)"
            % (len(locations), self.location_type)
        )

        location_names = [loc["name"] for loc in locations]
        existing = self._get_existing_tag_group()

        if existing is None:
            print("Tag group '%s' not found — will create" % self.htg_name)
            new_tags = self._build_tags(location_names)
            for tag in new_tags:
                print("  ADD  %-30s (%s)" % (tag["id"], tag["title"]))

            if not self.dry_run:
                self.client.create_host_tag_group(
                    id=self.htg_name,
                    title=self.htg_name,
                    tags=new_tags,
                )
            return {"added": len(new_tags), "skipped": 0, "action": "created"}

        existing_tags: List[Dict] = existing.get("extensions", {}).get("tags", [])
        existing_ids = {t["id"] for t in existing_tags}
        print("Tag group '%s' exists with %d tags" % (self.htg_name, len(existing_ids)))

        additions = [
            name for name in location_names if slugify(name) not in existing_ids
        ]
        skipped = len(location_names) - len(additions)

        if not additions:
            print("  Nothing to add")
            return {"added": 0, "skipped": skipped, "action": "noop"}

        new_tags = self._build_tags(additions)
        for tag in new_tags:
            print("  ADD  %-30s (%s)" % (tag["id"], tag["title"]))

        if not self.dry_run:
            merged_tags = existing_tags + new_tags
            self.client.update_host_tag_group(
                name=self.htg_name,
                tags=merged_tags,
                repair=True,
            )
        return {"added": len(additions), "skipped": skipped, "action": "updated"}


async def async_main(args: argparse.Namespace) -> None:
    try:
        import service_factory
    except ImportError as exc:
        print(
            "ERROR: Could not import backend modules: %s\n"
            "Make sure you are running from the backend/ directory with the venv active."
            % exc,
            file=sys.stderr,
        )
        sys.exit(1)

    nautobot = service_factory.build_nautobot_service()
    await nautobot.startup()
    try:
        client = service_factory.build_checkmk_client()
        syncer = Locations2CheckMKSyncer(
            config=args.config_data,
            nautobot_service=nautobot,
            checkmk_client=client,
            dry_run=args.dry_run,
        )
        stats = await syncer.sync()

        if args.activate and not args.dry_run and stats["added"] > 0:
            print("\nActivating CheckMK changes...")
            result = client.activate_changes()
            logger.debug("Activation response: %s", result)
            print("Activation initiated.")

        dry_label = "  [DRY RUN]" if args.dry_run else ""
        print(
            "\nDone%s. Added: %d, Skipped: %d"
            % (dry_label, stats["added"], stats["skipped"])
        )
    finally:
        await nautobot.shutdown()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync Nautobot locations to a CheckMK host tag group.",
    )
    parser.add_argument(
        "--config",
        metavar="PATH",
        default=str(SCRIPT_DIR / "config.yaml"),
        help="Path to config YAML (default: config.yaml in script directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Print planned changes without making any API calls",
    )
    parser.add_argument(
        "--activate",
        action="store_true",
        default=False,
        help="Activate CheckMK changes after a successful sync",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity (default: INFO)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(levelname)s  %(name)s  %(message)s",
    )

    config_path = Path(args.config)
    if not config_path.exists():
        print("ERROR: Config file not found: %s" % args.config, file=sys.stderr)
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)

    if not config_data:
        print("ERROR: Config file is empty: %s" % args.config, file=sys.stderr)
        sys.exit(1)

    for required_key in ("location_type", "nautobot_htg"):
        if required_key not in config_data:
            print(
                "ERROR: Missing required config key: '%s'" % required_key,
                file=sys.stderr,
            )
            sys.exit(1)

    args.config_data = config_data
    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
