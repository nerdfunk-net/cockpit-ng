"""Unit tests for tasks/ip_addresses_task.py.

Covers the pure resolve_date_template helper and the ip_addresses_task Celery task.
All tests run offline — no Nautobot, Redis, or database required.
"""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest

from tasks.ip_addresses_task import ip_addresses_task, resolve_date_template

_PATCH_IP_SERVICE = "services.nautobot.ip_addresses.IPAddressQueryService"


def _make_ip_service(
    ip_list: list | None = None,
    delete_ok: bool = True,
) -> MagicMock:
    svc = MagicMock()
    svc.list_ip_addresses.return_value = ip_list or []
    svc.delete_ip_address.return_value = delete_ok
    return svc


# ── resolve_date_template ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_resolve_date_template_today():
    """{today} resolves to today's ISO date."""
    result = resolve_date_template("{today}")
    assert result == date.today().isoformat()


@pytest.mark.unit
def test_resolve_date_template_today_minus_14():
    """{today-14} resolves to 14 days ago."""
    expected = (date.today() - timedelta(days=14)).isoformat()
    assert resolve_date_template("{today-14}") == expected


@pytest.mark.unit
def test_resolve_date_template_today_plus_7():
    """{today+7} resolves to 7 days in the future."""
    expected = (date.today() + timedelta(days=7)).isoformat()
    assert resolve_date_template("{today+7}") == expected


@pytest.mark.unit
def test_resolve_date_template_plain_text_unchanged():
    """A string without a template token is returned as-is."""
    assert resolve_date_template("2024-01-01") == "2024-01-01"
    assert resolve_date_template("no-template-here") == "no-template-here"


@pytest.mark.unit
def test_resolve_date_template_inline_substitution():
    """Template token is substituted when surrounded by other text."""
    today_str = date.today().isoformat()
    result = resolve_date_template("prefix_{today}_suffix")
    assert result == f"prefix_{today_str}_suffix"


# ── ip_addresses_task — list action ──────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_list_returns_ip_list():
    """List action returns success=True with ip_addresses and total."""
    fake_ips = [{"id": "uuid-1", "address": "10.0.0.1/24"}]
    mock_svc = _make_ip_service(ip_list=fake_ips)

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="list",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["success"] is True
    assert result["action"] == "list"
    assert result["ip_addresses"] == fake_ips
    assert result["total"] == 1


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_list_date_template_resolved():
    """filter_value date template is resolved before calling the service."""
    mock_svc = _make_ip_service()
    today_str = date.today().isoformat()

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            ip_addresses_task.run(
                action="list",
                filter_field="cf_last_scan",
                filter_value="{today}",
            )

    call_kwargs = mock_svc.list_ip_addresses.call_args
    assert call_kwargs.kwargs["filter_value"] == today_str


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_list_with_filter_type():
    """filter_type is passed through to the service."""
    mock_svc = _make_ip_service()

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            ip_addresses_task.run(
                action="list",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
                filter_type="lte",
            )

    mock_svc.list_ip_addresses.assert_called_once_with(
        filter_field="cf_last_scan",
        filter_value="2024-01-01",
        filter_type="lte",
        include_null=False,
    )


# ── ip_addresses_task — delete action ────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_delete_counts_correctly():
    """Delete action reports deleted/failed counts."""
    fake_ips = [
        {"id": "uuid-1", "address": "10.0.0.1/24"},
        {"id": "uuid-2", "address": "10.0.0.2/24"},
    ]
    mock_svc = _make_ip_service(ip_list=fake_ips, delete_ok=True)

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="delete",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["success"] is True
    assert result["action"] == "delete"
    assert result["total"] == 2
    assert result["deleted"] == 2
    assert result["failed"] == 0
    assert mock_svc.delete_ip_address.call_count == 2


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_delete_counts_failures():
    """IPs where delete returns False are counted as failed."""
    fake_ips = [{"id": "uuid-1"}, {"id": "uuid-2"}]
    mock_svc = _make_ip_service(ip_list=fake_ips, delete_ok=False)

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="delete",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["deleted"] == 0
    assert result["failed"] == 2


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_delete_skips_entries_without_id():
    """Entries missing an 'id' field are counted as failed, not deleted."""
    fake_ips = [{"address": "10.0.0.1/24"}]  # no 'id'
    mock_svc = _make_ip_service(ip_list=fake_ips)

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="delete",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["deleted"] == 0
    assert result["failed"] == 1
    mock_svc.delete_ip_address.assert_not_called()


# ── ip_addresses_task — error paths ──────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_unknown_action_returns_error():
    """Unknown action returns success=False without calling the service."""
    mock_svc = _make_ip_service()

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="nuke",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["success"] is False
    assert "nuke" in result["error"]
    mock_svc.list_ip_addresses.assert_not_called()


@pytest.mark.unit
@pytest.mark.nautobot
def test_ip_addresses_task_service_exception_returns_error():
    """Exception from IPAddressQueryService is caught and returned as success=False."""
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.side_effect = ConnectionError("nautobot unreachable")

    with patch.object(ip_addresses_task, "update_state"):
        with patch(_PATCH_IP_SERVICE, return_value=mock_svc):
            result = ip_addresses_task.run(
                action="list",
                filter_field="cf_last_scan",
                filter_value="2024-01-01",
            )

    assert result["success"] is False
    assert "nautobot unreachable" in result["error"]
