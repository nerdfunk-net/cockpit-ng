"""Unit tests for baseline YAML generation."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
import yaml

from models.tools import (
    CreateBaselineRequest,
    DistributionConfig,
    LocationDistributionRow,
)
from services.network.tools.baseline_generator import (
    assign_locations,
    generate_baseline_dict,
    generate_baseline_file,
    location_label,
    name_for_ip,
    parse_custom_fields,
    parse_hierarchy,
    validate_manual_distribution,
)


def test_location_label_sequence() -> None:
    assert location_label(0) == "Location A"
    assert location_label(1) == "Location B"
    assert location_label(25) == "Location Z"
    assert location_label(26) == "Location AA"


def test_name_for_ip() -> None:
    assert name_for_ip("lab", "192.168.178.1/24") == "lab-192-168-178-1"


def test_parse_hierarchy() -> None:
    assert parse_hierarchy("Country -> State -> City") == [
        "Country",
        "State",
        "City",
    ]


def test_parse_custom_fields() -> None:
    assert parse_custom_fields("net=netA, checkmk_site=siteB") == {
        "net": "netA",
        "checkmk_site": "siteB",
    }


def test_assign_locations_even() -> None:
    leaves = ["Location A", "Location B", "Location C"]
    result = assign_locations(6, leaves, DistributionConfig(mode="even"), "network")
    assert result == [
        "Location A",
        "Location B",
        "Location C",
        "Location A",
        "Location B",
        "Location C",
    ]


def test_assign_locations_random_is_reproducible() -> None:
    leaves = ["Location A", "Location B"]
    config = DistributionConfig(mode="random", seed=99)
    first = assign_locations(10, leaves, config, "network")
    second = assign_locations(10, leaves, config, "network")
    assert first == second


def test_manual_distribution_validation_fails_on_sum() -> None:
    leaves = ["Location A", "Location B"]
    config = DistributionConfig(
        mode="manual",
        by_location=[
            LocationDistributionRow(location="Location A", network=5),
            LocationDistributionRow(location="Location B", network=3),
        ],
    )
    with pytest.raises(ValueError, match="expected 10"):
        validate_manual_distribution(config, leaves, 10, 0, 0)


def test_generate_baseline_dict_structure() -> None:
    request = CreateBaselineRequest(
        name="testbaseline",
        number_of_locations=2,
        number_of_network_devices=4,
        number_of_servers=2,
        number_of_virtual_machines=2,
        number_of_clusters=2,
    )
    data = generate_baseline_dict(request)
    assert len(data["devices"]) == 6
    assert len(data["virtual_machines"]) == 2
    assert len(data["clusters"]) == 2
    assert len(data["cluster_types"]) == 1
    assert data["cluster_types"][0]["name"] == "cluster-type"
    assert data["clusters"][0]["cluster_type"] == "cluster-type"
    assert set(data["tags"][0]["content_types"]) == {
        "dcim.device",
        "virtualization.virtualmachine",
        "virtualization.cluster",
    }
    assert data["devices"][0]["name"].startswith("lab-192-168")


def test_generate_baseline_file_writes_valid_yaml() -> None:
    request = CreateBaselineRequest(
        name="small",
        number_of_locations=1,
        number_of_network_devices=1,
        number_of_servers=0,
        number_of_virtual_machines=0,
        number_of_clusters=0,
    )
    with tempfile.TemporaryDirectory() as tmp:
        response = generate_baseline_file(request, output_dir=Path(tmp))
        path = Path(response.path)
        assert path.exists()
        loaded = yaml.safe_load(path.read_text())
        assert loaded["devices"]
        assert response.stats.network_devices == 1
