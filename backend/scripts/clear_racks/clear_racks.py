#!/usr/bin/env python3
"""Clear rack configuration from one or multiple Nautobot devices.

Removes the rack, face, and position fields from devices that match a name
filter.  Sending ``null`` for these fields via the Nautobot REST PATCH
endpoint is the correct way to clear optional FK/relationship fields.

Note: DeviceUpdateService.validate_update_data silently drops ``None`` values
(it treats them as "no change"), so we call ``NautobotService.rest_request``
directly here to ensure the ``null`` values are actually transmitted.

Usage
-----
    # Preview without making any changes
    python clear_racks.py --dry-run

    # Process only devices whose name contains "router"
    python clear_racks.py --devices router --dry-run

    # Clear rack config for all matching devices
    python clear_racks.py --devices router

    # Clear rack config for ALL devices that have a rack assigned
    python clear_racks.py
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Add backend root to sys.path so all backend modules resolve correctly
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from services.nautobot.client import NautobotService  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GraphQL queries
# Variables are used for user-supplied values to avoid GraphQL injection.
# ---------------------------------------------------------------------------
_DEVICES_QUERY_FILTERED = """
query ($nameFilter: [String]!) {
  devices(name__ic: $nameFilter) {
    id
    name
    rack { id name }
    face
    position
  }
}
"""

# rack__isnull pushes the filter server-side to avoid a full-table scan.
_DEVICES_QUERY_ALL = """
{
  devices(rack__isnull: false) {
    id
    name
    rack { id name }
    face
    position
  }
}
"""


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


async def run(
    devices_filter: str | None,
    dry_run: bool,
    verbose: bool,
) -> int:
    """Fetch devices, filter to those with a rack assigned, clear rack config.

    Returns 0 on full success, 1 if any update failed.
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    nb = NautobotService()
    await nb.startup()

    try:
        return await _run(nb, devices_filter=devices_filter, dry_run=dry_run)
    finally:
        await nb.shutdown()


async def _run(
    nb: NautobotService,
    devices_filter: str | None,
    dry_run: bool,
) -> int:
    # ------------------------------------------------------------------
    # Fetch devices
    # ------------------------------------------------------------------
    logger.info("Fetching devices from Nautobot…")

    if devices_filter:
        result = await nb.graphql_query(
            _DEVICES_QUERY_FILTERED,
            variables={"nameFilter": devices_filter},
        )
    else:
        result = await nb.graphql_query(_DEVICES_QUERY_ALL)

    all_devices: list[dict[str, Any]] = result.get("data", {}).get("devices", [])
    logger.info("Fetched %d device(s) total.", len(all_devices))

    # ------------------------------------------------------------------
    # Keep only devices that actually have a rack assigned.
    # The all-devices query already filters server-side; this guards
    # against unexpected nulls in the filtered query path.
    # ------------------------------------------------------------------
    targets = [d for d in all_devices if d.get("rack")]
    logger.info("%d device(s) have a rack assigned.", len(targets))

    if not targets:
        print("No devices with rack configuration found.")
        return 0

    # ------------------------------------------------------------------
    # Display / update
    # ------------------------------------------------------------------
    prefix = "[DRY RUN] Would clear" if dry_run else "Clearing"
    print(f"{prefix} rack config for {len(targets)} device(s):")

    failed = 0
    for device in targets:
        rack_name = device["rack"]["name"]
        face = device.get("face")
        position = device.get("position")

        parts = [f"rack={rack_name}"]
        if face:
            parts.append(f"face={face}")
        if position is not None:
            parts.append(f"position={position}")

        print(f"  {device['name']}  ({', '.join(parts)})")

        if not dry_run:
            try:
                await nb.rest_request(
                    endpoint=f"dcim/devices/{device['id']}/",
                    method="PATCH",
                    # None is serialised as JSON null — the correct way to
                    # clear optional FK/relationship fields in Nautobot.
                    data={"rack": None, "face": None, "position": None},
                )
                logger.info(
                    "Cleared rack config for device %s (%s)",
                    device["name"],
                    device["id"],
                )
            except Exception as exc:
                print(f"  ERROR: Failed to update {device['name']}: {exc}")
                logger.error(
                    "Failed to clear rack config for %s: %s",
                    device["name"],
                    exc,
                    exc_info=True,
                )
                failed += 1

    if dry_run:
        print("\n[DRY RUN] No changes made. Re-run without --dry-run to apply.")
    else:
        success = len(targets) - failed
        print(f"\nDone: {success} updated, {failed} failed.")

    return 1 if failed else 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clear rack configuration (rack, face, position) from Nautobot devices.",
    )
    parser.add_argument(
        "--devices",
        metavar="FILTER",
        default=None,
        help=(
            "Case-insensitive substring filter on device name. "
            "Only devices whose name contains FILTER are processed. "
            "Omit to process all devices."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which devices would be processed without making any changes.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose (INFO-level) logging.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    exit_code = asyncio.run(
        run(
            devices_filter=args.devices,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
