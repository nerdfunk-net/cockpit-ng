#!/usr/bin/env python3
"""Create Nautobot Virtual Chassis for device groups sharing the same base name.

Devices produced by split_serial_devices.py follow the naming scheme:
    fritz.box        → base device (master)
    fritz:2.box      → second member
    fritz:3.box      → third member

This script fetches devices from Nautobot, groups them by their canonical base
name, and for every group with two or more members it:

  1. Creates a Virtual Chassis named after the canonical (master) device name
  2. Assigns the master device at vc_position=1
  3. Assigns each additional member at vc_position=2, 3, …
  4. Sets the master field on the Virtual Chassis

Only devices whose hostname part (before the first '.') contains ':N' are
treated as secondary members; the device *without* ':N' is the master.

Usage
-----
    # Preview without making any changes
    python create_virtual_chassis.py --dry-run

    # Process only devices whose name contains "fritz"
    python create_virtual_chassis.py --filter fritz

    # Run for real with verbose output
    python create_virtual_chassis.py --verbose
"""

from __future__ import annotations

import asyncio
import argparse
import sys
import logging
from collections import defaultdict
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
# GraphQL query – only id and name are needed
# ---------------------------------------------------------------------------
_DEVICES_QUERY = """
{
  devices {
    id
    name
  }
}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _group_key(device_name: str) -> str:
    """Return the canonical group key for a device name.

    The group key is the full device name with any ':N' suffix stripped from
    the hostname part (before the first '.').

    Examples:
        fritz.box   → "fritz.box"
        fritz:2.box → "fritz.box"
        fritz:3.box → "fritz.box"
        router      → "router"
        router:2    → "router"
    """
    hostname, dot, domain = device_name.partition(".")
    base_hostname = hostname.split(":")[0]
    return f"{base_hostname}{dot}{domain}" if dot else base_hostname


def _is_master(device_name: str) -> bool:
    """Return True if this device has no ':N' suffix and is the primary member."""
    hostname = device_name.partition(".")[0]
    return ":" not in hostname


def _member_position(device_name: str) -> int:
    """Return the numeric position encoded in the device name (e.g. fritz:3.box → 3).

    Falls back to 1 for master devices (no ':N' suffix).
    """
    hostname = device_name.partition(".")[0]
    if ":" in hostname:
        try:
            return int(hostname.split(":")[1])
        except (IndexError, ValueError):
            pass
    return 1


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

async def run(
    name_filter: str | None,
    dry_run: bool,
    verbose: bool,
) -> int:
    """Fetch devices, group by base name, create Virtual Chassis.

    Returns 0 on full success, 1 if any creation failed.
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    nb = NautobotService()
    await nb.startup()

    try:
        return await _run(nb, name_filter=name_filter, dry_run=dry_run, verbose=verbose)
    finally:
        await nb.shutdown()


async def _run(
    nb: NautobotService,
    name_filter: str | None,
    dry_run: bool,
    verbose: bool,
) -> int:
    # ------------------------------------------------------------------
    # Fetch devices
    # ------------------------------------------------------------------
    logger.info("Fetching devices from Nautobot…")
    result = await nb.graphql_query(_DEVICES_QUERY)
    devices: list[dict[str, Any]] = result.get("data", {}).get("devices", [])
    logger.info("Fetched %d device(s) total.", len(devices))

    # ------------------------------------------------------------------
    # Optional name filter
    # ------------------------------------------------------------------
    if name_filter:
        needle = name_filter.lower()
        devices = [d for d in devices if needle in (d.get("name") or "").lower()]
        logger.info("After filter '%s': %d device(s) remain.", name_filter, len(devices))

    # ------------------------------------------------------------------
    # Group by canonical base name
    # ------------------------------------------------------------------
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for device in devices:
        name = device.get("name") or ""
        groups[_group_key(name)].append(device)

    had_error = False

    for canon_name, members in sorted(groups.items()):
        if len(members) < 2:
            if verbose:
                print(f"SKIP  {canon_name}  (only {len(members)} device)")
            continue

        # Sort members: master first, then by position number
        members.sort(key=lambda d: _member_position(d.get("name") or ""))

        master = next(
            (d for d in members if _is_master(d.get("name") or "")),
            members[0],
        )
        others = [d for d in members if d["id"] != master["id"]]

        member_names = ", ".join(d["name"] for d in members)
        print(
            f"FOUND {canon_name}  ({len(members)} members: {member_names})"
        )

        if dry_run:
            print(
                f"  [DRY RUN] Would create VC '{canon_name}'"
                f"  master={master['name']}"
            )
            continue

        try:
            # 1. Create the Virtual Chassis (no master yet – device must be
            #    assigned to the VC before it can be set as master)
            vc = await nb.rest_request(
                endpoint="dcim/virtual-chassis/",
                method="POST",
                data={"name": canon_name},
            )
            vc_id: str = vc["id"]
            print(f"  Created VC '{canon_name}'  (id: {vc_id})")

            # 2. Assign master at position 1
            await nb.rest_request(
                endpoint=f"dcim/devices/{master['id']}/",
                method="PATCH",
                data={"virtual_chassis": vc_id, "vc_position": 1},
            )
            print(f"  Assigned master: {master['name']}  (position 1)")

            # 3. Assign remaining members at positions 2, 3, …
            for pos, device in enumerate(others, start=2):
                await nb.rest_request(
                    endpoint=f"dcim/devices/{device['id']}/",
                    method="PATCH",
                    data={"virtual_chassis": vc_id, "vc_position": pos},
                )
                print(f"  Assigned member: {device['name']}  (position {pos})")

            # 4. Set the master field on the VC now that the device is a member
            await nb.rest_request(
                endpoint=f"dcim/virtual-chassis/{vc_id}/",
                method="PATCH",
                data={"master": master["id"]},
            )
            print(f"  Set VC master to {master['name']}")

        except Exception as exc:  # noqa: BLE001
            print(
                f"  ERROR processing '{canon_name}': {exc}",
                file=sys.stderr,
            )
            had_error = True

    return 1 if had_error else 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Create Nautobot Virtual Chassis for groups of devices that share "
            "a base hostname (e.g. fritz.box + fritz:2.box → one VC)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--filter",
        "--name",
        dest="name_filter",
        metavar="PATTERN",
        default=None,
        help=(
            "Only process devices whose name contains PATTERN "
            "(case-insensitive substring match)."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without making any API calls.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Also print groups that are skipped (single device).",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(
        run(
            name_filter=args.name_filter,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
