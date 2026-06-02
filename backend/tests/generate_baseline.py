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


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate test baseline YAML")
    parser.add_argument("--name", default="baseline", help="Output filename (without .yaml)")
    parser.add_argument("--locations", type=int, default=3)
    parser.add_argument("--network", type=int, default=100)
    parser.add_argument("--servers", type=int, default=20)
    parser.add_argument("--vms", type=int, default=0)
    parser.add_argument("--clusters", type=int, default=1)
    args = parser.parse_args()

    request = CreateBaselineRequest(
        name=args.name,
        number_of_locations=args.locations,
        number_of_network_devices=args.network,
        number_of_servers=args.servers,
        number_of_virtual_machines=args.vms,
        number_of_clusters=args.clusters,
    )
    result = generate_baseline_file(request)
    print(f"Wrote {result.path}")
    print(
        f"  network={result.stats.network_devices}, "
        f"servers={result.stats.server_devices}, "
        f"vms={result.stats.virtual_machines}"
    )


if __name__ == "__main__":
    main()
