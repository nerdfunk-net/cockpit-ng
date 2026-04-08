#!/usr/bin/env python3
"""
Import locations (buildings, rooms) from a CSV file into Nautobot.

Reads a CSV file and a config.yaml that defines:
  - Which columns to import and their Nautobot location type names
  - The parent-child dependency order between location types
  - Value mappings (CSV value → Nautobot name)

Usage:
    python scripts/import_racks/import_locations.py --csv scripts/import_racks/sample_data.csv
    python scripts/import_racks/import_locations.py --csv data.csv --config custom_config.yaml
    python scripts/import_racks/import_locations.py --csv data.csv --log-level DEBUG

Requirements:
    Run from the /backend directory with the virtual environment active:
        cd backend
        python scripts/import_racks/import_locations.py --csv scripts/import_racks/sample_data.csv
"""

import argparse
import asyncio
import csv
import logging
import sys
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

# Allow imports from the backend root
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent


class LocationImporter:
    """Imports CSV location data into Nautobot using config-driven mappings."""

    def __init__(self, config: Dict[str, Any], nautobot_service: Any) -> None:
        self.config = config
        self.nautobot = nautobot_service

        # Runtime caches
        self.status_cache: Dict[str, str] = {}
        self.location_type_cache: Dict[str, str] = {}
        self.location_cache: Dict[str, str] = {}  # name -> id

        # Lookup tables built from config
        self._import_map: Dict[str, str] = {}  # csv_column -> nautobot_type
        self._nautobot_to_csv: Dict[str, str] = {}  # nautobot_type -> csv_column
        self._dependency_map: Dict[
            str, Optional[str]
        ] = {}  # nautobot_type -> parent_nautobot_type
        self._mapping_lookup: Dict[
            str, Dict[str, Dict[str, Any]]
        ] = {}  # csv_col -> {csv_val -> {nautobot, parent?}}

        self._build_lookups()

    def _build_lookups(self) -> None:
        for item in self.config.get("import", []):
            csv_col = item["csv"]
            nb_type = item["nautobot"]
            self._import_map[csv_col] = nb_type
            self._nautobot_to_csv[nb_type] = csv_col

        self._rack_location_type: Optional[str] = (
            None  # nautobot type that holds the rack
        )
        for dep in self.config.get("dependencies", []):
            parent = dep.get("parent")
            self._dependency_map[dep["name"]] = (
                parent if parent and parent != "null" else None
            )
            if "location" in dep:
                self._rack_location_type = dep["location"]

        for csv_col, entries in self.config.get("mappings", {}).items():
            self._mapping_lookup[csv_col] = {}
            for entry in entries:
                self._mapping_lookup[csv_col][entry["csv"]] = {
                    "nautobot": entry["nautobot"],
                    "parent": entry.get("parent"),
                }

    def get_import_order(self) -> List[Tuple[str, str]]:
        """Return (csv_column, nautobot_type) pairs sorted so parents come before children."""
        imported_types = set(self._nautobot_to_csv.keys())

        # For each imported type, find its imported parent (if any)
        imported_parent: Dict[str, Optional[str]] = {}
        for nb_type in imported_types:
            parent = self._dependency_map.get(nb_type)
            imported_parent[nb_type] = parent if parent in imported_types else None

        order: List[str] = []
        visited: set = set()

        def visit(nb_type: str) -> None:
            if nb_type in visited:
                return
            parent = imported_parent.get(nb_type)
            if parent:
                visit(parent)
            visited.add(nb_type)
            order.append(nb_type)

        for nb_type in sorted(imported_types):  # sorted for determinism
            visit(nb_type)

        return [(self._nautobot_to_csv[nb_type], nb_type) for nb_type in order]

    def map_value(self, csv_column: str, csv_value: str) -> str:
        """Translate a CSV value to its Nautobot equivalent. Returns original if no mapping."""
        col_mappings = self._mapping_lookup.get(csv_column, {})
        entry = col_mappings.get(csv_value)
        if entry:
            return entry["nautobot"]
        return csv_value

    def get_parent_name(self, nautobot_type: str, row: Dict[str, str]) -> Optional[str]:
        """Resolve the parent location name for a given nautobot type and CSV row."""
        parent_nb_type = self._dependency_map.get(nautobot_type)
        if not parent_nb_type:
            return None

        # Find the CSV column that provides data for the parent type
        parent_csv_col: Optional[str] = None
        if parent_nb_type in self._nautobot_to_csv:
            parent_csv_col = self._nautobot_to_csv[parent_nb_type]
        else:
            # Match mapping key to parent nautobot type (case-insensitive)
            for col in self._mapping_lookup:
                if col.lower() == parent_nb_type.lower():
                    parent_csv_col = col
                    break

        if not parent_csv_col or parent_csv_col not in row:
            return None

        csv_value = row[parent_csv_col].strip()
        if not csv_value:
            return None

        return self.map_value(parent_csv_col, csv_value)

    async def get_status_uuid(self, status_name: str = "Active") -> Optional[str]:
        """Get the UUID for a status by name, with caching."""
        if status_name in self.status_cache:
            return self.status_cache[status_name]

        response = await self.nautobot.rest_request("extras/statuses/", method="GET")
        if "results" in response:
            for status in response["results"]:
                self.status_cache[status["name"]] = status["id"]
                self.status_cache[status["name"].lower()] = status["id"]

        return self.status_cache.get(status_name) or self.status_cache.get(
            status_name.lower()
        )

    async def resolve_location_type_id(self, nb_type_name: str) -> Optional[str]:
        """Resolve a location type name to its UUID, with caching."""
        if nb_type_name in self.location_type_cache:
            return self.location_type_cache[nb_type_name]

        response = await self.nautobot.rest_request(
            f"dcim/location-types/?name={nb_type_name}", method="GET"
        )
        if response.get("count", 0) > 0:
            lt_id = response["results"][0]["id"]
            self.location_type_cache[nb_type_name] = lt_id
            return lt_id

        logger.warning("Location type '%s' not found in Nautobot", nb_type_name)
        return None

    async def resolve_location_id(self, location_name: str) -> Optional[str]:
        """Resolve a location name to its UUID. Checks cache first, then Nautobot."""
        if location_name in self.location_cache:
            return self.location_cache[location_name]

        response = await self.nautobot.rest_request(
            f"dcim/locations/?name={location_name}", method="GET"
        )
        if response.get("count", 0) > 0:
            loc_id = response["results"][0]["id"]
            self.location_cache[location_name] = loc_id
            return loc_id

        return None

    async def create_location(
        self, name: str, nautobot_type: str, parent_name: Optional[str] = None
    ) -> Optional[str]:
        """Create a location in Nautobot. Returns the location ID (new or existing)."""
        existing_id = await self.resolve_location_id(name)
        if existing_id:
            return existing_id

        lt_id = await self.resolve_location_type_id(nautobot_type)
        if not lt_id:
            logger.error(
                "Cannot create '%s': location type '%s' not found in Nautobot",
                name,
                nautobot_type,
            )
            return None

        status_uuid = await self.get_status_uuid("Active")

        payload: Dict[str, Any] = {
            "name": name,
            "location_type": {"id": lt_id},
        }
        if status_uuid:
            payload["status"] = {"id": status_uuid}

        if parent_name:
            parent_id = await self.resolve_location_id(parent_name)
            if parent_id:
                payload["parent"] = {"id": parent_id}
            else:
                logger.warning(
                    "Parent location '%s' not found in Nautobot for '%s'",
                    parent_name,
                    name,
                )

        result = await self.nautobot.rest_request(
            "dcim/locations/", method="POST", data=payload
        )
        loc_id = result.get("id")
        if loc_id:
            self.location_cache[name] = loc_id
            logger.debug("Created location '%s' (type: %s)", name, nautobot_type)
        return loc_id

    @staticmethod
    def _parse_width(width_value: Any) -> int:
        """Extract integer rack width from a value like '19 inches' or 19."""
        return int(str(width_value).split()[0])

    async def resolve_rack_id(self, rack_name: str) -> Optional[str]:
        """Check whether a rack with this name already exists in Nautobot."""
        response = await self.nautobot.rest_request(
            f"dcim/racks/?name={rack_name}", method="GET"
        )
        if response.get("count", 0) > 0:
            return response["results"][0]["id"]
        return None

    async def create_rack(
        self, name: str, location_name: str, defaults: Dict[str, Any]
    ) -> Optional[str]:
        """Create a rack in Nautobot. Returns its ID, or None on failure."""
        location_id = await self.resolve_location_id(location_name)
        if not location_id:
            logger.error(
                "Cannot create rack '%s': location '%s' not found", name, location_name
            )
            return None

        status_name = defaults.get("Status", "Active")
        status_uuid = await self.get_status_uuid(status_name)

        payload: Dict[str, Any] = {
            "name": name,
            "location": {"id": location_id},
        }
        if status_uuid:
            payload["status"] = {"id": status_uuid}
        if "type" in defaults:
            payload["type"] = defaults["type"]
        if "width" in defaults:
            payload["width"] = self._parse_width(defaults["width"])
        if "height" in defaults:
            payload["u_height"] = int(defaults["height"])

        result = await self.nautobot.rest_request(
            "dcim/racks/", method="POST", data=payload
        )
        rack_id = result.get("id")
        if rack_id:
            logger.debug("Created rack '%s' at location '%s'", name, location_name)
        return rack_id

    async def import_racks(
        self, rows: List[Dict[str, str]], defaults: Dict[str, Any]
    ) -> Dict[str, int]:
        """Import racks from CSV rows using the deepest imported location as the rack location."""
        if not self._rack_location_type:
            logger.warning(
                "No 'location' defined for Rack in dependencies; skipping rack import"
            )
            return {"created": 0, "skipped": 0, "errors": 0}

        rack_location_csv_col = self._nautobot_to_csv.get(self._rack_location_type)
        if not rack_location_csv_col:
            logger.error(
                "Rack location type '%s' is not in the import list; cannot find CSV column",
                self._rack_location_type,
            )
            return {"created": 0, "skipped": 0, "errors": 0}

        stats = {"created": 0, "skipped": 0, "errors": 0}
        print("\n--- Importing Rack (column: rack) ---")

        for row in rows:
            rack_name = row.get("rack", "").strip()
            if not rack_name:
                continue

            location_csv_value = row.get(rack_location_csv_col, "").strip()
            if not location_csv_value:
                logger.warning("Row for rack '%s' has no location value", rack_name)
                stats["errors"] += 1
                continue

            location_name = self.map_value(rack_location_csv_col, location_csv_value)

            try:
                existing_id = await self.resolve_rack_id(rack_name)
                if existing_id:
                    print(f"  SKIP   {rack_name}")
                    stats["skipped"] += 1
                    continue

                rack_id = await self.create_rack(rack_name, location_name, defaults)
                if rack_id:
                    stats["created"] += 1
                    print(f"  CREATE {rack_name} [Rack] -> {location_name}")
                else:
                    stats["errors"] += 1
                    print(f"  ERROR  {rack_name} (see log for details)")
            except Exception as exc:
                logger.error("Error processing rack '%s': %s", rack_name, exc)
                stats["errors"] += 1
                print(f"  ERROR  {rack_name}: {exc}")

        return stats

    async def import_from_csv(self, csv_path: str) -> Dict[str, int]:
        """Read the CSV and import all locations and racks in dependency order."""
        rows: List[Dict[str, str]] = []
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        logger.info("Read %d rows from %s", len(rows), csv_path)

        import_order = self.get_import_order()
        print(f"Import order: {[nb_type for _, nb_type in import_order]} -> Rack")

        stats = {"created": 0, "skipped": 0, "errors": 0}

        for csv_col, nb_type in import_order:
            print(f"\n--- Importing {nb_type} (column: {csv_col}) ---")

            # Collect unique (mapped_name, parent_name) pairs from all rows
            unique: Dict[str, Optional[str]] = {}
            for row in rows:
                csv_value = row.get(csv_col, "").strip()
                if not csv_value:
                    continue
                location_name = self.map_value(csv_col, csv_value)
                parent_name = self.get_parent_name(nb_type, row)
                if location_name not in unique:
                    unique[location_name] = parent_name

            for location_name, parent_name in unique.items():
                try:
                    existing_id = await self.resolve_location_id(location_name)
                    if existing_id:
                        print(f"  SKIP   {location_name}")
                        stats["skipped"] += 1
                        continue

                    loc_id = await self.create_location(
                        location_name, nb_type, parent_name
                    )
                    if loc_id:
                        stats["created"] += 1
                        parent_info = f" -> {parent_name}" if parent_name else ""
                        print(f"  CREATE {location_name} [{nb_type}]{parent_info}")
                    else:
                        stats["errors"] += 1
                        print(f"  ERROR  {location_name} (see log for details)")
                except Exception as exc:
                    logger.error("Error processing '%s': %s", location_name, exc)
                    stats["errors"] += 1
                    print(f"  ERROR  {location_name}: {exc}")

        rack_defaults = self.config.get("defaults", {}).get("rack", {})
        rack_stats = await self.import_racks(rows, rack_defaults)
        for key in stats:
            stats[key] += rack_stats[key]

        print(
            f"\nDone. Created: {stats['created']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}"
        )
        return stats


async def async_main(args: argparse.Namespace) -> None:
    try:
        import service_factory
    except ImportError as exc:
        print(
            f"ERROR: Could not import backend modules: {exc}\n"
            "Make sure you are running from the backend/ directory with the venv active.",
            file=sys.stderr,
        )
        sys.exit(1)

    nautobot = service_factory.build_nautobot_service()
    await nautobot.startup()
    try:
        importer = LocationImporter(args.config_data, nautobot)
        await importer.import_from_csv(args.csv)
    finally:
        await nautobot.shutdown()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import buildings/rooms from CSV into Nautobot locations.",
    )
    parser.add_argument(
        "--csv",
        required=True,
        metavar="PATH",
        help="Path to the CSV file to import",
    )
    parser.add_argument(
        "--config",
        metavar="PATH",
        default=str(SCRIPT_DIR / "config.yaml"),
        help="Path to config YAML (default: config.yaml in script directory)",
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
        print(f"ERROR: Config file not found: {args.config}", file=sys.stderr)
        sys.exit(1)

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)

    if not config_data:
        print(f"ERROR: Config file is empty: {args.config}", file=sys.stderr)
        sys.exit(1)

    args.config_data = config_data
    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
