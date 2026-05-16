"""Unit tests for tasks/execution/scan_prefixes_executor.py.

Covers execute_scan_prefixes() — the executor that scans Nautobot prefixes.
All tests run offline — no Nautobot, CheckMK, or database connections required.

REGRESSION TESTS: tests marked with "→ RED before fix" currently fail because
the executor contains a broken import:
    from tasks.scan_prefixes_task import _execute_scan_prefixes
That symbol does not exist in scan_prefixes_task.py. The ImportError is caught
by the executor's except block and returned as {'success': False}. The fix is
to replace the import with a direct PrefixScanService().execute() call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.scan_prefixes_executor import execute_scan_prefixes

# After the fix, the executor will import PrefixScanService from here (lazy import
# inside the function body), so this is the correct patch target.
_PATCH_SCAN_SERVICE = "services.network.scanning.prefix_scan_service.PrefixScanService"

_SCAN_TEMPLATE = {
    "name": "test",
    "scan_custom_field_name": "managed_by",
    "scan_custom_field_value": "cockpit",
    "scan_response_custom_field_name": "ping_status",
    "scan_set_reachable_ip_active": True,
    "scan_resolve_dns": False,
    "scan_ping_count": 3,
    "scan_timeout_ms": 500,
    "scan_retries": 3,
    "scan_interval_ms": 10,
    "scan_max_ips": None,
}

_SCAN_SUCCESS = {
    "success": True,
    "reachable": 5,
    "unreachable": 2,
    "total": 7,
}


def _task_ctx() -> MagicMock:
    ctx = MagicMock()
    ctx.update_state = MagicMock()
    return ctx


# ── happy path ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_execute_scan_prefixes_success():
    """Valid template → executor delegates to PrefixScanService and returns its result.

    → RED before fix: ImportError causes success=False instead of True.
    """
    mock_cls = MagicMock()
    mock_cls.return_value.execute.return_value = _SCAN_SUCCESS

    with patch(_PATCH_SCAN_SERVICE, mock_cls):
        result = execute_scan_prefixes(
            schedule_id=33,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=_task_ctx(),
            template=_SCAN_TEMPLATE,
            job_run_id=856,
        )

    assert result["success"] is True
    assert result["total"] == 7
    mock_cls.return_value.execute.assert_called_once()


# ── missing / incomplete template ─────────────────────────────────────────────


@pytest.mark.unit
def test_execute_scan_prefixes_missing_template():
    """No template provided → success=False with a message referencing the template.

    → RED before fix: error message says 'cannot import name _execute_scan_prefixes'
      rather than anything about the missing template, so the 'template' substring
      check fails.
    """
    mock_cls = MagicMock()

    with patch(_PATCH_SCAN_SERVICE, mock_cls):
        result = execute_scan_prefixes(
            schedule_id=33,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=_task_ctx(),
            template=None,
            job_run_id=856,
        )

    assert result["success"] is False
    assert "template" in result["error"].lower()
    mock_cls.return_value.execute.assert_not_called()


@pytest.mark.unit
def test_execute_scan_prefixes_missing_custom_field_name():
    """Template without scan_custom_field_name → success=False, PrefixScanService not called."""
    template = {**_SCAN_TEMPLATE, "scan_custom_field_name": None}
    mock_cls = MagicMock()

    with patch(_PATCH_SCAN_SERVICE, mock_cls):
        result = execute_scan_prefixes(
            schedule_id=33,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=_task_ctx(),
            template=template,
            job_run_id=856,
        )

    assert result["success"] is False
    mock_cls.return_value.execute.assert_not_called()


@pytest.mark.unit
def test_execute_scan_prefixes_missing_custom_field_value():
    """Template without scan_custom_field_value → success=False, PrefixScanService not called."""
    template = {**_SCAN_TEMPLATE, "scan_custom_field_value": None}
    mock_cls = MagicMock()

    with patch(_PATCH_SCAN_SERVICE, mock_cls):
        result = execute_scan_prefixes(
            schedule_id=33,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=_task_ctx(),
            template=template,
            job_run_id=856,
        )

    assert result["success"] is False
    mock_cls.return_value.execute.assert_not_called()


# ── kwargs forwarding ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_execute_scan_prefixes_forwards_scan_options():
    """Non-default scan options from the template are forwarded to PrefixScanService.execute.

    → RED before fix: ImportError causes success=False before kwargs are ever forwarded.
    """
    template = {
        **_SCAN_TEMPLATE,
        "scan_resolve_dns": True,
        "scan_ping_count": 5,
        "scan_timeout_ms": 1000,
        "scan_retries": 1,
        "scan_interval_ms": 20,
        "scan_max_ips": 500,
    }
    mock_cls = MagicMock()
    mock_cls.return_value.execute.return_value = _SCAN_SUCCESS

    with patch(_PATCH_SCAN_SERVICE, mock_cls):
        result = execute_scan_prefixes(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=_task_ctx(),
            template=template,
            job_run_id=856,
        )

    assert result["success"] is True
    call_kwargs = mock_cls.return_value.execute.call_args.kwargs
    assert call_kwargs["resolve_dns"] is True
    assert call_kwargs["ping_count"] == 5
    assert call_kwargs["timeout_ms"] == 1000
    assert call_kwargs["retries"] == 1
    assert call_kwargs["interval_ms"] == 20
    assert call_kwargs["scan_max_ips"] == 500
