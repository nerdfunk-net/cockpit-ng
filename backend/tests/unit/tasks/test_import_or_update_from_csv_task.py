"""
Unit tests for import_or_update_from_csv_task._run_csv_import.

Tests two import formats using real CSV fixtures from the tests/ directory:
- "nautobot": one row per device, NULL/NoObject sentinel values stripped
- "cockpit":  one row per interface (multiple rows per device), respects set_primary_ipv4

Both scenarios use add_prefixes=True and default_prefix_length="24".
"""

import os
import shutil
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from tasks.import_or_update_from_csv_task import _run_csv_import

# ---------------------------------------------------------------------------
# Paths to golden CSV fixtures
# ---------------------------------------------------------------------------
_TESTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
_NAUTOBOT_CSV = "nautobot_device_exports.csv"
_COCKPIT_CSV = "cockpit_devices.csv"

# Devices present in each CSV (used to assert expected call counts)
_NAUTOBOT_DEVICE_COUNT = 3  # LAB, lab-2, switch
_COCKPIT_DEVICE_COUNT = 2  # LAB (4 interface rows), lab-2 (4 interface rows)
_COCKPIT_INTERFACES_PER_DEVICE = 4

# ---------------------------------------------------------------------------
# Column mapping for Nautobot device-export format
# Deeply-nested export columns are remapped to the flat Nautobot REST field
# names; columns not accepted by the API are skipped (None).
# ---------------------------------------------------------------------------
_NAUTOBOT_COLUMN_MAPPING = {
    "name": "name",
    "serial": "serial",
    "device_type__model": "device_type",
    "status__name": "status",
    "role__name": "role",
    "platform__name": "platform",
    "location__name": "location",
    # ---- skip the rest ----
    "display": None,
    "id": None,
    "object_type": None,
    "natural_slug": None,
    "face": None,
    "local_config_context_data": None,
    "local_config_context_data_owner_object_id": None,
    "asset_tag": None,
    "position": None,
    "device_redundancy_group_priority": None,
    "vc_position": None,
    "vc_priority": None,
    "comments": None,
    "local_config_context_schema__name": None,
    "local_config_context_data_owner_content_type": None,
    "device_type__manufacturer__name": None,
    "tenant__name": None,
    "location__parent__name": None,
    "location__parent__parent__name": None,
    "rack__name": None,
    "rack__rack_group__name": None,
    "rack__rack_group__location__name": None,
    "rack__rack_group__location__parent__name": None,
    "rack__rack_group__location__parent__parent__name": None,
    "primary_ip4__parent__namespace__name": None,
    "primary_ip4__host": None,
    "primary_ip6__parent__namespace__name": None,
    "primary_ip6__host": None,
    "virtual_chassis__name": None,
    "device_redundancy_group__name": None,
    "software_version__platform__name": None,
    "software_version__version": None,
    "secrets_group__name": None,
    "controller_managed_device_group__name": None,
    "created": None,
    "last_updated": None,
    "tags": None,
    "parent_bay__device__name": None,
    "parent_bay__device__tenant__name": None,
    "parent_bay__device__location__name": None,
    "parent_bay__device__location__parent__name": None,
    "parent_bay__device__location__parent__parent__name": None,
    "parent_bay__name": None,
    "cf_last_backup": None,
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def csv_repo_dir(tmp_path):
    """Temporary directory used as the Git repository root, containing both CSV fixtures."""
    for csv_name in [_NAUTOBOT_CSV, _COCKPIT_CSV]:
        shutil.copy(os.path.join(_TESTS_DIR, csv_name), tmp_path / csv_name)
    return tmp_path


@pytest.fixture()
def task_context():
    """Minimal Celery task-context stub with a no-op update_state."""
    ctx = Mock()
    ctx.update_state = Mock()
    ctx.request = Mock()
    ctx.request.id = "test-celery-task-id"
    return ctx


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_services():
    """Return (nautobot_svc, import_svc, update_svc) with safe async defaults.

    graphql_query always returns "no devices found" so that every object is
    treated as new and routed through import_device.
    """
    nautobot_svc = MagicMock()
    nautobot_svc.graphql_query = AsyncMock(return_value={"data": {"devices": []}})
    nautobot_svc.rest_request = AsyncMock(return_value={"id": "rest-created-uuid"})

    import_svc = MagicMock()
    import_svc.import_device = AsyncMock(
        return_value={
            "success": True,
            "device_id": "created-device-uuid",
            "device_name": "imported",
            "warnings": [],
        }
    )

    update_svc = MagicMock()
    update_svc.update_device = AsyncMock(
        return_value={
            "success": True,
            "device_id": "updated-device-uuid",
            "updated_fields": [],
        }
    )

    return nautobot_svc, import_svc, update_svc


def _run(csv_repo_dir, task_context, nautobot_svc, import_svc, update_svc, **kwargs):
    """Call _run_csv_import with all external dependencies patched.

    Patches applied:
    - git_repo_manager.get_repository → returns a dummy repo object
    - git_repo_path → returns str(csv_repo_dir)
    - service_factory.build_nautobot_service → returns nautobot_svc
    - DeviceImportService constructor → returns import_svc
    - DeviceUpdateService constructor → returns update_svc
    """
    fake_repo = Mock()

    with ExitStack() as stack:
        mock_git_manager = stack.enter_context(
            patch("tasks.import_or_update_from_csv_task.git_repo_manager")
        )
        mock_git_manager.get_repository.return_value = fake_repo

        stack.enter_context(
            patch(
                "tasks.import_or_update_from_csv_task.git_repo_path",
                return_value=str(csv_repo_dir),
            )
        )

        mock_sf = stack.enter_context(
            patch("tasks.import_or_update_from_csv_task.service_factory")
        )
        mock_sf.build_nautobot_service.return_value = nautobot_svc

        stack.enter_context(
            patch(
                "tasks.import_or_update_from_csv_task.DeviceImportService",
                return_value=import_svc,
            )
        )
        stack.enter_context(
            patch(
                "tasks.import_or_update_from_csv_task.DeviceUpdateService",
                return_value=update_svc,
            )
        )

        return _run_csv_import(
            task_context=task_context,
            repo_id=1,
            **kwargs,
        )


# ---------------------------------------------------------------------------
# Test 1 – Import from Nautobot device export CSV
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestImportFromNautobotCsv:
    """Importing devices exported from Nautobot (import_format='nautobot').

    CSV: nautobot_device_exports.csv
    Devices: LAB, lab-2, switch (3 rows, one device per row)
    """

    def test_creates_all_devices_when_none_exist(self, csv_repo_dir, task_context):
        """All 3 devices are created when none are found in Nautobot.

        Verifies:
        - result is successful with 3 created, 0 updated, 0 failures
        - import_device is called exactly 3 times
        - add_prefixes_automatically=True is forwarded on every call
        """
        nautobot_svc, import_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            import_svc,
            update_svc,
            file_path=_NAUTOBOT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="nautobot",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
            column_mapping=_NAUTOBOT_COLUMN_MAPPING,
        )

        assert result["success"] is True
        assert result["dry_run"] is False
        assert result["import_type"] == "devices"

        summary = result["summary"]
        assert summary["created"] == _NAUTOBOT_DEVICE_COUNT
        assert summary["updated"] == 0
        assert summary["failed"] == 0
        assert summary["skipped"] == 0
        assert summary["files_processed"] == 1

        # One import_device call per device
        assert import_svc.import_device.call_count == _NAUTOBOT_DEVICE_COUNT

        # Every call must request automatic prefix creation
        for positional, keyword in import_svc.import_device.call_args_list:
            assert keyword.get("add_prefixes_automatically") is True

    def test_nautobot_null_sentinels_are_stripped(self, csv_repo_dir, task_context):
        """NULL/NoObject values from the Nautobot export are removed before import.

        The nautobot CSV contains many 'NULL' and 'NoObject' values. In nautobot
        format these must be filtered out so they are not sent to DeviceImportService.
        """
        nautobot_svc, import_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            import_svc,
            update_svc,
            file_path=_NAUTOBOT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="nautobot",
            column_mapping=_NAUTOBOT_COLUMN_MAPPING,
            add_prefixes=True,
            default_prefix_length="24",
        )

        _SENTINELS = {"NULL", "NoObject", "null"}

        for positional, keyword in import_svc.import_device.call_args_list:
            device_data = (
                positional[0] if positional else keyword.get("device_data", {})
            )
            # Sentinel values must not appear as top-level string fields
            for field_value in device_data.values():
                if isinstance(field_value, str):
                    assert field_value not in _SENTINELS, (
                        f"Sentinel value '{field_value}' found in device payload"
                    )


# ---------------------------------------------------------------------------
# Test 2 – Import from Cockpit device export CSV
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestImportFromCockpitCsv:
    """Importing devices exported by Cockpit itself (import_format='cockpit').

    CSV: cockpit_devices.csv
    Devices: LAB and lab-2, each represented by 4 rows (one row per interface).
    Columns are already in Nautobot-friendly format — no column_mapping needed.
    """

    def test_creates_all_devices_when_none_exist(self, csv_repo_dir, task_context):
        """Both devices are created with all their interfaces when absent from Nautobot.

        Verifies:
        - result is successful with 2 created, 0 updated, 0 failures
        - import_device is called exactly 2 times (once per unique device name)
        - add_prefixes_automatically=True is forwarded on every call
        """
        nautobot_svc, import_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            import_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
        )

        assert result["success"] is True
        assert result["dry_run"] is False
        assert result["import_type"] == "devices"

        summary = result["summary"]
        assert summary["created"] == _COCKPIT_DEVICE_COUNT
        assert summary["updated"] == 0
        assert summary["failed"] == 0
        assert summary["skipped"] == 0
        assert summary["files_processed"] == 1

        # One import_device call per unique device name
        assert import_svc.import_device.call_count == _COCKPIT_DEVICE_COUNT

        # Every call must request automatic prefix creation
        for positional, keyword in import_svc.import_device.call_args_list:
            assert keyword.get("add_prefixes_automatically") is True

    def test_all_interfaces_are_passed_per_device(self, csv_repo_dir, task_context):
        """Each device import call receives interface_config with all 4 interfaces.

        The Cockpit CSV has 4 rows per device (one row per interface).
        _process_cockpit_rows must group them and pass all interfaces in a
        single import_device call.
        """
        nautobot_svc, import_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            import_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
        )

        for positional, keyword in import_svc.import_device.call_args_list:
            interface_config = keyword.get("interface_config")
            assert interface_config is not None, "interface_config must be provided"
            assert len(interface_config) == _COCKPIT_INTERFACES_PER_DEVICE, (
                f"Expected {_COCKPIT_INTERFACES_PER_DEVICE} interfaces, "
                f"got {len(interface_config)}"
            )

    def test_set_primary_ipv4_flag_is_respected(self, csv_repo_dir, task_context):
        """Only the interface marked set_primary_ipv4=true is flagged as primary.

        In the Cockpit CSV, Ethernet0/0 has set_primary_ipv4=true and
        Ethernet0/1 has set_primary_ipv4=false.  Both carry IP addresses, but
        only the first should have is_primary_ipv4=True.
        """
        nautobot_svc, import_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            import_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
        )

        for positional, keyword in import_svc.import_device.call_args_list:
            interface_config = keyword.get("interface_config", [])

            ip_interfaces = [i for i in interface_config if i.get("ip_address")]
            primary_interfaces = [i for i in ip_interfaces if i.get("is_primary_ipv4")]
            non_primary_interfaces = [
                i for i in ip_interfaces if not i.get("is_primary_ipv4")
            ]

            # Exactly one interface is designated as primary
            assert len(primary_interfaces) == 1, (
                "Exactly one interface should have is_primary_ipv4=True"
            )
            assert primary_interfaces[0]["name"] == "Ethernet0/0"

            # The second IP-bearing interface must not be primary
            assert len(non_primary_interfaces) == 1
            assert non_primary_interfaces[0]["name"] == "Ethernet0/1"
