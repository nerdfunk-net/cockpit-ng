#!/usr/bin/env python3
"""Split Nautobot devices that carry multiple comma-separated serial numbers.

For every device whose `serial` field contains more than one value (comma-
separated), this script creates a copy in Nautobot for each extra serial:

    fritz.box  serial="12345,67890"
      → creates fritz.box:2  serial="67890"

The original device is left untouched.  The copies carry the same role,
status, location, device_type, custom_fields, and tags as the original.
Interfaces and IP addresses are NOT copied.

Usage
-----
    # Preview without making any changes
    python split_serial_devices.py --dry-run

    # Process only devices whose name contains "fritz"
    python split_serial_devices.py --filter fritz

    # Run for real with verbose output
    python split_serial_devices.py --verbose
"""

from __future__ import annotations

import asyncio
import argparse
import sys
import logging
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Add backend root to sys.path so all backend modules resolve correctly
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.nautobot import AddDeviceRequest  # noqa: E402
from services.nautobot.devices.creation import DeviceCreationService  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GraphQL query
# ---------------------------------------------------------------------------
_DEVICES_QUERY = """
{
  devices {
    name
    role {
      id
      name
    }
    status {
      id
      name
    }
    location {
      id
      name
    }
    device_type {
      id
      manufacturer {
        id
        name
      }
      model
    }
    _custom_field_data
    tags {
      id
      name
    }
    rack {
      id
      name
    }
    face
    serial
  }
}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_serials(serial_field: str | None) -> list[str]:
    """Return a list of stripped serial numbers from a raw field value."""
    if not serial_field:
        return []
    return [s.strip() for s in serial_field.split(",") if s.strip()]


def _build_request(
    device: dict[str, Any],
    new_name: str,
    serial: str,
    dry_run: bool,
) -> AddDeviceRequest:
    """Build an AddDeviceRequest for a copy of *device* with a single serial."""
    # Drop None values — Nautobot returns null for unset custom fields,
    # but AddDeviceRequest expects dict[str, str]
    custom_fields = {
        k: v
        for k, v in (device.get("_custom_field_data") or {}).items()
        if v is not None
    }
    tags = [t["id"] for t in (device.get("tags") or [])]

    rack = device.get("rack") or {}
    return AddDeviceRequest(
        name=new_name,
        device_type=device["device_type"]["id"],
        role=device["role"]["id"],
        location=device["location"]["id"],
        status=device["status"]["id"],
        serial=serial,
        custom_fields=custom_fields or None,
        tags=tags or None,
        rack=rack.get("id") or None,
        face=device.get("face") or None,
        interfaces=[],
        add_prefix=False,
        dry_run=dry_run,
    )


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

async def run(
    name_filter: str | None,
    dry_run: bool,
    verbose: bool,
) -> int:
    """Fetch devices, detect multi-serial entries, create copies.

    Returns 0 on full success, 1 if any creation failed.
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    creation_service = DeviceCreationService()

    # ------------------------------------------------------------------
    # Fetch all devices from Nautobot via GraphQL
    # ------------------------------------------------------------------
    logger.info("Fetching devices from Nautobot…")
    result = await creation_service._nb.graphql_query(_DEVICES_QUERY)

    devices: list[dict[str, Any]] = result.get("data", {}).get("devices", [])
    logger.info("Fetched %d device(s) total.", len(devices))

    # ------------------------------------------------------------------
    # Apply optional name filter (case-insensitive substring)
    # ------------------------------------------------------------------
    if name_filter:
        needle = name_filter.lower()
        devices = [d for d in devices if needle in (d.get("name") or "").lower()]
        logger.info(
            "After filter '%s': %d device(s) remain.", name_filter, len(devices)
        )

    # ------------------------------------------------------------------
    # Process each device
    # ------------------------------------------------------------------
    had_error = False

    for device in devices:
        device_name: str = device.get("name") or "<unnamed>"
        serials = _parse_serials(device.get("serial"))

        if len(serials) <= 1:
            if verbose:
                print(f"SKIP  {device_name}  (single or empty serial)")
            continue

        print(
            f"FOUND {device_name}  serial={device['serial']!r}"
            f"  → will create {len(serials) - 1} copy/copies"
        )

        # Create one copy per extra serial (index 1, 2, …)
        for idx, serial in enumerate(serials[1:], start=2):
            if "." in device_name:
                hostname, _, rest = device_name.partition(".")
                new_name = f"{hostname}:{idx}.{rest}"
            else:
                new_name = f"{device_name}:{idx}"
            request = _build_request(device, new_name, serial, dry_run)

            if dry_run:
                print(f"  [DRY RUN] Would create: {new_name}  (serial: {serial})")
                continue

            try:
                response = await creation_service.create_device_with_interfaces(request)
                if response.get("summary", {}).get("device_created"):
                    print(
                        f"  Created:  {new_name}"
                        f"  (id: {response.get('device_id', '?')}, serial: {serial})"
                    )
                else:
                    step = response.get("workflow_status", {}).get("step1_device", {})
                    print(
                        f"  ERROR creating {new_name}: {step.get('message', 'unknown error')}",
                        file=sys.stderr,
                    )
                    had_error = True
            except Exception as exc:  # noqa: BLE001
                print(
                    f"  ERROR creating {new_name}: {exc}",
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
            "Split Nautobot devices with multiple comma-separated serial numbers "
            "by creating a copy for each extra serial."
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
        help="Also print devices that are skipped (single serial).",
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
