"""Unit tests for baseline YAML merge keys."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.unit


def test_merged_data_includes_virtualization_keys() -> None:
    """Document expected merge keys for virtualization support."""
    expected_keys = {
        "location_types",
        "location",
        "roles",
        "tags",
        "manufacturers",
        "platforms",
        "device_types",
        "prefixes",
        "custom_fields",
        "custom_field_choices",
        "cluster_types",
        "cluster_groups",
        "clusters",
        "devices",
        "virtual_machines",
    }
    sample_files = [
        {
            "devices": [{"name": "d1"}],
            "virtual_machines": [{"name": "vm1"}],
            "clusters": [{"name": "Cluster A", "cluster_type": "cluster-type"}],
            "cluster_groups": [{"name": "Default"}],
            "cluster_types": [{"name": "cluster-type", "slug": "cluster-type"}],
        }
    ]
    merged: dict = {
        "location_types": [],
        "location": [],
        "roles": [],
        "tags": [],
        "manufacturers": [],
        "platforms": [],
        "device_types": [],
        "prefixes": [],
        "custom_fields": {},
        "custom_field_choices": {},
        "cluster_types": [],
        "cluster_groups": [],
        "clusters": [],
        "devices": [],
        "virtual_machines": [],
    }
    for data in sample_files:
        for key in merged:
            if key in data and data[key]:
                if key in ["custom_fields", "custom_field_choices"]:
                    if isinstance(data[key], dict):
                        merged[key].update(data[key])
                else:
                    merged[key].extend(data[key])

    assert set(merged.keys()) == expected_keys
    assert len(merged["virtual_machines"]) == 1
    assert len(merged["clusters"]) == 1
    assert len(merged["cluster_groups"]) == 1
    assert len(merged["cluster_types"]) == 1
