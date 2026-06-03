"""Unit tests for services/inventory/git_storage_service.py."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.inventory import SavedInventoryCondition
from services.inventory.git_storage_service import InventoryGitStorage


def _condition() -> SavedInventoryCondition:
    return SavedInventoryCondition(
        field="role",
        operator="equals",
        value="core",
        logic="and",
    )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_save_inventory_writes_and_commits(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "inventories").mkdir()

    git_repo = MagicMock()
    git_repo.working_dir = str(repo_dir)

    git_service = MagicMock()
    git_service.open_or_clone.return_value = git_repo
    commit_result = MagicMock(success=True, message="pushed")
    git_service.commit_and_push.return_value = commit_result

    git_auth = MagicMock()
    git_auth.resolve_credentials.return_value = ("user", "token", None)

    git_manager = MagicMock()
    git_manager.get_repository.return_value = {
        "id": 1,
        "name": "inventory-repo",
        "url": "https://git.example.com/inv.git",
        "auth_type": "token",
        "credential_name": "git-cred",
        "branch": "main",
    }

    storage = InventoryGitStorage()
    with (
        patch("service_factory.build_git_service", return_value=git_service),
        patch("service_factory.build_git_auth_service", return_value=git_auth),
        patch(
            "services.git.repository_service.GitRepositoryService",
            return_value=git_manager,
        ),
    ):
        result = await storage.save_inventory(
            name="prod",
            description="Production",
            conditions=[_condition()],
            repository_id=1,
        )

    assert result["success"] is True
    saved = json.loads((repo_dir / "inventories" / "prod.json").read_text())
    assert saved["name"] == "prod"
    git_service.commit_and_push.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_save_inventory_repository_not_found() -> None:
    git_manager = MagicMock()
    git_manager.get_repository.return_value = None

    storage = InventoryGitStorage()
    with patch(
        "services.git.repository_service.GitRepositoryService",
        return_value=git_manager,
    ):
        with pytest.raises(ValueError, match="Repository with ID"):
            await storage.save_inventory(
                "prod",
                None,
                [_condition()],
                repository_id=99,
            )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_list_inventories_reads_json_files(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    inv_dir = repo_dir / "inventories"
    inv_dir.mkdir(parents=True)
    (inv_dir / "prod.json").write_text(
        json.dumps(
            {
                "name": "prod",
                "description": "d",
                "conditions": [
                    {"field": "role", "operator": "equals", "value": "core", "logic": "and"}
                ],
            }
        )
    )

    git_repo = MagicMock()
    git_repo.working_dir = str(repo_dir)
    git_service = MagicMock()
    git_service.open_or_clone.return_value = git_repo
    git_service.pull.return_value = MagicMock(success=True)
    git_auth = MagicMock()
    git_auth.resolve_credentials.return_value = ("user", "token", None)
    git_manager = MagicMock()
    git_manager.get_repository.return_value = {"id": 1, "name": "r1"}

    storage = InventoryGitStorage()
    with (
        patch("service_factory.build_git_service", return_value=git_service),
        patch("service_factory.build_git_auth_service", return_value=git_auth),
        patch(
            "services.git.repository_service.GitRepositoryService",
            return_value=git_manager,
        ),
    ):
        inventories = await storage.list_inventories(1)

    assert len(inventories) == 1
    assert inventories[0].name == "prod"
