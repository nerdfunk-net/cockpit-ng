"""Unit tests for TemplateService.

All tests run offline - no database required.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.templates.template_service import TemplateService


def _template_obj(**overrides) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "name": "router_config",
        "source": "webeditor",
        "template_type": "jinja2",
        "category": "netmiko",
        "description": "Router config",
        "content": "hostname {{ hostname }}",
        "filename": "router.j2",
        "content_hash": hashlib.sha256(b"hostname {{ hostname }}").hexdigest(),
        "variables": json.dumps({"hostname": "r1"}),
        "tags": json.dumps(["network"]),
        "created_by": "admin",
        "scope": "global",
        "is_active": True,
        "use_nautobot_context": True,
        "pass_snmp_mapping": False,
        "inventory_id": None,
        "pre_run_command": None,
        "credential_id": None,
        "execution_mode": "run_on_device",
        "file_path": None,
        "last_sync": None,
        "sync_status": None,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _version_obj(**overrides) -> SimpleNamespace:
    defaults = {
        "id": 10,
        "template_id": 1,
        "version_number": 2,
        "content": "hostname r1",
        "content_hash": hashlib.sha256(b"hostname r1").hexdigest(),
        "created_at": datetime(2026, 1, 3, tzinfo=timezone.utc),
        "created_by": "admin",
        "change_notes": "updated",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.unit
def test_create_template_creates_record_and_initial_version() -> None:
    """Creating a template stores JSON metadata and creates version 1 for content."""
    repo = MagicMock()
    repo.get_by_name.return_value = None
    repo.create.return_value = SimpleNamespace(id=42)
    version_repo = MagicMock()
    version_repo.get_max_version_number.return_value = 0

    with patch(
        "services.templates.template_service.TemplateRepository", return_value=repo
    ), patch(
        "services.templates.template_service.TemplateVersionRepository",
        return_value=version_repo,
    ):
        template_id = TemplateService().create_template(
            {
                "name": "router_config",
                "source": "webeditor",
                "content": "hostname {{ hostname }}",
                "variables": {"hostname": "r1"},
                "tags": ["network"],
                "created_by": "admin",
            }
        )

    assert template_id == 42
    repo.create.assert_called_once()
    create_kwargs = repo.create.call_args.kwargs
    assert create_kwargs["variables"] == json.dumps({"hostname": "r1"})
    assert create_kwargs["tags"] == json.dumps(["network"])
    assert create_kwargs["content_hash"] == hashlib.sha256(
        b"hostname {{ hostname }}"
    ).hexdigest()
    version_repo.create.assert_called_once_with(
        template_id=42,
        version_number=1,
        content="hostname {{ hostname }}",
        content_hash=create_kwargs["content_hash"],
        change_notes="Initial version",
    )


@pytest.mark.unit
def test_create_template_duplicate_name_raises() -> None:
    """Duplicate active template names are rejected."""
    repo = MagicMock()
    repo.get_by_name.return_value = _template_obj()

    with patch(
        "services.templates.template_service.TemplateRepository", return_value=repo
    ), patch("services.templates.template_service.TemplateVersionRepository"):
        with pytest.raises(ValueError, match="already exists"):
            TemplateService().create_template(
                {"name": "router_config", "source": "file"}
            )


@pytest.mark.unit
def test_get_template_returns_model_as_dict() -> None:
    """Template models are converted to API dictionaries."""
    repo = MagicMock()
    repo.get_by_id.return_value = _template_obj()

    with patch("services.templates.template_service.TemplateRepository", return_value=repo):
        result = TemplateService().get_template(1)

    assert result is not None
    assert result["name"] == "router_config"
    assert result["variables"] == {"hostname": "r1"}
    assert result["tags"] == ["network"]
    assert result["created_at"] == "2026-01-01T00:00:00+00:00"


@pytest.mark.unit
def test_list_templates_filters_through_repository() -> None:
    """List filters are passed to the repository and converted to dictionaries."""
    repo = MagicMock()
    repo.list_templates.return_value = [
        _template_obj(id=1, name="global-template", scope="global"),
        _template_obj(id=2, name="private-template", scope="private", created_by="alice"),
    ]

    with patch("services.templates.template_service.TemplateRepository", return_value=repo):
        result = TemplateService().list_templates(
            category="netmiko", source="webeditor", username="alice"
        )

    repo.list_templates.assert_called_once_with(
        category="netmiko",
        source="webeditor",
        active_only=True,
        username="alice",
    )
    assert [template["name"] for template in result] == [
        "global-template",
        "private-template",
    ]


@pytest.mark.unit
def test_update_template_creates_new_version_when_content_changes() -> None:
    """Content changes update the template and add a version record."""
    current_content = "hostname old"
    new_content = "hostname new"
    repo = MagicMock()
    repo.get_by_id.return_value = _template_obj(
        content=current_content,
        content_hash=hashlib.sha256(current_content.encode()).hexdigest(),
    )
    version_repo = MagicMock()
    version_repo.get_max_version_number.return_value = 2

    with patch(
        "services.templates.template_service.TemplateRepository", return_value=repo
    ), patch(
        "services.templates.template_service.TemplateVersionRepository",
        return_value=version_repo,
    ):
        result = TemplateService().update_template(
            1,
            {
                "content": new_content,
                "change_notes": "new hostname",
                "scope": "private",
            },
        )

    assert result is True
    repo.update.assert_called_once()
    assert repo.update.call_args.args[0] == 1
    assert repo.update.call_args.kwargs["scope"] == "private"
    assert repo.update.call_args.kwargs["variables"] == json.dumps({"hostname": "r1"})
    assert repo.update.call_args.kwargs["tags"] == json.dumps(["network"])
    version_repo.create.assert_called_once()
    assert version_repo.create.call_args.kwargs["version_number"] == 3
    assert version_repo.create.call_args.kwargs["change_notes"] == "new hostname"


@pytest.mark.unit
def test_delete_template_soft_and_hard_delete() -> None:
    """Soft delete deactivates while hard delete removes the row."""
    repo = MagicMock()

    with patch("services.templates.template_service.TemplateRepository", return_value=repo):
        service = TemplateService()
        assert service.delete_template(1) is True
        assert service.delete_template(2, hard_delete=True) is True

    repo.update.assert_called_once_with(1, is_active=False)
    repo.delete.assert_called_once_with(2)


@pytest.mark.unit
def test_render_template_with_context() -> None:
    """Jinja variables are substituted using the provided context."""
    service = TemplateService()
    service.get_template_by_name = MagicMock(return_value={"id": 1, "name": "ssh_config"})
    service.get_template_content = MagicMock(
        return_value="hostname {{ hostname }}\nip {{ ip_address }}"
    )

    rendered = service.render_template(
        "ssh_config",
        "netmiko",
        {"hostname": "r1", "ip_address": "10.0.0.1"},
    )

    assert "hostname r1" in rendered
    assert "ip 10.0.0.1" in rendered


@pytest.mark.unit
def test_render_template_missing_template_raises() -> None:
    """Rendering a missing template raises a clear ValueError."""
    service = TemplateService()
    service.get_template_by_name = MagicMock(return_value=None)
    service.list_templates = MagicMock(return_value=[])

    with pytest.raises(ValueError, match="not found"):
        service.render_template("missing", "netmiko", {})


@pytest.mark.unit
def test_get_template_versions_returns_version_dicts() -> None:
    """Version rows are converted to dictionaries."""
    version_repo = MagicMock()
    version_repo.get_versions_by_template_id.return_value = [_version_obj()]

    with patch(
        "services.templates.template_service.TemplateVersionRepository",
        return_value=version_repo,
    ):
        result = TemplateService().get_template_versions(1)

    assert result == [
        {
            "id": 10,
            "template_id": 1,
            "version_number": 2,
            "content": "hostname r1",
            "content_hash": hashlib.sha256(b"hostname r1").hexdigest(),
            "created_at": "2026-01-03T00:00:00+00:00",
            "created_by": "admin",
            "change_notes": "updated",
        }
    ]


@pytest.mark.unit
def test_health_check_returns_counts() -> None:
    """Health checks report repository count metrics."""
    repo = MagicMock()
    repo.get_active_count.return_value = 3
    repo.get_total_count.return_value = 4
    repo.get_categories_count.return_value = 2

    with patch("services.templates.template_service.TemplateRepository", return_value=repo):
        result = TemplateService().health_check()

    assert result == {
        "status": "healthy",
        "storage_type": "database",
        "active_templates": 3,
        "total_templates": 4,
        "categories": 2,
    }


@pytest.mark.unit
def test_mark_git_templates_sync_metadata_updates_only_allowed_git_templates() -> None:
    """Sync metadata updates git templates scoped to the current user."""
    repo = MagicMock()
    repo.get_by_id.side_effect = [
        _template_obj(id=1, source="git", scope="global"),
        _template_obj(id=2, source="file", scope="global"),
        _template_obj(id=3, source="git", scope="private", created_by="bob"),
        _template_obj(id=4, source="git", scope="private", created_by="alice"),
    ]

    with patch("services.templates.template_service.TemplateRepository", return_value=repo):
        TemplateService().mark_git_templates_sync_metadata(
            [1, 2, 3, 4],
            sync_status="synced",
            username="alice",
        )

    updated_ids = [call.args[0] for call in repo.update.call_args_list]
    assert updated_ids == [1, 4]
    assert all(
        call.kwargs["sync_status"] == "synced" for call in repo.update.call_args_list
    )
