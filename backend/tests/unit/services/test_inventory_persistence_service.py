"""Unit tests for services/inventory/persistence_service.py."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from services.inventory.persistence_service import InventoryPersistenceService


def _inventory_model(**kwargs: object) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "name": "prod-network",
        "description": "desc",
        "conditions": json.dumps([{"field": "role", "value": "core"}]),
        "template_category": None,
        "template_name": None,
        "scope": "global",
        "group_path": None,
        "created_by": "alice",
        "is_active": True,
        "created_at": None,
        "updated_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.fixture
def repo() -> MagicMock:
    return MagicMock()


@pytest.fixture
def service(repo: MagicMock) -> InventoryPersistenceService:
    return InventoryPersistenceService(repo)


@pytest.mark.unit
def test_create_inventory_success(service: InventoryPersistenceService, repo: MagicMock) -> None:
    repo.get_by_name.return_value = None
    repo.create.return_value = _inventory_model(id=10)

    inv_id = service.create_inventory(
        {
            "name": "prod-network",
            "created_by": "alice",
            "conditions": [{"field": "role", "value": "core"}],
        }
    )

    assert inv_id == 10
    repo.create.assert_called_once()


@pytest.mark.unit
def test_create_inventory_requires_name(service: InventoryPersistenceService) -> None:
    with pytest.raises(ValueError, match="name is required"):
        service.create_inventory({"created_by": "alice", "conditions": []})


@pytest.mark.unit
def test_create_inventory_duplicate_name(service: InventoryPersistenceService, repo: MagicMock) -> None:
    repo.get_by_name.return_value = _inventory_model()

    with pytest.raises(ValueError, match="already exists"):
        service.create_inventory(
            {
                "name": "prod-network",
                "created_by": "alice",
                "conditions": [{"field": "role"}],
            }
        )


@pytest.mark.unit
def test_get_inventory_private_access_denied(
    service: InventoryPersistenceService, repo: MagicMock
) -> None:
    repo.get_by_id.return_value = _inventory_model(scope="private", created_by="bob")

    with pytest.raises(PermissionError):
        service.get_inventory(1, username="alice")


@pytest.mark.unit
def test_list_inventories_maps_results(
    service: InventoryPersistenceService, repo: MagicMock
) -> None:
    repo.list_inventories.return_value = [_inventory_model()]

    results = service.list_inventories("alice")

    assert len(results) == 1
    assert results[0]["name"] == "prod-network"
    assert isinstance(results[0]["conditions"], list)


@pytest.mark.unit
def test_get_all_groups_expands_ancestor_paths(
    service: InventoryPersistenceService, repo: MagicMock
) -> None:
    repo.get_distinct_group_paths.return_value = ["networking/dc1", "security"]

    groups = service.get_all_groups("alice")

    assert "networking" in groups
    assert "networking/dc1" in groups
    assert "security" in groups


@pytest.mark.unit
def test_rename_group_validates_path(service: InventoryPersistenceService) -> None:
    with pytest.raises(ValueError, match="root"):
        service.rename_group("", "new", "alice")

    with pytest.raises(ValueError, match="must not contain"):
        service.rename_group("networking/dc1", "bad/name", "alice")
