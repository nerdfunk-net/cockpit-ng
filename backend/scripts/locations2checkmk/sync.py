#!/usr/bin/env python3
"""
Sync Nautobot locations to a CheckMK host tag group.

Reads a config.yaml that defines:
  - nautobot_htg:    (required) CheckMK host tag group name to create or update
  - nautobot_filter: (required) filter for which Nautobot locations to sync,
                     e.g. "location_type=Room"
  - value:           (optional) template for composing tag values;
                     default: "{location.name}"
  - location_type:   (deprecated) superseded by nautobot_filter; still accepted
                     for backward compatibility

The value field uses the same {field | location_type:Type} syntax as folder path
templates. Use {location.name} for the location's own name and
{location.name | location_type:City} to look up an ancestor by type. Multiple
expressions separated by spaces are concatenated, e.g.:
  value: "{location.name} {location.name | location_type:City}"

Fetches all Nautobot locations, builds a full ancestor hierarchy in memory, then
creates or updates the CheckMK host tag group. The sync is additive: existing tags
are never removed.

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

_ALL_LOCATIONS_QUERY = """
{
  locations {
    id
    name
    location_type { id name }
    parent { id name location_type { id name } }
  }
}
"""

DEFAULT_VALUE_TEMPLATE = "{location.name}"


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
        self.htg_name: str = config["nautobot_htg"]
        self.nautobot_filter: Optional[str] = config.get("nautobot_filter")
        self.location_type: Optional[str] = config.get("location_type")
        self.value_template: str = config.get("value", DEFAULT_VALUE_TEMPLATE)
        self.checkmk_id_template: Optional[str] = config.get("checkmk_id")
        self.nautobot = nautobot_service
        self.client = checkmk_client
        self.dry_run = dry_run

    async def fetch_all_locations(self) -> List[Dict[str, Any]]:
        """Query Nautobot for all locations with one level of parent info."""
        result = await self.nautobot.graphql_query(_ALL_LOCATIONS_QUERY)
        if "errors" in result:
            raise RuntimeError("GraphQL error: %s" % result["errors"])
        return result.get("data", {}).get("locations", [])

    @staticmethod
    def _build_locations_map(
        all_locations: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """Build an id→location dict for O(1) hierarchy traversal."""
        return {loc["id"]: loc for loc in all_locations}

    @staticmethod
    def _parse_nautobot_filter(filter_str: str) -> Dict[str, str]:
        """Parse a 'key=value' filter string into a dict.

        Supports comma-separated pairs, e.g. "location_type=Room,name=foo".
        Currently only location_type is acted upon.
        """
        result: Dict[str, str] = {}
        for part in filter_str.split(","):
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                result[key.strip()] = value.strip()
        return result

    @staticmethod
    def _apply_nautobot_filter(
        locations: List[Dict[str, Any]], filter_dict: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Filter a list of locations according to parsed filter conditions."""
        result = locations
        if "location_type" in filter_dict:
            target = filter_dict["location_type"].lower()
            result = [
                loc for loc in result
                if (loc.get("location_type") or {}).get("name", "").lower() == target
            ]
        return result

    @staticmethod
    def _build_full_location(
        loc_id: str, locations_map: Dict[str, Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Recursively build a nested location dict with a complete parent chain.

        _resolve_location_type_filter expects device_data["location"]["parent"]["parent"]...
        but the GraphQL response only gives one parent level. This function reconstructs
        the full chain by looking up each parent in locations_map.
        """
        loc = locations_map.get(loc_id)
        if not loc:
            return None
        result: Dict[str, Any] = {
            "name": loc["name"],
            "location_type": loc.get("location_type") or {},
        }
        parent_ref = loc.get("parent")
        if parent_ref and parent_ref.get("id"):
            result["parent"] = Locations2CheckMKSyncer._build_full_location(
                parent_ref["id"], locations_map
            )
        return result

    @staticmethod
    def _resolve_tag_entries(
        target_locations: List[Dict[str, Any]],
        value_template: str,
        locations_map: Dict[str, Dict[str, Any]],
        checkmk_id_template: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """Compute CheckMK tag entries for each target location.

        Evaluates value_template (title) and optionally checkmk_id_template (ID)
        against the full ancestor hierarchy of each location.
        When checkmk_id_template is absent the ID is derived by slugifying the title.
        Deduplicates by tag ID.
        """
        from utils.cmk_folder_utils import parse_folder_value

        seen_ids: set = set()
        tags: List[Dict[str, str]] = []
        for loc in target_locations:
            full_loc = Locations2CheckMKSyncer._build_full_location(
                loc["id"], locations_map
            )
            ctx = {"location": full_loc}

            title = parse_folder_value(value_template, ctx).strip()
            if not title:
                logger.warning(
                    "Location '%s' produced empty tag value from template '%s', skipping",
                    loc.get("name"),
                    value_template,
                )
                continue

            if checkmk_id_template:
                tag_id = slugify(
                    parse_folder_value(checkmk_id_template, ctx).strip()
                )
            else:
                tag_id = slugify(title)

            if not tag_id:
                logger.warning(
                    "Location '%s' produced empty tag ID, skipping",
                    loc.get("name"),
                )
                continue

            if tag_id not in seen_ids:
                seen_ids.add(tag_id)
                tags.append({"id": tag_id, "title": title})
        return tags

    def _get_existing_tag_group(self) -> Optional[Dict[str, Any]]:
        """Return the existing tag group from CheckMK, or None if not found."""
        from services.checkmk.exceptions import CheckMKAPIError

        try:
            return self.client.get_host_tag_group(self.htg_name)
        except CheckMKAPIError as exc:
            if exc.status_code == 404:
                return None
            raise

    async def sync(self) -> Dict[str, Any]:
        """
        Fetch locations and upsert them into the CheckMK host tag group.

        Returns a dict with keys: added, skipped, action ('created'|'updated'|'noop').
        """
        all_locations = await self.fetch_all_locations()
        print("Fetched %d total locations from Nautobot" % len(all_locations))

        locations_map = self._build_locations_map(all_locations)

        if self.nautobot_filter:
            filter_dict = self._parse_nautobot_filter(self.nautobot_filter)
            target_locations = self._apply_nautobot_filter(all_locations, filter_dict)
            print(
                "Filter '%s' matched %d locations"
                % (self.nautobot_filter, len(target_locations))
            )
        elif self.location_type:
            target_locations = [
                loc for loc in all_locations
                if (loc.get("location_type") or {}).get("name", "").lower()
                == self.location_type.lower()
            ]
            print(
                "Found %d locations of type '%s'"
                % (len(target_locations), self.location_type)
            )
        else:
            target_locations = all_locations
            print("No filter configured — syncing all %d locations" % len(all_locations))

        existing = self._get_existing_tag_group()

        if existing is None:
            print("Tag group '%s' not found — will create" % self.htg_name)
            new_tags = self._resolve_tag_entries(
                target_locations, self.value_template, locations_map,
                self.checkmk_id_template,
            )
            for tag in new_tags:
                print("  ADD  id=%-28s title=%s" % (tag["id"], tag["title"]))

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

        all_new_tags = self._resolve_tag_entries(
            target_locations, self.value_template, locations_map,
            self.checkmk_id_template,
        )
        additions = [tag for tag in all_new_tags if tag["id"] not in existing_ids]
        skipped = len(all_new_tags) - len(additions)

        if not additions:
            print("  Nothing to add")
            return {"added": 0, "skipped": skipped, "action": "noop"}

        for tag in additions:
            print("  ADD  %-30s (%s)" % (tag["id"], tag["title"]))

        if not self.dry_run:
            merged_tags = existing_tags + additions
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

    if "nautobot_htg" not in config_data:
        print("ERROR: Missing required config key: 'nautobot_htg'", file=sys.stderr)
        sys.exit(1)

    if "nautobot_filter" not in config_data and "location_type" not in config_data:
        print(
            "ERROR: Config must include 'nautobot_filter' (e.g. \"location_type=Room\") "
            "or the legacy 'location_type' key.",
            file=sys.stderr,
        )
        sys.exit(1)

    if "location_type" in config_data and "nautobot_filter" not in config_data:
        print(
            "WARNING: 'location_type' is deprecated. "
            "Use 'nautobot_filter: \"location_type=%s\"' instead."
            % config_data["location_type"]
        )

    args.config_data = config_data
    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
