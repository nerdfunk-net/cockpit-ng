"""Unit tests for services/network/snapshots/execution_service.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_TEMPLATE_REPO = "services.network.snapshots.execution_service.SnapshotTemplateRepository"
_PATCH_SNAPSHOT_REPO = "services.network.snapshots.execution_service.SnapshotRepository"
_PATCH_GIT_MANAGER = "services.network.snapshots.execution_service.GitRepositoryManager"
_PATCH_NETMIKO = "services.network.snapshots.execution_service.NetmikoService"
_PATCH_GIT = "services.network.snapshots.execution_service.GitService"


def _make_svc():
    with (
        patch(_PATCH_TEMPLATE_REPO),
        patch(_PATCH_SNAPSHOT_REPO),
        patch(_PATCH_GIT_MANAGER),
        patch(_PATCH_NETMIKO),
        patch(_PATCH_GIT),
    ):
        from services.network.snapshots.execution_service import SnapshotExecutionService

        return SnapshotExecutionService()


def _mk_repo_data(id: int = 1):
    return SimpleNamespace(
        id=id,
        name="snap-repo",
        url="https://git.example.com/snaps.git",
        branch="main",
    )


def _mk_snapshot(id: int = 1):
    return SimpleNamespace(id=id, name="snap-1", git_repository_id=1, results=[])


def _mk_execute_request(credential_id=None, username="admin", password="secret"):
    from models.snapshots import SnapshotCommandCreate, SnapshotExecuteRequest

    return SnapshotExecuteRequest(
        name="Test Snapshot",
        description="desc",
        git_repository_id=1,
        snapshot_path="snapshots/{device_name}/{timestamp}.json",
        devices=[{"name": "router-01", "primary_ip4": {"address": "10.0.0.1/24"}, "platform": {"name": "cisco_ios"}}],
        commands=[SnapshotCommandCreate(command="show version", use_textfsm=False)],
        credential_id=credential_id,
        username=username if credential_id is None else None,
        password=password if credential_id is None else None,
    )


@pytest.mark.unit
class TestRenderPath:
    def test_replaces_device_name(self):
        svc = _make_svc()
        result = svc._render_path("{device_name}/config.json", {"name": "router-01"}, "2026-01-01")
        assert result == "router-01/config.json"

    def test_replaces_timestamp(self):
        svc = _make_svc()
        result = svc._render_path("snap/{timestamp}.json", {"name": "r"}, "2026-01-01T12-00-00")
        assert result == "snap/2026-01-01T12-00-00.json"

    def test_replaces_template_name(self):
        svc = _make_svc()
        result = svc._render_path("{template_name}/{device_name}.json", {"name": "r"}, "ts", template_name="cisco")
        assert result == "cisco/r.json"

    def test_replaces_custom_fields(self):
        svc = _make_svc()
        device = {"name": "r", "custom_fields": {"site": "dc1"}}
        result = svc._render_path("{custom_field.site}/{device_name}.json", device, "ts")
        assert result == "dc1/r.json"

    def test_string_device_fallback(self):
        svc = _make_svc()
        result = svc._render_path("{device_name}.json", "my-device", "ts")
        assert result == "my-device.json"

    def test_no_template_name_placeholder_skipped(self):
        svc = _make_svc()
        result = svc._render_path("{device_name}.json", {"name": "r"}, "ts", template_name="cisco")
        assert result == "r.json"


@pytest.mark.unit
class TestGetSnapshot:
    def test_returns_none_when_not_found(self):
        svc = _make_svc()
        svc.snapshot_repo.get_by_id.return_value = None
        assert svc.get_snapshot(99) is None

    def test_returns_response_when_found(self):
        svc = _make_svc()
        svc.snapshot_repo.get_by_id.return_value = _mk_snapshot()

        from models.snapshots import SnapshotResponse

        with patch.object(
            SnapshotResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="snap-1"),
        ):
            result = svc.get_snapshot(1)

        assert result.id == 1


@pytest.mark.unit
class TestListSnapshots:
    def test_returns_empty_list(self):
        svc = _make_svc()
        svc.snapshot_repo.get_all.return_value = []
        result = svc.list_snapshots()
        assert result == []

    def test_returns_list_response_items(self):
        svc = _make_svc()
        svc.snapshot_repo.get_all.return_value = [_mk_snapshot(1), _mk_snapshot(2)]

        from models.snapshots import SnapshotListResponse

        with patch.object(
            SnapshotListResponse,
            "from_orm",
            side_effect=lambda s: SimpleNamespace(id=s.id),
        ):
            result = svc.list_snapshots(username="alice", limit=10)

        assert len(result) == 2
        svc.snapshot_repo.get_all.assert_called_once_with(executed_by="alice", limit=10)


@pytest.mark.unit
class TestDeleteSnapshotDbOnly:
    def test_delegates_to_repo(self):
        svc = _make_svc()
        svc.snapshot_repo.delete_snapshot.return_value = True
        assert svc.delete_snapshot_db_only(1) is True
        svc.snapshot_repo.delete_snapshot.assert_called_once_with(1)


@pytest.mark.unit
class TestDeleteSnapshotWithFiles:
    def test_raises_when_snapshot_not_found(self):
        svc = _make_svc()
        svc.snapshot_repo.get_by_id.return_value = None
        with pytest.raises(ValueError, match="not found"):
            svc.delete_snapshot_with_files(99)

    def test_deletes_db_only_when_no_results(self):
        svc = _make_svc()
        snap = _mk_snapshot()
        snap.results = []
        svc.snapshot_repo.get_by_id.return_value = snap
        svc.snapshot_repo.delete_snapshot.return_value = True

        result = svc.delete_snapshot_with_files(1)
        assert result is True
        svc.snapshot_repo.delete_snapshot.assert_called_once_with(1)

    def test_raises_when_no_git_repo_id(self):
        svc = _make_svc()
        snap = _mk_snapshot()
        snap.git_repository_id = None
        snap.results = [SimpleNamespace(git_file_path="snap.json")]
        svc.snapshot_repo.get_by_id.return_value = snap

        with pytest.raises(ValueError, match="git_repository_id"):
            svc.delete_snapshot_with_files(1)

    def test_raises_when_git_repo_not_found(self):
        svc = _make_svc()
        snap = _mk_snapshot()
        snap.results = [SimpleNamespace(git_file_path="snap.json")]
        svc.snapshot_repo.get_by_id.return_value = snap
        svc.git_manager.get_repository.return_value = None

        with pytest.raises(ValueError, match="Git repository"):
            svc.delete_snapshot_with_files(1)


@pytest.mark.unit
class TestSaveToGit:
    def test_returns_none_when_repo_not_found(self):
        svc = _make_svc()
        svc.git_manager.get_repository.return_value = None
        result = svc._save_to_git(99, "path/file.json", "{}", "commit msg")
        assert result is None

    def test_returns_none_on_exception(self):
        svc = _make_svc()
        svc.git_manager.get_repository.side_effect = RuntimeError("db error")
        result = svc._save_to_git(1, "path/file.json", "{}", "commit msg")
        assert result is None

    def test_returns_commit_hash_on_success(self, tmp_path):
        svc = _make_svc()
        repo_data = _mk_repo_data()
        svc.git_manager.get_repository.return_value = repo_data

        git_result = SimpleNamespace(success=True, commit_sha="abc123", message="ok")
        svc._git.open_or_clone.return_value = MagicMock()
        svc._git.commit_and_push.return_value = git_result

        with patch("services.git.paths.repo_path", return_value=str(tmp_path)):
            result = svc._save_to_git(1, "snaps/router.json", '{"data": 1}', "snapshot commit")

        assert result == "abc123"

    def test_returns_none_when_commit_fails(self, tmp_path):
        svc = _make_svc()
        repo_data = _mk_repo_data()
        svc.git_manager.get_repository.return_value = repo_data

        git_result = SimpleNamespace(success=False, commit_sha=None, message="push failed")
        svc._git.open_or_clone.return_value = MagicMock()
        svc._git.commit_and_push.return_value = git_result

        with patch("services.git.paths.repo_path", return_value=str(tmp_path)):
            result = svc._save_to_git(1, "snaps/router.json", "{}", "snapshot")

        assert result is None


@pytest.mark.unit
class TestExecuteSnapshot:
    def _make_full_svc(self):
        svc = _make_svc()
        svc.git_manager.get_repository.return_value = _mk_repo_data()

        snap = _mk_snapshot()
        svc.snapshot_repo.create_snapshot.return_value = snap

        result_row = SimpleNamespace(id=1)
        svc.snapshot_repo.create_result.return_value = result_row
        svc.snapshot_repo.update_snapshot_status.return_value = None
        svc.snapshot_repo.update_result.return_value = None
        svc.snapshot_repo.increment_success_count.return_value = None
        svc.snapshot_repo.increment_failed_count.return_value = None
        svc.snapshot_repo.get_by_id.return_value = snap

        return svc

    @pytest.mark.asyncio
    async def test_raises_when_git_repo_not_found(self):
        svc = _make_svc()
        svc.git_manager.get_repository.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await svc.execute_snapshot(_mk_execute_request(), "alice")

    @pytest.mark.asyncio
    async def test_raises_when_no_credentials_provided(self):
        svc = _make_svc()
        svc.git_manager.get_repository.return_value = _mk_repo_data()

        from models.snapshots import SnapshotCommandCreate, SnapshotExecuteRequest

        req = SnapshotExecuteRequest(
            name="snap",
            git_repository_id=1,
            snapshot_path="snaps/{device_name}.json",
            devices=[{"name": "router-01"}],
            commands=[SnapshotCommandCreate(command="show ver", use_textfsm=False)],
            username=None,
            password=None,
            credential_id=None,
        )
        with pytest.raises(ValueError, match="credential"):
            await svc.execute_snapshot(req, "alice")

    @pytest.mark.asyncio
    async def test_manual_credentials_execute_snapshot_success(self):
        svc = self._make_full_svc()

        netmiko_result = [
            {
                "success": True,
                "output": "Cisco IOS",
                "command_outputs": {"show version": "Cisco IOS"},
            }
        ]
        svc._netmiko.execute_commands = AsyncMock(return_value=("session-1", netmiko_result))
        svc._save_to_git = MagicMock(return_value="abc123")

        from models.snapshots import SnapshotResponse

        with patch.object(
            SnapshotResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="snap-1"),
        ):
            result = await svc.execute_snapshot(_mk_execute_request(), "alice")

        assert result.id == 1
        svc.snapshot_repo.increment_success_count.assert_called()

    @pytest.mark.asyncio
    async def test_failed_device_increments_failed_count(self):
        svc = self._make_full_svc()

        netmiko_result = [{"success": False, "error": "connection refused"}]
        svc._netmiko.execute_commands = AsyncMock(return_value=("session-1", netmiko_result))

        from models.snapshots import SnapshotResponse

        with patch.object(
            SnapshotResponse,
            "from_orm",
            return_value=SimpleNamespace(id=1, name="snap-1"),
        ):
            await svc.execute_snapshot(_mk_execute_request(), "alice")

        svc.snapshot_repo.increment_failed_count.assert_called()

    @pytest.mark.asyncio
    async def test_netmiko_exception_marks_all_failed_and_re_raises(self):
        svc = self._make_full_svc()
        svc._netmiko.execute_commands = AsyncMock(side_effect=RuntimeError("netmiko crash"))

        with pytest.raises(RuntimeError, match="netmiko crash"):
            await svc.execute_snapshot(_mk_execute_request(), "alice")

        svc.snapshot_repo.update_snapshot_status.assert_called()
