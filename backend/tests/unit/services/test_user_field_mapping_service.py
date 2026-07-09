"""Unit tests for services/user_field_mappings/user_field_mapping_service.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.user_field_mappings.user_field_mapping_service import (
    UserFieldMappingService,
)

_PATCH_REPO_CLASS = (
    "services.user_field_mappings.user_field_mapping_service.UserFieldMappingRepository"
)


@pytest.mark.unit
def test_get_mapping_returns_none_when_unset() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_username_and_app.return_value = None

    with patch(_PATCH_REPO_CLASS, return_value=mock_repo):
        service = UserFieldMappingService()
        result = service.get_mapping("alice", "nautobot-live-update")

    assert result is None
    mock_repo.get_by_username_and_app.assert_called_once_with(
        "alice", "nautobot-live-update"
    )


@pytest.mark.unit
def test_get_mapping_returns_stored_dict() -> None:
    stored = {"Device Name": "name", "Status": "status"}
    mock_repo = MagicMock()
    mock_repo.get_by_username_and_app.return_value = SimpleNamespace(mapping=stored)

    with patch(_PATCH_REPO_CLASS, return_value=mock_repo):
        service = UserFieldMappingService()
        result = service.get_mapping("alice", "nautobot-live-update")

    assert result == stored


@pytest.mark.unit
def test_save_mapping_delegates_to_repository_upsert() -> None:
    mapping = {"Device Name": "name"}
    mock_repo = MagicMock()
    mock_repo.upsert.return_value = SimpleNamespace(mapping=mapping)

    with patch(_PATCH_REPO_CLASS, return_value=mock_repo):
        service = UserFieldMappingService()
        result = service.save_mapping("alice", "nautobot-live-update", mapping)

    assert result == mapping
    mock_repo.upsert.assert_called_once_with("alice", "nautobot-live-update", mapping)
