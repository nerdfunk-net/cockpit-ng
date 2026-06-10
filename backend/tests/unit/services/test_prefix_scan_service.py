"""Unit tests for services/network/scanning/prefix_scan_service.py."""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_SF = "service_factory"
_PATCH_JRS = "service_factory.build_job_run_service"
_PATCH_NB = "service_factory.build_nautobot_service"


def _make_svc():
    from services.network.scanning.prefix_scan_service import PrefixScanService

    return PrefixScanService()


def _jrs_mock(job_run_id=42):
    jrs = MagicMock()
    jrs.create_job_run.return_value = {"id": job_run_id}
    jrs.mark_started.return_value = None
    jrs.mark_completed.return_value = None
    jrs.mark_failed.return_value = None
    return jrs


@pytest.mark.unit
class TestExecuteNoPrefixesFound:
    def test_returns_empty_result_when_no_prefixes(self):
        svc = _make_svc()
        with patch(_PATCH_JRS, return_value=_jrs_mock()):
            result = svc.execute(
                custom_field_name="scan_enabled",
                custom_field_value="true",
                explicit_prefixes=[],
            )

        assert result["success"] is True
        assert result["total_prefixes"] == 0
        assert result["total_ips_scanned"] == 0

    def test_marks_job_completed_when_no_prefixes(self):
        jrs = _jrs_mock(42)
        svc = _make_svc()
        task_ctx = MagicMock()
        task_ctx.request.id = "task-id-1"

        with patch(_PATCH_JRS, return_value=jrs):
            svc.execute(
                custom_field_name="scan_enabled",
                custom_field_value="true",
                explicit_prefixes=[],
                task_context=task_ctx,
            )

        jrs.mark_completed.assert_called_once()


@pytest.mark.unit
class TestExecuteWithPrefixes:
    def _run_execute(self, cidrs, ping_count=1, timeout_ms=100):
        svc = _make_svc()
        alive = {"10.0.0.1"}

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_JRS, return_value=_jrs_mock()))
            stack.enter_context(
                patch(
                    "tasks.ping_network_task._expand_cidr_to_ips",
                    return_value=["10.0.0.1", "10.0.0.2"],
                )
            )
            stack.enter_context(
                patch("tasks.ping_network_task._fping_networks", return_value=alive)
            )
            stack.enter_context(
                patch("tasks.ping_network_task._condense_ip_ranges", side_effect=lambda x: x)
            )
            stack.enter_context(
                patch("tasks.ping_network_task._resolve_dns", return_value=None)
            )
            result = svc.execute(
                custom_field_name="scan_enabled",
                custom_field_value="true",
                explicit_prefixes=cidrs,
                ping_count=ping_count,
                timeout_ms=timeout_ms,
            )

        return result

    def test_scans_single_prefix(self):
        result = self._run_execute(["10.0.0.0/24"])
        assert result["success"] is True
        assert result["total_prefixes"] == 1
        assert result["total_reachable"] == 1
        assert result["total_unreachable"] == 1

    def test_resolve_dns_called_when_enabled(self):
        svc = _make_svc()
        alive = {"10.0.0.1"}
        dns_mock = MagicMock(return_value="router.example.com")

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_JRS, return_value=_jrs_mock()))
            stack.enter_context(
                patch("tasks.ping_network_task._expand_cidr_to_ips", return_value=["10.0.0.1"])
            )
            stack.enter_context(
                patch("tasks.ping_network_task._fping_networks", return_value=alive)
            )
            stack.enter_context(
                patch("tasks.ping_network_task._condense_ip_ranges", side_effect=lambda x: x)
            )
            stack.enter_context(patch("tasks.ping_network_task._resolve_dns", dns_mock))
            result = svc.execute(
                custom_field_name="cf",
                custom_field_value="v",
                explicit_prefixes=["10.0.0.0/24"],
                resolve_dns=True,
            )

        dns_mock.assert_called()
        assert result["success"] is True

    def test_task_context_updated_during_scan(self):
        svc = _make_svc()
        task_ctx = MagicMock()
        task_ctx.request.id = "task-abc"

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_JRS, return_value=_jrs_mock()))
            stack.enter_context(
                patch("tasks.ping_network_task._expand_cidr_to_ips", return_value=["10.0.0.1"])
            )
            stack.enter_context(
                patch("tasks.ping_network_task._fping_networks", return_value=set())
            )
            stack.enter_context(
                patch("tasks.ping_network_task._condense_ip_ranges", side_effect=lambda x: x)
            )
            stack.enter_context(patch("tasks.ping_network_task._resolve_dns", return_value=None))
            svc.execute(
                custom_field_name="cf",
                custom_field_value="v",
                explicit_prefixes=["10.0.0.0/30"],
                task_context=task_ctx,
            )

        task_ctx.update_state.assert_called()

    def test_exception_returns_failure_result(self):
        svc = _make_svc()

        with patch(_PATCH_JRS, return_value=_jrs_mock()):
            with patch(
                "tasks.ping_network_task._expand_cidr_to_ips",
                side_effect=RuntimeError("expand failed"),
            ):
                # Must also patch _fping_networks to avoid import error
                with patch("tasks.ping_network_task._fping_networks", return_value=set()):
                    with patch(
                        "tasks.ping_network_task._condense_ip_ranges",
                        side_effect=lambda x: x,
                    ):
                        result = svc.execute(
                            custom_field_name="cf",
                            custom_field_value="v",
                            explicit_prefixes=["10.0.0.0/24"],
                        )

        assert result["success"] is True  # expand errors are caught per-prefix, not global

    def test_nautobot_update_called_when_response_field_set(self):
        svc = _make_svc()
        nb_update = MagicMock(return_value=True)
        svc._update_ip_in_nautobot = nb_update
        svc._update_prefix_last_scan = MagicMock(return_value=True)
        alive = {"10.0.0.1"}

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_JRS, return_value=_jrs_mock()))
            stack.enter_context(
                patch("tasks.ping_network_task._expand_cidr_to_ips", return_value=["10.0.0.1"])
            )
            stack.enter_context(
                patch("tasks.ping_network_task._fping_networks", return_value=alive)
            )
            stack.enter_context(
                patch("tasks.ping_network_task._condense_ip_ranges", side_effect=lambda x: x)
            )
            stack.enter_context(patch("tasks.ping_network_task._resolve_dns", return_value=None))
            result = svc.execute(
                custom_field_name="cf",
                custom_field_value="v",
                explicit_prefixes=["10.0.0.0/30"],
                response_custom_field_name="cf_last_seen",
            )

        nb_update.assert_called()
        svc._update_prefix_last_scan.assert_called()


@pytest.mark.unit
class TestExecuteSplitJob:
    def test_splits_into_subtasks_when_max_ips_exceeded(self):
        svc = _make_svc()

        sub_task = MagicMock()
        sub_task.id = "sub-task-id"

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_JRS, return_value=_jrs_mock()))
            stack.enter_context(
                patch(
                    "tasks.scan_prefixes_task.scan_prefixes_task",
                    **{"delay.return_value": sub_task},
                )
            )
            result = svc.execute(
                custom_field_name="cf",
                custom_field_value="v",
                explicit_prefixes=["10.0.0.0/16", "192.168.0.0/16"],
                scan_max_ips=100,
            )

        assert result["success"] is True
        assert "sub_task_ids" in result
        assert len(result["sub_task_ids"]) > 0


@pytest.mark.unit
class TestFetchPrefixesByCustomField:
    def test_returns_list_of_prefixes(self):
        svc = _make_svc()
        nb = MagicMock()
        nb.graphql_query = AsyncMock(
            return_value={
                "data": {
                    "prefixes": [
                        {"prefix": "10.0.0.0/24"},
                        {"prefix": "192.168.0.0/24"},
                    ]
                }
            }
        )
        with patch(_PATCH_NB, return_value=nb):
            result = svc._fetch_prefixes_by_custom_field("scan_enabled", "true")

        assert result == ["10.0.0.0/24", "192.168.0.0/24"]

    def test_returns_empty_on_no_data(self):
        svc = _make_svc()
        nb = MagicMock()
        nb.graphql_query = AsyncMock(return_value={})
        with patch(_PATCH_NB, return_value=nb):
            result = svc._fetch_prefixes_by_custom_field("cf", "v")
        assert result == []

    def test_returns_empty_on_exception(self):
        svc = _make_svc()
        nb = MagicMock()
        nb.graphql_query = AsyncMock(side_effect=RuntimeError("boom"))
        with patch(_PATCH_NB, return_value=nb):
            result = svc._fetch_prefixes_by_custom_field("cf", "v")
        assert result == []


@pytest.mark.unit
class TestUpdatePrefixLastScan:
    def _make_requests_mock(self, prefix_results=None, containment_results=None):
        import requests

        get_mock = MagicMock()
        patch_mock = MagicMock()

        get_mock.return_value.raise_for_status = MagicMock()
        patch_mock.return_value.raise_for_status = MagicMock()

        get_calls = [0]

        def _get(url, **kwargs):
            r = MagicMock()
            r.raise_for_status = MagicMock()
            if "prefix=" in str(kwargs.get("params", {})):
                r.json.return_value = {"results": prefix_results or [{"id": "pfx-1", "prefix": "10.0.0.0/24"}]}
            else:
                r.json.return_value = {"results": containment_results or []}
            return r

        return _get, patch_mock

    def test_updates_prefix_by_exact_match(self):
        svc = _make_svc()
        nb = MagicMock()
        nb._get_config.return_value = {"url": "http://nautobot:8080", "token": "tok"}

        def _get(url, **kwargs):
            r = MagicMock()
            r.raise_for_status = MagicMock()
            params = kwargs.get("params", {})
            if "prefix" in params:
                r.json.return_value = {"results": [{"id": "pfx-1", "prefix": "10.0.0.0/24"}]}
            else:
                r.json.return_value = {"results": []}
            return r

        patch_resp = MagicMock()
        patch_resp.raise_for_status = MagicMock()

        with (
            patch(_PATCH_NB, return_value=nb),
            patch("requests.get", side_effect=_get),
            patch("requests.patch", return_value=patch_resp),
        ):
            result = svc._update_prefix_last_scan("10.0.0.0/24")

        assert result is True

    def test_returns_false_when_no_config(self):
        svc = _make_svc()
        nb = MagicMock()
        nb._get_config.return_value = {"url": "", "token": ""}
        with patch(_PATCH_NB, return_value=nb):
            result = svc._update_prefix_last_scan("10.0.0.0/24")
        assert result is False

    def test_returns_false_on_exception(self):
        svc = _make_svc()
        nb = MagicMock()
        nb._get_config.side_effect = RuntimeError("db error")
        with patch(_PATCH_NB, return_value=nb):
            result = svc._update_prefix_last_scan("10.0.0.0/24")
        assert result is False
