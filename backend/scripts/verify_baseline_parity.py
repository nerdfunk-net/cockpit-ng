#!/usr/bin/env python3
"""Verify generated baseline YAML matches golden metadata (not IPs)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from services.network.tools.baseline_generator import compute_stats  # noqa: E402

EXPECTED_TOTALS = {
    "total_devices": 120,
    "network_devices": 100,
    "server_devices": 20,
    "tags": {"Production": 39, "Staging": 52, "lab": 29},
    "statuses": {"Active": 66, "Offline": 54},
}

METADATA_KEYS = (
    "name",
    "location",
    "status",
    "tags",
    "roles",
    "device_type",
    "platform",
)


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def check_stats(generated: dict, errors: list[str]) -> None:
    stats = compute_stats(generated)
    if stats.total_devices != EXPECTED_TOTALS["total_devices"]:
        errors.append(
            f"total_devices: expected {EXPECTED_TOTALS['total_devices']}, "
            f"got {stats.total_devices}"
        )
    if stats.network_devices != EXPECTED_TOTALS["network_devices"]:
        errors.append(
            f"network_devices: expected {EXPECTED_TOTALS['network_devices']}, "
            f"got {stats.network_devices}"
        )
    if stats.server_devices != EXPECTED_TOTALS["server_devices"]:
        errors.append(
            f"server_devices: expected {EXPECTED_TOTALS['server_devices']}, "
            f"got {stats.server_devices}"
        )
    for tag, count in EXPECTED_TOTALS["tags"].items():
        if stats.tags.get(tag) != count:
            errors.append(f"tag {tag}: expected {count}, got {stats.tags.get(tag, 0)}")
    for status, count in EXPECTED_TOTALS["statuses"].items():
        if stats.statuses.get(status) != count:
            errors.append(
                f"status {status}: expected {count}, got {stats.statuses.get(status, 0)}"
            )


def check_unique_ips(generated: dict, errors: list[str]) -> None:
    primaries = [
        device.get("primary_ip4", "").split("/")[0]
        for device in generated.get("devices", [])
    ]
    if len(primaries) != len(set(primaries)):
        errors.append("duplicate primary_ip4 values found in generated baseline")


def check_full_metadata(generated: dict, golden: dict, errors: list[str]) -> None:
    golden_by_name = {d["name"]: d for d in golden.get("devices", [])}
    for device in generated.get("devices", []):
        name = device["name"]
        golden_device = golden_by_name.get(name)
        if not golden_device:
            errors.append(f"device {name} missing from golden baseline")
            continue
        for key in METADATA_KEYS:
            if device.get(key) != golden_device.get(key):
                errors.append(
                    f"{name}.{key}: generated {device.get(key)!r} != "
                    f"golden {golden_device.get(key)!r}"
                )


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify pytest baseline parity")
    parser.add_argument(
        "--generated",
        type=Path,
        default=REPO_ROOT / "contributing-data/tests_baseline/baseline.yaml",
    )
    parser.add_argument(
        "--golden",
        type=Path,
        default=REPO_ROOT / "backend/tests/baseline.golden.yaml",
    )
    parser.add_argument(
        "--mode",
        choices=("stats", "full"),
        default="full",
    )
    args = parser.parse_args()

    errors: list[str] = []
    generated = load_yaml(args.generated)
    check_stats(generated, errors)
    check_unique_ips(generated, errors)

    if args.mode == "full":
        golden = load_yaml(args.golden)
        check_full_metadata(generated, golden, errors)

    if errors:
        for err in errors:
            print(f"FAIL: {err}", file=sys.stderr)
        return 1

    print(f"OK: {args.generated} passes parity checks ({args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
