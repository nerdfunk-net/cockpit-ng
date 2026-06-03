"""Unit tests for baseline tag content type handling."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.unit

from services.network.tools.baseline import (
    DEFAULT_TAG_CONTENT_TYPES,
    desired_tag_content_types,
    tag_content_types_from_api_record,
)


def test_desired_tag_content_types_merges_defaults() -> None:
    """Tags without content_types receive device, VM, and cluster types."""
    assert desired_tag_content_types({"name": "lab"}) == sorted(
        DEFAULT_TAG_CONTENT_TYPES
    )


def test_desired_tag_content_types_preserves_yaml_and_adds_defaults() -> None:
    """YAML content_types are merged with required baseline defaults."""
    result = desired_tag_content_types(
        {
            "name": "Custom",
            "content_types": ["ipam.ipaddress"],
        }
    )
    assert "ipam.ipaddress" in result
    assert "virtualization.virtualmachine" in result
    assert "virtualization.cluster" in result


def test_tag_content_types_from_api_record() -> None:
    """Parse content types from Nautobot tag API shape."""
    record = {
        "content_types": [
            {"app_label": "dcim", "model": "device"},
            "virtualization.virtualmachine",
        ]
    }
    assert tag_content_types_from_api_record(record) == [
        "dcim.device",
        "virtualization.virtualmachine",
    ]
