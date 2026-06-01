"""Unit tests for CheckMK device comparison / diff service.

All tests run offline — no real CheckMK or Nautobot instance required.

Patching strategy:
  - service_factory.build_checkmk_config_service  → _FakeConfig
  - service_factory.build_checkmk_client          → FakeCheckMKClient
  - service_factory.build_nautobot_service        → AsyncMock

DeviceComparisonService receives a query_service at construction; tests supply
a MagicMock / AsyncMock for that dependency.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.nb2cmk import DeviceComparison
from services.checkmk.sync.comparison import DeviceComparisonService
from tests.mocks import FakeCheckMKClient

# ── Helpers ────────────────────────────────────────────────────────────────────

_PATCH_CONFIG = "service_factory.build_checkmk_config_service"
_PATCH_CLIENT = "service_factory.build_checkmk_client"
_PATCH_NAUTOBOT = "service_factory.build_nautobot_service"


class _FakeConfig:
    """Minimal in-memory config for comparison tests."""

    def __init__(
        self,
        comparison_keys: list[str] | None = None,
        ignore_attributes: list[str] | None = None,
    ):
        self._keys = comparison_keys or ["attributes", "folder"]
        self._ignore = ignore_attributes or []

    def load_checkmk_config(self, force_reload: bool = False) -> dict:
        return {
            "comparison_keys": self._keys,
            "ignore_attributes": self._ignore,
        }

    def get_comparison_keys(self) -> list[str]:
        return self._keys

    def get_ignore_attributes(self) -> list[str]:
        return self._ignore

    def reload_config(self) -> None:
        pass


def _make_service(
    query_service=None,
    comparison_keys: list[str] | None = None,
    ignore_attributes: list[str] | None = None,
) -> DeviceComparisonService:
    """Construct DeviceComparisonService with a fake config and optional mock query service."""
    fake_cfg = _FakeConfig(
        comparison_keys=comparison_keys,
        ignore_attributes=ignore_attributes,
    )
    mock_query = query_service or MagicMock()
    with patch(_PATCH_CONFIG, return_value=fake_cfg):
        return DeviceComparisonService(mock_query)


def _normalized(
    hostname: str = "router1",
    folder: str = "/dc1",
    attributes: dict | None = None,
) -> dict:
    """Return a normalized device config dict as returned by get_device_normalized."""
    return {
        "folder": folder,
        "attributes": attributes if attributes is not None else {"ipaddress": "10.0.0.1"},
        "internal": {"hostname": hostname},
    }


# ══════════════════════════════════════════════════════════════════════════════
# _compare_configurations — pure logic tests (no async, no HTTP)
# ══════════════════════════════════════════════════════════════════════════════


class TestCompareConfigurations:
    """Direct unit tests for the private _compare_configurations method."""

    def setup_method(self) -> None:
        self.svc = _make_service()

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_identical_configs_return_no_differences(self) -> None:
        """Configs with identical folder and attributes → empty differences list."""
        nb = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        cmk = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert diffs == []

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_differing_attribute_value_reported(self) -> None:
        """Attribute present in both but with different values → difference reported."""
        nb = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        cmk = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.2"}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert len(diffs) == 1
        assert "ipaddress" in diffs[0]
        assert "10.0.0.1" in diffs[0]
        assert "10.0.0.2" in diffs[0]

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_attribute_present_in_nautobot_missing_in_checkmk_reported(self) -> None:
        """Attribute in Nautobot but absent from CheckMK → 'missing in CheckMK' diff."""
        nb = {
            "folder": "/dc1",
            "attributes": {"ipaddress": "10.0.0.1", "alias": "my-router"},
        }
        cmk = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert any("alias" in d and "missing in CheckMK" in d for d in diffs)

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_attribute_present_in_checkmk_missing_in_nautobot_reported(self) -> None:
        """Attribute in CheckMK but absent from Nautobot → 'missing in Nautobot' diff."""
        nb = {"folder": "/dc1", "attributes": {}}
        cmk = {"folder": "/dc1", "attributes": {"extra_attr": "stale-value"}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert any("extra_attr" in d and "missing in Nautobot" in d for d in diffs)

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_folder_difference_reported(self) -> None:
        """Different folder values → folder difference reported."""
        nb = {"folder": "/dc1", "attributes": {}}
        cmk = {"folder": "/dc2", "attributes": {}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert any("folder" in d for d in diffs)

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_ignored_attributes_not_reported(self) -> None:
        """Attributes in the ignore list are excluded from diff even when they differ."""
        svc = _make_service(ignore_attributes=["meta_data", "labels"])
        nb = {
            "folder": "/dc1",
            "attributes": {"ipaddress": "10.0.0.1", "meta_data": "nb-value"},
        }
        cmk = {
            "folder": "/dc1",
            "attributes": {"ipaddress": "10.0.0.1", "labels": {"k": "v"}},
        }
        diffs = svc._compare_configurations(nb, cmk)
        assert diffs == []

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_only_attributes_key_compared_when_folder_omitted_from_keys(self) -> None:
        """comparison_keys containing only 'attributes' → folder differences ignored."""
        svc = _make_service(comparison_keys=["attributes"])
        nb = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        cmk = {
            "folder": "/COMPLETELY-DIFFERENT",
            "attributes": {"ipaddress": "10.0.0.1"},
        }
        diffs = svc._compare_configurations(nb, cmk)
        assert diffs == []

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_multiple_attribute_differences_all_reported(self) -> None:
        """Multiple differing attributes → all reported as individual diff entries."""
        nb = {
            "folder": "/dc1",
            "attributes": {"ipaddress": "10.0.0.1", "alias": "router-a"},
        }
        cmk = {
            "folder": "/dc1",
            "attributes": {"ipaddress": "10.0.0.2", "alias": "router-b"},
        }
        diffs = self.svc._compare_configurations(nb, cmk)
        assert len(diffs) == 2


# ══════════════════════════════════════════════════════════════════════════════
# filter_diff_by_ignored_attributes — static method
# ══════════════════════════════════════════════════════════════════════════════


class TestFilterDiffByIgnoredAttributes:
    """Unit tests for the static filter_diff_by_ignored_attributes helper."""

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_removes_ignored_attribute_from_diff_text(self) -> None:
        """Diff entry mentioning an ignored attribute is removed."""
        diff = (
            "attributes.'meta_data': Present in CheckMK ('val') but missing in Nautobot; "
            "attributes.'ipaddress': Nautobot='10.0.0.1' vs CheckMK='10.0.0.2'"
        )
        result = DeviceComparisonService.filter_diff_by_ignored_attributes(diff, ["meta_data"])
        assert "meta_data" not in result
        assert "ipaddress" in result

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_empty_diff_text_returned_unchanged(self) -> None:
        """Empty diff text is returned as-is regardless of ignored list."""
        result = DeviceComparisonService.filter_diff_by_ignored_attributes("", ["meta_data"])
        assert result == ""

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_empty_ignored_list_returns_diff_unchanged(self) -> None:
        """No ignored attributes → original diff text returned unchanged."""
        diff = "attributes.'ipaddress': Nautobot='10.0.0.1' vs CheckMK='10.0.0.2'"
        result = DeviceComparisonService.filter_diff_by_ignored_attributes(diff, [])
        assert result == diff

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_all_entries_ignored_returns_empty_string(self) -> None:
        """All diff entries ignored → empty string returned."""
        diff = "attributes.'meta_data': val1 vs val2"
        result = DeviceComparisonService.filter_diff_by_ignored_attributes(diff, ["meta_data"])
        assert result == ""


# ══════════════════════════════════════════════════════════════════════════════
# compare_device_config — async, uses CheckMK client
# ══════════════════════════════════════════════════════════════════════════════


class TestCompareDeviceConfig:
    """Tests for the async compare_device_config method."""

    def _setup(self, normalized: dict | None = None):
        """Return (service, mock_query, fake_client) ready for compare_device_config tests."""
        mock_query = MagicMock()
        mock_query.get_device_normalized = AsyncMock(return_value=normalized or _normalized())
        svc = _make_service(query_service=mock_query)
        return svc, mock_query, FakeCheckMKClient()

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_host_not_found_in_checkmk_returns_host_not_found_result(
        self,
    ) -> None:
        """FakeCheckMKClient with no hosts seeded → result='host_not_found'."""
        svc, _, fake_client = self._setup()
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        assert result.result == "host_not_found"
        assert "router1" in result.diff

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_matching_configs_return_equal_result(self) -> None:
        """Normalized config and CheckMK config match → result='equal'."""
        normalized = _normalized(folder="/dc1", attributes={"ipaddress": "10.0.0.1"})
        svc, _, fake_client = self._setup(normalized)
        # CheckMK host has same folder and attributes
        fake_client.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        assert result.result == "equal"
        assert result.diff == ""

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_differing_attribute_returns_diff_result(self) -> None:
        """Normalized IP differs from CheckMK IP → result='diff' with description."""
        normalized = _normalized(folder="/dc1", attributes={"ipaddress": "10.0.0.1"})
        svc, _, fake_client = self._setup(normalized)
        fake_client.seed_host("router1", {"ipaddress": "10.0.0.2"}, folder="/dc1")
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        assert result.result == "diff"
        assert "ipaddress" in result.diff

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_differing_folder_returns_diff_result(self) -> None:
        """Normalized folder differs from CheckMK folder → result='diff'."""
        normalized = _normalized(folder="/dc1", attributes={})
        svc, _, fake_client = self._setup(normalized)
        fake_client.seed_host("router1", {}, folder="/dc2")
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        assert result.result == "diff"
        assert "folder" in result.diff

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_result_includes_normalized_and_checkmk_configs(self) -> None:
        """compare_device_config populates normalized_config and checkmk_config fields."""
        normalized = _normalized(folder="/dc1", attributes={"ipaddress": "10.0.0.1"})
        svc, _, fake_client = self._setup(normalized)
        fake_client.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        assert "attributes" in result.normalized_config
        assert result.checkmk_config is not None

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_missing_hostname_in_normalized_raises_http_400(self) -> None:
        """Normalized config without internal.hostname → HTTPException 400."""
        from fastapi import HTTPException

        bad_normalized = {"folder": "/dc1", "attributes": {}, "internal": {}}
        mock_query = MagicMock()
        mock_query.get_device_normalized = AsyncMock(return_value=bad_normalized)
        svc = _make_service(query_service=mock_query)
        fake_client = FakeCheckMKClient()
        with patch(_PATCH_CLIENT, return_value=fake_client):
            with pytest.raises(HTTPException) as exc_info:
                await svc.compare_device_config("device-uuid")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_meta_data_stripped_from_checkmk_attrs_before_comparison(
        self,
    ) -> None:
        """meta_data key present in CheckMK attributes is removed before comparison."""
        normalized = _normalized(folder="/dc1", attributes={"ipaddress": "10.0.0.1"})
        svc, _, fake_client = self._setup(normalized)
        # CheckMK host has meta_data which should be removed
        fake_client.seed_host(
            "router1",
            {"ipaddress": "10.0.0.1", "meta_data": {"created_at": "2024-01-01"}},
            folder="/dc1",
        )
        with patch(_PATCH_CLIENT, return_value=fake_client):
            result = await svc.compare_device_config("device-uuid")
        # meta_data difference should not affect result when it's stripped
        assert result.result == "equal"


# ══════════════════════════════════════════════════════════════════════════════
# get_devices_diff — async, uses Nautobot service + compare_device_config
# ══════════════════════════════════════════════════════════════════════════════


def _nautobot_device(
    device_id: str = "abc123",
    name: str = "router1",
    role: str = "Router",
    location: str = "DC1",
    status: str = "Active",
) -> dict:
    return {
        "id": device_id,
        "name": name,
        "role": {"name": role},
        "location": {"name": location},
        "status": {"name": status},
    }


class TestGetDevicesDiff:
    """Tests for the get_devices_diff facade method."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_device_with_host_not_found_status_mapped_to_missing(self) -> None:
        """compare_device_config returns 'host_not_found' → checkmk_status='missing'."""
        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"data": {"devices": [_nautobot_device()]}}
        comparison = DeviceComparison(
            result="host_not_found",
            diff="Host 'router1' not found in CheckMK",
        )
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with patch.object(svc, "compare_device_config", new=AsyncMock(return_value=comparison)):
                result = await svc.get_devices_diff()

        assert result.total == 1
        assert result.devices[0]["checkmk_status"] == "missing"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_device_with_equal_status_preserved(self) -> None:
        """compare_device_config returns 'equal' → checkmk_status='equal'."""
        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"data": {"devices": [_nautobot_device()]}}
        comparison = DeviceComparison(result="equal")
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with patch.object(svc, "compare_device_config", new=AsyncMock(return_value=comparison)):
                result = await svc.get_devices_diff()

        assert result.devices[0]["checkmk_status"] == "equal"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_device_with_diff_status_preserved(self) -> None:
        """compare_device_config returns 'diff' → checkmk_status='diff'."""
        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"data": {"devices": [_nautobot_device()]}}
        comparison = DeviceComparison(result="diff", diff="attributes.'ipaddress': differs")
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with patch.object(svc, "compare_device_config", new=AsyncMock(return_value=comparison)):
                result = await svc.get_devices_diff()

        assert result.devices[0]["checkmk_status"] == "diff"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_compare_error_sets_error_status(self) -> None:
        """Unexpected exception in compare_device_config → checkmk_status='error'."""
        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"data": {"devices": [_nautobot_device()]}}
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with patch.object(
                svc,
                "compare_device_config",
                new=AsyncMock(side_effect=RuntimeError("unexpected")),
            ):
                result = await svc.get_devices_diff()

        assert result.devices[0]["checkmk_status"] == "error"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_multiple_devices_all_included_in_result(self) -> None:
        """Multiple Nautobot devices → all present in DeviceListWithStatus."""
        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {
            "data": {
                "devices": [
                    _nautobot_device("id1", "router1"),
                    _nautobot_device("id2", "switch1"),
                    _nautobot_device("id3", "firewall1"),
                ]
            }
        }
        comparison = DeviceComparison(result="equal")
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with patch.object(svc, "compare_device_config", new=AsyncMock(return_value=comparison)):
                result = await svc.get_devices_diff()

        assert result.total == 3
        names = {d["name"] for d in result.devices}
        assert names == {"router1", "switch1", "firewall1"}

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_graphql_errors_raise_http_500(self) -> None:
        """GraphQL response containing 'errors' → HTTPException 500 raised."""
        from fastapi import HTTPException

        svc = _make_service()
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"errors": [{"message": "query failed"}]}
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            with pytest.raises(HTTPException) as exc_info:
                await svc.get_devices_diff()

        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.checkmk
    async def test_result_includes_ignored_attributes_from_config(self) -> None:
        """DeviceListWithStatus.ignored_attributes reflects the config."""
        svc = _make_service(ignore_attributes=["meta_data", "labels"])
        mock_nautobot = AsyncMock()
        mock_nautobot.graphql_query.return_value = {"data": {"devices": []}}
        with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
            result = await svc.get_devices_diff()

        assert "meta_data" in result.ignored_attributes
        assert "labels" in result.ignored_attributes
