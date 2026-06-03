#!/usr/bin/env python3
"""CLI wrapper to generate baseline YAML using BaselineGenerator."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running from backend/ or backend/tests/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models.tools import CreateBaselineRequest
from services.network.tools.baseline_generator import generate_baseline_file
from services.network.tools.baseline_profiles import profile_output_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate test baseline YAML")
    parser.add_argument("--name", default="baseline", help="Output filename (without .yaml)")
    parser.add_argument("--profile", help="Profile id (e.g. pytest, demo)")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory (default: profile suggested dir or data/baseline)",
    )
    parser.add_argument("--locations", type=int, help="Override number of locations")
    parser.add_argument("--network", type=int, help="Override network device count")
    parser.add_argument("--servers", type=int, help="Override server count")
    parser.add_argument("--vms", type=int, help="Override VM count")
    parser.add_argument("--clusters", type=int, help="Override cluster count")
    args = parser.parse_args()

    overrides: dict = {"name": args.name}
    if args.profile:
        overrides["profile"] = args.profile
    if args.locations is not None:
        overrides["number_of_locations"] = args.locations
    if args.network is not None:
        overrides["number_of_network_devices"] = args.network
    if args.servers is not None:
        overrides["number_of_servers"] = args.servers
    if args.vms is not None:
        overrides["number_of_virtual_machines"] = args.vms
    if args.clusters is not None:
        overrides["number_of_clusters"] = args.clusters

    request = CreateBaselineRequest(**overrides)

    output_dir = args.output
    if output_dir is None and args.profile:
        output_dir = profile_output_dir(args.profile)

    result = generate_baseline_file(request, output_dir=output_dir)
    print(f"Wrote {result.path}")
    if result.profile:
        print(f"  profile={result.profile}")
    if result.warnings:
        for warning in result.warnings:
            print(f"  warning: {warning}")
    print(
        f"  network={result.stats.network_devices}, "
        f"servers={result.stats.server_devices}, "
        f"vms={result.stats.virtual_machines}"
    )


if __name__ == "__main__":
    main()
