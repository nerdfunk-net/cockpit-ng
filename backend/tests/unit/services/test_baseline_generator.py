"""Unit tests for baseline YAML generation."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

pytestmark = pytest.mark.unit

from models.tools import (
    CreateBaselineRequest,
    DistributionConfig,
    LocationDistributionRow,
)
from services.network.tools.baseline_generator import (
    PYTEST_CITY_ORDER,
    IpAllocator,
    UniqueIpAllocator,
    allocate_ips_pytest,
    apply_golden_metadata,
    assign_locations,
    assign_sequential_name,
    build_default_metadata,
    build_devices_pytest,
    build_location_types,
    build_locations,
    build_pytest_locations,
    cluster_label,
    compute_stats,
    generate_baseline_dict,
    generate_baseline_file,
    generate_pytest_legacy_dict,
    get_output_directory,
    load_golden_baseline,
    location_label,
    merge_custom_field_values,
    name_for_ip,
    network_role_match,
    parse_comma_list,
    parse_custom_fields,
    parse_hierarchy,
    resolve_golden_path,
    validate_manual_distribution,
    write_yaml_with_blank_lines,
)


def test_parse_comma_list_strips_empty() -> None:
    assert parse_comma_list("a, , b") == ["a", "b"]


def test_cluster_label() -> None:
    assert cluster_label(0) == "Cluster A"


def test_get_output_directory_exists() -> None:
    assert get_output_directory().name == "baseline"


def test_ip_allocator_returns_host_ips() -> None:
    allocator = IpAllocator(["192.168.1.0/30"])
    ip = allocator.next_ip(0)
    assert ip.startswith("192.168.1.")


def test_unique_ip_allocator_skips_reserved_octets() -> None:
    allocator = UniqueIpAllocator(["10.0.0.0/24"], reserved_host_octets={254})
    ips = {allocator.next_ip(0).split("/")[0] for _ in range(5)}
    assert all(not ip.endswith(".254") for ip in ips)
    assert len(ips) == 5


def test_parse_hierarchy_empty_raises() -> None:
    with pytest.raises(ValueError, match="at least one"):
        parse_hierarchy("   ")


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


def test_build_location_types_adds_parent_chain() -> None:
    types = build_location_types(["Country", "State", "City"])
    assert len(types) == 3
    assert types[1]["parent"] == "Country"
    assert "virtualization.cluster" in types[-1]["content_types"]


def test_build_locations_single_level_hierarchy() -> None:
    locations, leaf_names = build_locations(["Site"], leaf_count=2)
    assert len(leaf_names) == 2
    assert locations[0]["location_types"] == "Site"
    assert locations[0]["parent"] is None


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


def test_build_pytest_locations_has_six_cities() -> None:
    _locations, leaves = build_pytest_locations()
    assert leaves == [
        "City A",
        "Another City A",
        "City B",
        "Another City B",
        "City C",
        "Another City C",
    ]


def test_assign_sequential_name() -> None:
    request = CreateBaselineRequest(
        name="t",
        naming_scheme="sequential",
        network_device_prefix="lab",
        network_device_index_width=3,
        server_device_prefix="server",
        server_device_index_width=2,
    )
    assert assign_sequential_name("network", 1, request) == "lab-001"
    assert assign_sequential_name("server", 20, request) == "server-20"


def test_build_default_metadata_includes_roles_and_tags() -> None:
    meta = build_default_metadata(["lab"], "net", "srv", "vm")
    assert len(meta["roles"]) == 3
    assert meta["tags"][0]["name"] == "lab"
    assert meta["manufacturers"]


def test_allocate_ips_pytest_assigns_network_interfaces() -> None:
    devices = [
        {"name": "r1", "device_type": "networkA"},
        {"name": "s1", "device_type": "serverA"},
    ]
    allocate_ips_pytest(devices, ["10.0.0.0/24"])
    assert devices[0]["primary_ip4"].startswith("10.0.0.")
    assert len(devices[0]["interfaces"]) == 2
    assert devices[1]["primary_ip4"].startswith("10.0.0.")


def test_apply_golden_metadata_copies_fields(tmp_path) -> None:
    golden = tmp_path / "golden.yaml"
    golden.write_text(
        yaml.dump(
            {
                "devices": [
                    {
                        "name": "lab-001",
                        "location": "Site A",
                        "tags": ["prod"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    devices = [{"name": "lab-001"}]
    apply_golden_metadata(devices, golden)
    assert devices[0]["location"] == "Site A"
    assert devices[0]["tags"] == ["prod"]


def test_resolve_golden_path_relative_to_repo(tmp_path) -> None:
    golden = tmp_path / "ref.yaml"
    golden.write_text("devices: []\n", encoding="utf-8")
    request = CreateBaselineRequest(
        name="t",
        metadata_mode="golden_parity",
        golden_reference_path=str(golden.relative_to(tmp_path)),
    )
    with patch(
        "services.network.tools.baseline_generator.REPO_ROOT",
        tmp_path,
    ):
        path = resolve_golden_path(request)
    assert path == golden.resolve()


def test_merge_custom_field_values_merges_template() -> None:
    import random

    rng = random.Random(42)
    result = merge_custom_field_values({"net": "netA"}, "Site A", rng)
    assert result["net"] == "netA"
    assert "checkmk_site" in result
    assert "Site A" in result["free_textfield"]


def test_network_role_match() -> None:
    assert network_role_match({"device_type": "networkA"}, "Server") is True
    assert network_role_match({"device_type": "serverA"}, "Network") is True
    assert network_role_match({"device_type": "serverA"}, "Server") is False


def test_compute_stats_counts_devices() -> None:
    baseline = {
        "devices": [
            {
                "location": "A",
                "device_type": "networkA",
                "roles": ["Network"],
                "tags": ["lab"],
                "status": "Active",
            },
            {
                "location": "B",
                "device_type": "serverA",
                "role": "Server",
                "tags": ["lab"],
                "status": "Offline",
            },
        ],
        "virtual_machines": [{"tags": ["lab"], "status": "Active"}],
        "clusters": [{}],
    }
    stats = compute_stats(baseline)
    assert stats.network_devices == 1
    assert stats.server_devices == 1
    assert stats.virtual_machines == 1
    assert stats.clusters == 1
    assert stats.locations["A"] == 1


def test_load_golden_baseline_reads_file(tmp_path) -> None:
    golden = tmp_path / "golden.yaml"
    golden.write_text("devices:\n  - name: r1\n", encoding="utf-8")
    request = CreateBaselineRequest(
        name="t",
        metadata_mode="golden_parity",
        golden_reference_path=str(golden),
    )
    with patch(
        "services.network.tools.baseline_generator.REPO_ROOT",
        tmp_path,
    ):
        data = load_golden_baseline(request)
    assert data["devices"][0]["name"] == "r1"


def _pytest_manual_distribution() -> DistributionConfig:
    return DistributionConfig(
        mode="manual",
        by_location=[
            LocationDistributionRow(location=city, network=1, server=0, vm=0)
            for city in PYTEST_CITY_ORDER
        ],
    )


def test_build_devices_pytest_sequential_names() -> None:
    request = CreateBaselineRequest(
        name="pytest",
        layout="pytest_legacy",
        number_of_locations=6,
        number_of_network_devices=6,
        number_of_servers=0,
        number_of_virtual_machines=0,
        distribution=_pytest_manual_distribution(),
    )
    devices = build_devices_pytest(request)
    assert len(devices) == 6
    assert devices[0]["name"] == "lab-001"


def test_generate_pytest_legacy_dict_structure() -> None:
    request = CreateBaselineRequest(
        name="pytest",
        layout="pytest_legacy",
        number_of_locations=6,
        number_of_network_devices=6,
        number_of_servers=0,
        number_of_virtual_machines=0,
        number_of_clusters=0,
        distribution=_pytest_manual_distribution(),
    )
    data = generate_pytest_legacy_dict(request)
    assert len(data["devices"]) == 6
    assert data["devices"][0]["primary_ip4"]


def test_generate_baseline_dict_uses_pytest_layout() -> None:
    request = CreateBaselineRequest(
        name="pytest",
        layout="pytest_legacy",
        number_of_locations=6,
        number_of_network_devices=6,
        number_of_servers=0,
        number_of_virtual_machines=0,
        distribution=_pytest_manual_distribution(),
    )
    data = generate_baseline_dict(request)
    assert len(data["devices"]) == 6


def test_assign_locations_manual_count_mismatch_raises() -> None:
    leaves = ["Location A"]
    config = DistributionConfig(
        mode="manual",
        by_location=[LocationDistributionRow(location="Location A", network=1)],
    )
    with pytest.raises(ValueError, match="expected 3"):
        assign_locations(3, leaves, config, "network")


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


def test_write_yaml_with_blank_lines_writes_stats_header(tmp_path: Path) -> None:
    baseline = {
        "devices": [{"name": "r1", "location": "A"}],
        "tags": [{"name": "lab"}],
    }
    stats = {
        "total_devices": 1,
        "network_devices": 1,
        "server_devices": 0,
        "virtual_machines": 0,
        "locations": {"A": 1},
        "tags": {"lab": 1},
        "statuses": {"Active": 1},
    }
    out = tmp_path / "out.yaml"
    write_yaml_with_blank_lines(baseline, out, stats)
    text = out.read_text(encoding="utf-8")
    assert "Total Devices: 1" in text
    assert "devices:" in text
    assert "- name: r1" in text


def test_generate_baseline_dict_includes_virtual_machines() -> None:
    request = CreateBaselineRequest(
        name="vmtest",
        number_of_locations=2,
        number_of_network_devices=2,
        number_of_servers=0,
        number_of_virtual_machines=2,
        number_of_clusters=2,
    )
    data = generate_baseline_dict(request)
    assert len(data["virtual_machines"]) == 2
    assert len(data["clusters"]) == 2
    assert data["cluster_types"][0]["name"] == "cluster-type"
