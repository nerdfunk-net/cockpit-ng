"""Unit tests for baseline location type helpers and import behavior."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

pytestmark = pytest.mark.unit

from services.network.tools.baseline import (
    BaselineImportService,
    content_types_from_api_record,
    normalize_content_types,
    normalize_location_type_content_types,
    sort_location_types_by_parent,
)


def test_normalize_content_types_string() -> None:
    assert normalize_content_types("dcim.device") == ["dcim.device"]


def test_normalize_content_types_list() -> None:
    assert normalize_content_types(
        ["virtualization.virtualmachine", "dcim.device"]
    ) == ["dcim.device", "virtualization.virtualmachine"]


def test_normalize_location_type_content_types_maps_vm_to_cluster() -> None:
    assert normalize_location_type_content_types(
        ["dcim.device", "virtualization.virtualmachine"]
    ) == ["dcim.device", "virtualization.cluster"]


def test_content_types_from_api_record_dict_items() -> None:
    record = {
        "content_types": [
            {"app_label": "dcim", "model": "device"},
            {"app_label": "virtualization", "model": "virtualmachine"},
        ]
    }
    assert content_types_from_api_record(record) == [
        "dcim.device",
        "virtualization.cluster",
    ]


def test_sort_location_types_by_parent() -> None:
    types = [
        {"name": "Building", "parent": "City"},
        {"name": "Country"},
        {"name": "City", "parent": "State"},
        {"name": "State", "parent": "Country"},
    ]
    ordered = [t["name"] for t in sort_location_types_by_parent(types)]
    assert ordered == ["Country", "State", "City", "Building"]


@pytest.mark.asyncio
async def test_create_location_types_patches_existing_content_types() -> None:
    service = BaselineImportService.__new__(BaselineImportService)
    service.nautobot = MagicMock()
    service.nautobot.rest_request = AsyncMock(
        side_effect=[
            {
                "count": 1,
                "results": [
                    {
                        "id": "building-type-id",
                        "name": "Building",
                        "content_types": ["virtualization.cluster"],
                    }
                ],
            },
            {"id": "building-type-id"},
        ]
    )

    result = await service.create_location_types(
        [
            {
                "name": "Building",
                "parent": "City",
                "content_types": ["dcim.device", "virtualization.virtualmachine"],
            }
        ]
    )

    assert result["Building"] == "building-type-id"
    assert service.nautobot.rest_request.await_count == 2
    patch_call = service.nautobot.rest_request.await_args_list[1]
    assert patch_call.args[0] == "dcim/location-types/building-type-id/"
    assert patch_call.kwargs["method"] == "PATCH"
    assert patch_call.kwargs["data"]["content_types"] == [
        "dcim.device",
        "virtualization.cluster",
    ]


@pytest.mark.asyncio
async def test_create_location_types_skips_patch_when_content_types_match() -> None:
    service = BaselineImportService.__new__(BaselineImportService)
    service.nautobot = MagicMock()
    service.nautobot.rest_request = AsyncMock(
        return_value={
            "count": 1,
            "results": [
                {
                    "id": "building-type-id",
                    "name": "Building",
                    "content_types": ["dcim.device", "virtualization.cluster"],
                }
            ],
        }
    )

    await service.create_location_types(
        [
            {
                "name": "Building",
                "content_types": [
                    "dcim.device",
                    "virtualization.cluster",
                ],
            }
        ]
    )

    assert service.nautobot.rest_request.await_count == 1
