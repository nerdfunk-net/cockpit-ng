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

from services.nautobot.imports.csv_import_service import CsvImportService

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
    """Return (nautobot_svc, creation_svc, update_svc) with safe async defaults.

    graphql_query always returns "no devices found" so that every object is
    treated as new and routed through create_device_with_interfaces.
    """
    nautobot_svc = MagicMock()
    nautobot_svc.graphql_query = AsyncMock(return_value={"data": {"devices": []}})
    nautobot_svc.rest_request = AsyncMock(return_value={"id": "rest-created-uuid"})

    creation_svc = MagicMock()
    creation_svc.create_device_with_interfaces = AsyncMock(
        return_value={
            "success": True,
            "device_id": "created-device-uuid",
            "workflow_status": {},
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

    return nautobot_svc, creation_svc, update_svc


def _created_requests(creation_svc):
    """Return the AddDeviceRequest objects passed to create_device_with_interfaces."""
    return [
        positional[0] if positional else keyword["request"]
        for positional, keyword in creation_svc.create_device_with_interfaces.call_args_list
    ]


def _run(csv_repo_dir, task_context, nautobot_svc, creation_svc, update_svc, **kwargs):
    """Call CsvImportService.run_import with all external dependencies patched.

    Patches applied:
    - git_repo_manager.get_repository → returns a dummy repo object
    - git_repo_path → returns str(csv_repo_dir)
    - service_factory.build_nautobot_service → returns nautobot_svc
    - DeviceCreationService constructor → returns creation_svc
    - DeviceUpdateService constructor → returns update_svc
    """
    _MODULE = "services.nautobot.imports.csv_import_service"
    fake_repo = Mock()

    with ExitStack() as stack:
        mock_git_manager = stack.enter_context(patch(f"{_MODULE}.git_repo_manager"))
        mock_git_manager.get_repository.return_value = fake_repo

        stack.enter_context(
            patch(
                f"{_MODULE}.git_repo_path",
                return_value=str(csv_repo_dir),
            )
        )

        mock_sf = stack.enter_context(patch(f"{_MODULE}.service_factory"))
        mock_sf.build_nautobot_service.return_value = nautobot_svc

        stack.enter_context(
            patch(
                f"{_MODULE}.DeviceCreationService",
                return_value=creation_svc,
            )
        )
        stack.enter_context(
            patch(
                f"{_MODULE}.DeviceUpdateService",
                return_value=update_svc,
            )
        )

        return CsvImportService().run_import(
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
        - create_device_with_interfaces is called exactly 3 times
        - add_prefix=True is forwarded on every request
        """
        nautobot_svc, creation_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
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

        # One create_device_with_interfaces call per device
        requests = _created_requests(creation_svc)
        assert len(requests) == _NAUTOBOT_DEVICE_COUNT

        # Every request must ask for automatic prefix creation
        for request in requests:
            assert request.add_prefix is True
            assert request.default_prefix_length == "/24"

    def test_nautobot_null_sentinels_are_stripped(self, csv_repo_dir, task_context):
        """NULL/NoObject values from the Nautobot export are removed before import.

        The nautobot CSV contains many 'NULL' and 'NoObject' values. In nautobot
        format these must be filtered out so they are not sent to the creation service.
        """
        nautobot_svc, creation_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
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

        for request in _created_requests(creation_svc):
            # Sentinel values must not appear as top-level string fields
            for field_value in request.model_dump().values():
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
        - create_device_with_interfaces is called exactly 2 times (once per
          unique device name)
        - add_prefix=True is forwarded on every request
        """
        nautobot_svc, creation_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
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

        # One create_device_with_interfaces call per unique device name
        requests = _created_requests(creation_svc)
        assert len(requests) == _COCKPIT_DEVICE_COUNT

        # Every request must ask for automatic prefix creation
        for request in requests:
            assert request.add_prefix is True

    def test_all_interfaces_are_passed_per_device(self, csv_repo_dir, task_context):
        """Each device creation request carries all 4 interfaces.

        The Cockpit CSV has 4 rows per device (one row per interface).
        _process_cockpit_rows must group them and pass all interfaces in a
        single create_device_with_interfaces call.
        """
        nautobot_svc, creation_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
        )

        for request in _created_requests(creation_svc):
            assert len(request.interfaces) == _COCKPIT_INTERFACES_PER_DEVICE, (
                f"Expected {_COCKPIT_INTERFACES_PER_DEVICE} interfaces, "
                f"got {len(request.interfaces)}"
            )

    def test_set_primary_ipv4_flag_is_respected(self, csv_repo_dir, task_context):
        """Only the interface marked set_primary_ipv4=true is flagged as primary.

        In the Cockpit CSV, Ethernet0/0 has set_primary_ipv4=true and
        Ethernet0/1 has set_primary_ipv4=false.  Both carry IP addresses, but
        only the first should have its IP marked is_primary=True.
        """
        nautobot_svc, creation_svc, update_svc = _make_services()

        _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            add_prefixes=True,
            default_prefix_length="24",
        )

        for request in _created_requests(creation_svc):
            ip_interfaces = [i for i in request.interfaces if i.ip_addresses]
            primary_interfaces = [
                i for i in ip_interfaces if i.ip_addresses[0].is_primary
            ]
            non_primary_interfaces = [
                i for i in ip_interfaces if not i.ip_addresses[0].is_primary
            ]

            # Exactly one interface is designated as primary
            assert len(primary_interfaces) == 1, (
                "Exactly one interface should have a primary IP"
            )
            assert primary_interfaces[0].name == "Ethernet0/0"

            # The second IP-bearing interface must not be primary
            assert len(non_primary_interfaces) == 1
            assert non_primary_interfaces[0].name == "Ethernet0/1"


# ---------------------------------------------------------------------------
# Test 3 – Behavior flags and data sources (import_unknown, profile, agent)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestImportBehaviorFlags:
    """import_unknown gating, profile-based defaults, and the agent data source."""

    def test_import_unknown_disabled_skips_creation(self, csv_repo_dir, task_context):
        """With import_unknown=False, unknown devices are skipped, not created."""
        nautobot_svc, creation_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
            update_svc,
            file_path=_COCKPIT_CSV,
            import_type="devices",
            primary_key="name",
            import_format="cockpit",
            update_existing=True,
            import_unknown=False,
        )

        assert result["success"] is True
        summary = result["summary"]
        assert summary["created"] == 0
        assert summary["skipped"] == _COCKPIT_DEVICE_COUNT
        assert summary["failed"] == 0
        creation_svc.create_device_with_interfaces.assert_not_called()

    def test_profile_defaults_fill_blank_fields(self, csv_repo_dir, task_context):
        """Profile values fill fields the CSV does not provide; CSV values win."""
        minimal_csv = csv_repo_dir / "minimal.csv"
        minimal_csv.write_text("name,serial,status\ndev1,SN1,Active\n")

        nautobot_svc, creation_svc, update_svc = _make_services()

        profile_svc = MagicMock()
        profile_svc.get.return_value = {
            "id": 7,
            "name": "Network",
            "device_status": "Planned",
            "device_role": "Switch",
            "location": "Berlin",
            "device_type": "Linux",
            "platform": "Cisco IOS",
            "interface_status": "Active",
            "interface_type": "other",
            "namespace": "Global",
        }

        with patch(
            "services.settings.profile_service.ProfileService",
            return_value=profile_svc,
        ):
            result = _run(
                csv_repo_dir,
                task_context,
                nautobot_svc,
                creation_svc,
                update_svc,
                file_path="minimal.csv",
                import_type="devices",
                primary_key="name",
                import_format="generic",
                profile_id=7,
            )

        assert result["summary"]["created"] == 1
        request = _created_requests(creation_svc)[0]
        # Profile fills the blanks…
        assert request.role == "Switch"
        assert request.location == "Berlin"
        assert request.device_type == "Linux"
        # …but the CSV value wins where present
        assert request.status == "Active"

    def test_missing_required_fields_without_profile_skips(
        self, csv_repo_dir, task_context
    ):
        """Without a profile, rows lacking required creation fields are skipped."""
        minimal_csv = csv_repo_dir / "minimal.csv"
        minimal_csv.write_text("name,serial\ndev1,SN1\n")

        nautobot_svc, creation_svc, update_svc = _make_services()

        result = _run(
            csv_repo_dir,
            task_context,
            nautobot_svc,
            creation_svc,
            update_svc,
            file_path="minimal.csv",
            import_type="devices",
            primary_key="name",
            import_format="generic",
        )

        assert result["summary"]["created"] == 0
        assert result["summary"]["skipped"] == 1
        creation_svc.create_device_with_interfaces.assert_not_called()

    def test_agent_source_processes_flow_blocks(self, csv_repo_dir, task_context):
        """source='agent' fetches CSV text per flow and processes each block."""
        nautobot_svc, creation_svc, update_svc = _make_services()

        agent_svc = MagicMock()
        agent_svc.send_get_data.return_value = {
            "status": "success",
            "output": {
                "result": {
                    "servers": (
                        "name,role,status,location,device_type\n"
                        "dev1,Server,Active,Berlin,Linux\n"
                        "dev2,Server,Active,Berlin,Linux\n"
                    )
                }
            },
        }

        with (
            patch("core.database.SessionLocal", return_value=MagicMock()),
            patch(
                "services.cockpit_agent.cockpit_agent_service.CockpitAgentService",
                return_value=agent_svc,
            ),
        ):
            result = _run(
                csv_repo_dir,
                task_context,
                nautobot_svc,
                creation_svc,
                update_svc,
                source="agent",
                agent_id="agent-1",
                agent_flows=["flow1"],
                import_type="devices",
                primary_key="name",
                import_format="generic",
            )

        assert result["success"] is True
        assert result["summary"]["created"] == 2
        agent_svc.send_get_data.assert_called_once_with(
            agent_id="agent-1", flow_id="flow1", sent_by="scheduler"
        )
