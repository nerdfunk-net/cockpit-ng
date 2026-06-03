"""Baseline manifest types and loaders for integration tests."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

from models.tools import BaselineStats
from services.network.tools.baseline_generator import compute_stats
from services.network.tools.baseline_inventory_simulator import (
    BaselineInventorySimulator,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_BASELINE_YAML = REPO_ROOT / "contributing-data/tests_baseline/baseline.yaml"
DEFAULT_MANIFEST_JSON = Path(__file__).resolve().parent / "baseline_manifest.json"


@dataclass(frozen=True)
class BaselineManifest:
    """Expected counts and stats derived from canonical baseline YAML."""

    stats: BaselineStats
    filters: Dict[str, int]
    source_path: str

    @property
    def locations(self) -> Dict[str, int]:
        return self.stats.locations

    @property
    def tags(self) -> Dict[str, int]:
        return self.stats.tags

    @property
    def statuses(self) -> Dict[str, int]:
        return self.stats.statuses

    @property
    def total_devices(self) -> int:
        return self.stats.total_devices

    def expected_count(self, filter_id: str) -> int:
        if filter_id not in self.filters:
            raise KeyError(f"Unknown baseline filter id: {filter_id}")
        return self.filters[filter_id]

    def assert_device_count(
        self, devices: list, filter_id: str, *, label: Optional[str] = None
    ) -> None:
        expected = self.expected_count(filter_id)
        actual = len(devices)
        name = label or filter_id
        assert actual == expected, (
            f"{name}: expected {expected} devices from manifest, found {actual}"
        )


def resolve_baseline_yaml_path() -> Path:
    env_path = os.environ.get("BASELINE_YAML")
    if env_path:
        path = Path(env_path)
        return path if path.is_absolute() else REPO_ROOT / path
    return DEFAULT_BASELINE_YAML


def load_baseline_yaml(path: Optional[Path] = None) -> Dict[str, Any]:
    yaml_path = path or resolve_baseline_yaml_path()
    return yaml.safe_load(yaml_path.read_text(encoding="utf-8"))


def build_manifest_from_yaml(
    data: Dict[str, Any],
    filter_trees: Dict[str, Dict[str, Any]],
    source_path: str = "",
) -> BaselineManifest:
    stats = compute_stats(data)
    simulator = BaselineInventorySimulator.from_yaml(data)
    filter_counts = {
        filter_id: simulator.count_for_tree(tree)
        for filter_id, tree in filter_trees.items()
    }
    return BaselineManifest(
        stats=stats,
        filters=filter_counts,
        source_path=source_path,
    )


def manifest_to_dict(manifest: BaselineManifest) -> Dict[str, Any]:
    return {
        "source": manifest.source_path,
        "stats": {
            "total_devices": manifest.stats.total_devices,
            "network_devices": manifest.stats.network_devices,
            "server_devices": manifest.stats.server_devices,
            "virtual_machines": manifest.stats.virtual_machines,
            "clusters": manifest.stats.clusters,
            "locations": manifest.stats.locations,
            "tags": manifest.stats.tags,
            "statuses": manifest.stats.statuses,
        },
        "filters": manifest.filters,
    }


def write_manifest_json(
    manifest: BaselineManifest, path: Path = DEFAULT_MANIFEST_JSON
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest_to_dict(manifest), indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def load_manifest_json(path: Path = DEFAULT_MANIFEST_JSON) -> BaselineManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    stats_raw = raw["stats"]
    stats = BaselineStats(
        total_devices=stats_raw["total_devices"],
        network_devices=stats_raw["network_devices"],
        server_devices=stats_raw["server_devices"],
        virtual_machines=stats_raw["virtual_machines"],
        clusters=stats_raw.get("clusters", 0),
        locations=stats_raw.get("locations", {}),
        tags=stats_raw.get("tags", {}),
        statuses=stats_raw.get("statuses", {}),
    )
    return BaselineManifest(
        stats=stats,
        filters=raw.get("filters", {}),
        source_path=raw.get("source", ""),
    )


def load_baseline_manifest(
    *,
    yaml_path: Optional[Path] = None,
    manifest_path: Optional[Path] = None,
    rebuild: bool = False,
) -> BaselineManifest:
    """Load manifest from JSON, optionally rebuilding from YAML + filter cases."""
    json_path = manifest_path or DEFAULT_MANIFEST_JSON
    if rebuild or not json_path.is_file():
        from tests.fixtures.baseline_inventory_filter_cases import (
            BASELINE_FILTER_TREES,
        )

        path = yaml_path or resolve_baseline_yaml_path()
        data = load_baseline_yaml(path)
        manifest = build_manifest_from_yaml(
            data, BASELINE_FILTER_TREES, source_path=str(path)
        )
        write_manifest_json(manifest, json_path)
        return manifest
    return load_manifest_json(json_path)
