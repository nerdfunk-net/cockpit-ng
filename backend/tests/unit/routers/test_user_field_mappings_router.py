"""Unit tests for routers/user_field_mappings.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from models.user_field_mappings import FieldMappingUpdateRequest
from routers.user_field_mappings import get_field_mapping, save_field_mapping


@pytest.mark.unit
async def test_get_field_mapping_returns_stored_data() -> None:
    mock_service = MagicMock()
    mock_service.get_mapping.return_value = {"Device Name": "name"}

    result = await get_field_mapping(
        app_name="nautobot-live-update",
        current_user="alice",
        service=mock_service,
    )

    assert result.success is True
    assert result.data == {"Device Name": "name"}
    mock_service.get_mapping.assert_called_once_with("alice", "nautobot-live-update")


@pytest.mark.unit
async def test_get_field_mapping_returns_none_when_unset() -> None:
    mock_service = MagicMock()
    mock_service.get_mapping.return_value = None

    result = await get_field_mapping(
        app_name="nautobot-live-update",
        current_user="alice",
        service=mock_service,
    )

    assert result.data is None


@pytest.mark.unit
async def test_get_field_mapping_sanitizes_internal_error() -> None:
    mock_service = MagicMock()
    mock_service.get_mapping.side_effect = RuntimeError("db exploded with secret info")

    with pytest.raises(HTTPException) as exc_info:
        await get_field_mapping(
            app_name="nautobot-live-update",
            current_user="alice",
            service=mock_service,
        )

    assert exc_info.value.status_code == 500
    assert "secret" not in str(exc_info.value.detail)


@pytest.mark.unit
async def test_save_field_mapping_persists_and_returns_mapping() -> None:
    mock_service = MagicMock()
    mock_service.save_mapping.return_value = {"Device Name": "name", "Status": "status"}
    body = FieldMappingUpdateRequest(
        mapping={"Device Name": "name", "Status": "status"}
    )

    result = await save_field_mapping(
        body=body,
        app_name="nautobot-live-update",
        current_user="alice",
        service=mock_service,
    )

    assert result.data == {"Device Name": "name", "Status": "status"}
    mock_service.save_mapping.assert_called_once_with(
        "alice", "nautobot-live-update", {"Device Name": "name", "Status": "status"}
    )
