"""Unit tests for baseline inventory filter simulation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.network.tools.baseline_inventory_simulator import (
    BaselineInventorySimulator,
)
from tests.fixtures.baseline_inventory_filter_cases import BASELINE_FILTER_TREES
from tests.fixtures.baseline_manifest import (
    build_manifest_from_yaml,
    load_baseline_manifest,
    load_baseline_yaml,
    resolve_baseline_yaml_path,
)

MANIFEST_JSON = Path(__file__).resolve().parents[2] / "fixtures/baseline_manifest.json"


@pytest.fixture(scope="module")
def baseline_yaml_data():
    return load_baseline_yaml()


@pytest.fixture(scope="module")
def simulator(baseline_yaml_data):
    return BaselineInventorySimulator.from_yaml(baseline_yaml_data)


def test_simulator_matches_committed_manifest(simulator) -> None:
    manifest = load_baseline_manifest()
    for filter_id, expected in manifest.filters.items():
        tree = BASELINE_FILTER_TREES[filter_id]
        actual = simulator.count_for_tree(tree)
        assert actual == expected, f"{filter_id}: manifest={expected}, simulated={actual}"


def test_build_manifest_matches_json_file(baseline_yaml_data) -> None:
    built = build_manifest_from_yaml(
        baseline_yaml_data, BASELINE_FILTER_TREES, source_path="test"
    )
    committed = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    assert built.filters == committed["filters"]
    assert built.stats.total_devices == committed["stats"]["total_devices"]


def test_city_a_location_count(simulator) -> None:
    count = simulator.count_for_tree(BASELINE_FILTER_TREES["filter_by_location_city_a"])
    assert count == 21


def test_empty_filter_returns_all_devices(simulator) -> None:
    count = simulator.count_for_tree(BASELINE_FILTER_TREES["empty_filter_returns_all"])
    assert count == 120


def test_baseline_yaml_exists() -> None:
    assert resolve_baseline_yaml_path().is_file()
