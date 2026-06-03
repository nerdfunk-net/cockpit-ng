#!/usr/bin/env python3
"""Export per-device tag/status schedule from golden baseline YAML."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze golden baseline tag/status schedule")
    parser.add_argument(
        "--golden",
        type=Path,
        default=REPO_ROOT / "backend/tests/baseline.yaml",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "data/baseline/pytest_tag_schedule.json",
    )
    args = parser.parse_args()

    golden = yaml.safe_load(args.golden.read_text(encoding="utf-8"))
    schedule = []
    for device in golden.get("devices", []):
        schedule.append(
            {
                "name": device["name"],
                "location": device.get("location"),
                "tag": (device.get("tags") or [None])[0],
                "status": device.get("status"),
                "role": (device.get("roles") or [device.get("role")])[0],
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(schedule, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(schedule)} device entries to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
