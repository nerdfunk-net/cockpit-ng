"""Unit tests for services/network/snapshots/template_service.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

_PATCH_REPO = "services.network.snapshots.template_service.SnapshotTemplateRepository"


def _mk_template(
    id: int = 1,
    name: str = "tmpl",
    scope: str = "global",
    created_by: str = "alice",
) -> SimpleNamespace:
    return SimpleNamespace(id=id, name=name, scope=scope, created_by=created_by)


def _create_request(name: str = "my-tmpl", scope: str = "global"):
    from models.snapshots import SnapshotCommandTemplateCreate

    return SnapshotCommandTemplateCreate(
        name=name,
        description="desc",
        scope=scope,
        commands=[],
    )


def _update_request(**kwargs):
    from models.snapshots import SnapshotCommandTemplateUpdate

    return SnapshotCommandTemplateUpdate(**kwargs)


@pytest.fixture
def svc():
    with patch(_PATCH_REPO):
        from services.network.snapshots.template_service import SnapshotTemplateService

        s = SnapshotTemplateService()
        return s


@pytest.mark.unit
class TestCreateTemplate:
    def test_creates_when_no_conflict(self, svc):
        svc.repo.get_by_name.return_value = None
        tmpl = _mk_template()
        svc.repo.create_template.return_value = tmpl

        from models.snapshots import SnapshotCommandTemplateResponse

        with patch.object(
            SnapshotCommandTemplateResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="tmpl"),
        ):
            result = svc.create_template(_create_request(), "alice")

        assert result.name == "tmpl"
        svc.repo.create_template.assert_called_once()

    def test_raises_when_global_template_name_exists(self, svc):
        svc.repo.get_by_name.return_value = _mk_template(scope="global")
        with pytest.raises(ValueError, match="already exists"):
            svc.create_template(_create_request(), "alice")

    def test_raises_when_user_owns_same_name(self, svc):
        svc.repo.get_by_name.return_value = _mk_template(scope="private", created_by="alice")
        with pytest.raises(ValueError, match="already exists"):
            svc.create_template(_create_request(), "alice")

    def test_does_not_raise_when_other_user_owns_private(self, svc):
        svc.repo.get_by_name.return_value = _mk_template(scope="private", created_by="bob")
        tmpl = _mk_template()
        svc.repo.create_template.return_value = tmpl

        from models.snapshots import SnapshotCommandTemplateResponse

        with patch.object(
            SnapshotCommandTemplateResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1),
        ):
            svc.create_template(_create_request(), "alice")

        svc.repo.create_template.assert_called_once()


@pytest.mark.unit
class TestGetTemplate:
    def test_returns_none_when_not_found(self, svc):
        svc.repo.get_by_id.return_value = None
        assert svc.get_template(99) is None

    def test_returns_response_when_found(self, svc):
        svc.repo.get_by_id.return_value = _mk_template()

        from models.snapshots import SnapshotCommandTemplateResponse

        with patch.object(
            SnapshotCommandTemplateResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="tmpl"),
        ):
            result = svc.get_template(1)

        assert result.id == 1


@pytest.mark.unit
class TestListTemplates:
    def test_returns_empty_list(self, svc):
        svc.repo.get_all.return_value = []
        assert svc.list_templates() == []

    def test_returns_mapped_templates(self, svc):
        svc.repo.get_all.return_value = [_mk_template(id=1), _mk_template(id=2)]

        from models.snapshots import SnapshotCommandTemplateResponse

        with patch.object(
            SnapshotCommandTemplateResponse,
            "from_orm",
            side_effect=lambda t: SimpleNamespace(id=t.id),
        ):
            results = svc.list_templates(username="alice")

        assert len(results) == 2
        svc.repo.get_all.assert_called_once_with(created_by="alice")


@pytest.mark.unit
class TestUpdateTemplate:
    def test_returns_none_when_not_found(self, svc):
        svc.repo.get_by_id.return_value = None
        assert svc.update_template(99, _update_request(name="new"), "alice") is None

    def test_raises_if_private_and_not_owner(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="private", created_by="bob")
        with pytest.raises(ValueError, match="permission"):
            svc.update_template(1, _update_request(name="x"), "alice")

    def test_updates_global_template_by_any_user(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="global", created_by="bob")
        updated = _mk_template(name="updated")
        svc.repo.update_template.return_value = updated

        from models.snapshots import SnapshotCommandTemplateResponse

        with patch.object(
            SnapshotCommandTemplateResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="updated"),
        ):
            result = svc.update_template(1, _update_request(name="updated"), "alice")

        assert result.name == "updated"

    def test_returns_none_when_repo_update_returns_none(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="global")
        svc.repo.update_template.return_value = None
        assert svc.update_template(1, _update_request(), "alice") is None


@pytest.mark.unit
class TestDeleteTemplate:
    def test_returns_false_when_not_found(self, svc):
        svc.repo.get_by_id.return_value = None
        assert svc.delete_template(99, "alice") is False

    def test_raises_if_private_and_not_owner(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="private", created_by="bob")
        with pytest.raises(ValueError, match="permission"):
            svc.delete_template(1, "alice")

    def test_deletes_owned_private_template(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="private", created_by="alice")
        svc.repo.delete_template.return_value = True
        assert svc.delete_template(1, "alice") is True

    def test_deletes_global_template(self, svc):
        svc.repo.get_by_id.return_value = _mk_template(scope="global")
        svc.repo.delete_template.return_value = True
        assert svc.delete_template(1, "anyone") is True
