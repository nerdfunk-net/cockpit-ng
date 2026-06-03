#!/usr/bin/env python3
"""
Print expected inventory filter counts from baseline YAML (in-Python simulation).

Use --write-manifest to refresh tests/fixtures/baseline_manifest.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from tests.fixtures.baseline_inventory_filter_cases import (  # noqa: E402
    BASELINE_FILTER_TREES,
)
from tests.fixtures.baseline_manifest import (  # noqa: E402
    build_manifest_from_yaml,
    load_baseline_yaml,
    manifest_to_dict,
    resolve_baseline_yaml_path,
    write_manifest_json,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compute expected baseline inventory filter counts from YAML"
    )
    parser.add_argument(
        "--yaml",
        type=Path,
        default=None,
        help="Baseline YAML path (default: contributing-data/tests_baseline/baseline.yaml)",
    )
    parser.add_argument(
        "--filter",
        help="Print count for a single filter id only",
    )
    parser.add_argument(
        "--write-manifest",
        action="store_true",
        help="Write tests/fixtures/baseline_manifest.json",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=BACKEND_ROOT / "tests/fixtures/baseline_manifest.json",
    )
    parser.add_argument("--json", action="store_true", help="Output full manifest JSON")
    args = parser.parse_args()

    yaml_path = args.yaml or resolve_baseline_yaml_path()
    data = load_baseline_yaml(yaml_path)
    manifest = build_manifest_from_yaml(
        data, BASELINE_FILTER_TREES, source_path=str(yaml_path)
    )

    if args.write_manifest:
        out = write_manifest_json(manifest, args.manifest)
        print(f"Wrote manifest to {out}")

    if args.json:
        print(json.dumps(manifest_to_dict(manifest), indent=2))
        return 0

    if args.filter:
        count = manifest.expected_count(args.filter)
        print(f"{args.filter}: {count}")
        return 0

    print(f"Source: {yaml_path}")
    print(f"Total devices: {manifest.total_devices}")
    print("Locations:")
    for name, count in sorted(manifest.locations.items()):
        print(f"  {name}: {count}")
    print("Tags:")
    for name, count in sorted(manifest.tags.items()):
        print(f"  {name}: {count}")
    print("Statuses:")
    for name, count in sorted(manifest.statuses.items()):
        print(f"  {name}: {count}")
    print("Filter counts:")
    for filter_id, count in sorted(manifest.filters.items()):
        print(f"  {filter_id}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
