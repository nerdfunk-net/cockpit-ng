"""Unit tests for the RBAC seed/repair script.

Focus on the repair behaviour: the canonical permission list, the obsolete
resources removed during a repair pass, and the helpers that clean up / report
permissions that are no longer used.
"""

from unittest.mock import MagicMock

import pytest

import tools.seed_rbac as seed_rbac


@pytest.fixture
def mock_rbac(monkeypatch):
    """Replace the module-level rbac service with a mock."""
    mock = MagicMock()
    monkeypatch.setattr(seed_rbac, "rbac", mock)
    return mock


@pytest.fixture
def mock_user_db(monkeypatch):
    """Replace the module-level user_db service with a mock."""
    mock = MagicMock()
    mock.get_all_users.return_value = []
    monkeypatch.setattr(seed_rbac, "user_db", mock)
    return mock


class TestCanonicalPermissions:
    def test_correct_onboard_offboard_present(self):
        resources = {resource for resource, _, _ in seed_rbac.DEFAULT_PERMISSIONS}
        assert "nautobot.onboard" in resources
        assert "nautobot.offboard" in resources

    def test_invalid_device_permissions_absent(self):
        resources = {resource for resource, _, _ in seed_rbac.DEFAULT_PERMISSIONS}
        assert "devices.onboard" not in resources
        assert "devices.offboard" not in resources

    def test_invalid_device_permissions_marked_obsolete(self):
        assert "devices.onboard" in seed_rbac.OBSOLETE_RESOURCES
        assert "devices.offboard" in seed_rbac.OBSOLETE_RESOURCES

    def test_renamed_resources_present(self):
        """server_clients.*, network.snapshots and nautobot.scan_and_add
        replace the old bare servers/network.clients/snapshots/scan names."""
        known = {
            (resource, action) for resource, action, _ in seed_rbac.DEFAULT_PERMISSIONS
        }
        assert ("server_clients.server", "read") in known
        assert ("server_clients.server", "write") in known
        assert ("server_clients.server", "delete") in known
        assert ("server_clients.clients", "read") in known
        assert ("server_clients.search", "read") in known
        assert ("network.snapshots", "read") in known
        assert ("network.snapshots", "write") in known
        assert ("network.snapshots", "delete") in known
        assert ("nautobot.scan_and_add", "execute") in known
        # network.scan (nmap/prefix scan) is a distinct, unrelated permission
        # and must not be confused with nautobot.scan_and_add.
        assert ("network.scan", "execute") in known

    def test_old_resource_names_absent(self):
        resources = {resource for resource, _, _ in seed_rbac.DEFAULT_PERMISSIONS}
        assert "servers" not in resources
        assert "network.clients" not in resources
        assert "snapshots" not in resources
        assert "scan" not in resources
        assert "configs" not in resources
        # configs.backup / configs.compare / configs.search are still valid,
        # only the bare (and never-enforced) "configs" resource is gone.
        assert "configs.backup" in resources

    def test_old_resource_names_marked_obsolete(self):
        for resource in ("servers", "network.clients", "snapshots", "scan", "configs"):
            assert resource in seed_rbac.OBSOLETE_RESOURCES


class TestCleanupObsoletePermissions:
    def test_removes_obsolete_devices_permissions(self, mock_rbac):
        mock_rbac.list_permissions.return_value = [
            {"id": 1, "resource": "devices.onboard", "action": "execute"},
            {"id": 2, "resource": "devices.offboard", "action": "execute"},
            {"id": 3, "resource": "nautobot.onboard", "action": "execute"},
            {"id": 4, "resource": "nautobot.offboard", "action": "execute"},
        ]

        seed_rbac.cleanup_obsolete_permissions(verbose=False)

        deleted_ids = {
            call.args[0] for call in mock_rbac.delete_permission.call_args_list
        }
        # Only the invalid devices.* permissions are removed.
        assert deleted_ids == {1, 2}

    def test_keeps_valid_permissions(self, mock_rbac):
        mock_rbac.list_permissions.return_value = [
            {"id": 3, "resource": "nautobot.onboard", "action": "execute"},
            {"id": 4, "resource": "nautobot.offboard", "action": "execute"},
        ]

        seed_rbac.cleanup_obsolete_permissions(verbose=False)

        mock_rbac.delete_permission.assert_not_called()


class TestMigrateRenamedResourcePermissions:
    def test_migrates_role_assignment_to_new_resource(self, mock_rbac, mock_user_db):
        mock_rbac.list_permissions.return_value = [
            {"id": 1, "resource": "servers", "action": "read"},
            {"id": 2, "resource": "server_clients.server", "action": "read"},
        ]
        mock_rbac.list_roles.return_value = [{"id": 10, "name": "operator"}]
        mock_rbac.get_role_permissions.return_value = [
            {"id": 1, "resource": "servers", "action": "read"},
        ]

        seed_rbac.migrate_renamed_resource_permissions(
            "servers", "server_clients.server", verbose=False
        )

        mock_rbac.assign_permission_to_role.assert_called_once_with(10, 2, granted=True)

    def test_migrates_user_override_preserving_granted_flag(
        self, mock_rbac, mock_user_db
    ):
        mock_rbac.list_permissions.return_value = [
            {"id": 1, "resource": "snapshots", "action": "delete"},
            {"id": 2, "resource": "network.snapshots", "action": "delete"},
        ]
        mock_rbac.list_roles.return_value = []
        mock_user_db.get_all_users.return_value = [{"id": 5, "username": "alice"}]
        mock_rbac.get_user_permission_overrides.return_value = [
            {"id": 1, "resource": "snapshots", "action": "delete", "granted": False},
        ]

        seed_rbac.migrate_renamed_resource_permissions(
            "snapshots", "network.snapshots", verbose=False
        )

        mock_rbac.assign_permission_to_user.assert_called_once_with(5, 2, granted=False)

    def test_noop_when_old_resource_not_present(self, mock_rbac, mock_user_db):
        mock_rbac.list_permissions.return_value = [
            {"id": 2, "resource": "server_clients.server", "action": "read"},
        ]
        mock_rbac.list_roles.return_value = [{"id": 10, "name": "operator"}]

        seed_rbac.migrate_renamed_resource_permissions(
            "servers", "server_clients.server", verbose=False
        )

        mock_rbac.assign_permission_to_role.assert_not_called()
        mock_rbac.get_role_permissions.assert_not_called()


class TestReportUnknownPermissions:
    def test_flags_permissions_not_in_canonical_list(self, mock_rbac):
        mock_rbac.list_permissions.return_value = [
            {"id": 1, "resource": "nautobot.onboard", "action": "execute"},
            {"id": 99, "resource": "totally.bogus", "action": "read"},
        ]

        unknown = seed_rbac.report_unknown_permissions(verbose=False)

        assert [(p["resource"], p["action"]) for p in unknown] == [
            ("totally.bogus", "read")
        ]

    def test_obsolete_resources_not_reported_as_unknown(self, mock_rbac):
        # Obsolete perms are handled by cleanup, not reported as unknown.
        mock_rbac.list_permissions.return_value = [
            {"id": 1, "resource": "devices.onboard", "action": "execute"},
        ]

        unknown = seed_rbac.report_unknown_permissions(verbose=False)

        assert unknown == []

    def test_canonical_permissions_not_reported(self, mock_rbac):
        mock_rbac.list_permissions.return_value = [
            {"id": resource_idx, "resource": resource, "action": action}
            for resource_idx, (resource, action, _) in enumerate(
                seed_rbac.DEFAULT_PERMISSIONS
            )
        ]

        unknown = seed_rbac.report_unknown_permissions(verbose=False)

        assert unknown == []
