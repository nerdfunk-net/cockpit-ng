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
