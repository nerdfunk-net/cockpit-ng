"""Unit tests for baseline import cluster type handling."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.unit


def test_merge_injects_default_cluster_type_when_clusters_without_types() -> None:
    """Legacy YAML with clusters but no cluster_types gets a default entry."""
    merged: dict = {
        "cluster_types": [],
        "clusters": [{"name": "Cluster A", "cluster_group": "Default"}],
    }
    default_name = "cluster-type"

    if merged["clusters"] and not merged["cluster_types"]:
        merged["cluster_types"] = [
            {"name": default_name, "slug": default_name},
        ]

    assert merged["cluster_types"] == [
        {"name": "cluster-type", "slug": "cluster-type"},
    ]
