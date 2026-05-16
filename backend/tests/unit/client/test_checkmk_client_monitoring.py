"""Unit tests for _MonitoringMixin, _DiscoveryMixin, _ProblemsMixin.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.checkmk.client import CheckMKClient


def _make_client() -> CheckMKClient:
    return CheckMKClient(
        host="checkmk.test",
        site_name="monitoring",
        username="testuser",
        password="testpass",
        protocol="https",
        verify_ssl=False,
    )


def _mock_response(
    status_code: int,
    data: dict | None = None,
    headers: dict | None = None,
) -> MagicMock:
    m = MagicMock()
    m.status_code = status_code
    m.content = b'{"ok": true}' if data is not None else b""
    m.json.return_value = data if data is not None else {}
    m.headers = headers or {}
    m.text = str(data) if data else ""
    return m


# ── get_all_monitored_hosts ────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_monitored_hosts_posts_to_host_collection():
    """get_all_monitored_hosts POSTs to the live host collection."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_monitored_hosts()

    assert req.call_args.kwargs["method"] == "POST"
    assert "domain-types/host/collections/all" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_monitored_hosts_sends_columns_in_body():
    """columns list is forwarded in the JSON body when provided."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_monitored_hosts(columns=["name", "state"])

    assert req.call_args.kwargs["json"]["columns"] == ["name", "state"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_monitored_hosts_sends_query_in_body():
    """query string is forwarded in the JSON body when provided."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_monitored_hosts(query='[["state", "=", 1]]')

    assert req.call_args.kwargs["json"]["query"] == '[["state", "=", 1]]'


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_monitored_hosts_sends_empty_body_when_no_filters():
    """Without columns or query, an empty JSON body is sent."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_monitored_hosts()

    assert req.call_args.kwargs["json"] == {}


# ── get_monitored_host ─────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_monitored_host_posts_to_show_service_action():
    """get_monitored_host POSTs to the show_service action on the host."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "router1"})
    ) as req:
        client.get_monitored_host("router1")

    url = req.call_args.kwargs["url"]
    assert "objects/host/router1" in url
    assert "show_service" in url
    assert req.call_args.kwargs["method"] == "POST"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_monitored_host_includes_columns_when_provided():
    """Columns are forwarded in the body when specified."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "r"})
    ) as req:
        client.get_monitored_host("router1", columns=["name", "address"])

    assert req.call_args.kwargs["json"]["columns"] == ["name", "address"]


# ── get_host_services ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_services_gets_services_collection():
    """get_host_services GETs the services sub-collection for the host."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_host_services("router1")

    assert req.call_args.kwargs["method"] == "GET"
    assert "objects/host/router1/collections/services" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_services_passes_columns_as_query_param():
    """columns are sent as query params, not JSON body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_host_services("router1", columns=["description", "state"])

    assert req.call_args.kwargs["params"]["columns"] == ["description", "state"]


# ── show_service ───────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_show_service_sends_service_description_in_body():
    """show_service includes service_description in the POST body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "CPU"})
    ) as req:
        client.show_service("router1", "CPU load")

    body = req.call_args.kwargs["json"]
    assert body["service_description"] == "CPU load"
    assert "show_service" in req.call_args.kwargs["url"]


# ── get_service_discovery ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_service_discovery_gets_discovery_resource():
    """get_service_discovery GETs the service_discovery resource for the host."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "router1"})
    ) as req:
        client.get_service_discovery("router1")

    assert req.call_args.kwargs["method"] == "GET"
    assert "objects/service_discovery/router1" in req.call_args.kwargs["url"]


# ── start_service_discovery ────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_start_service_discovery_sends_hostname_and_mode():
    """start_service_discovery POSTs host_name and mode in the body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "run1"})
    ) as req:
        client.start_service_discovery("router1", mode="new")

    body = req.call_args.kwargs["json"]
    assert body["host_name"] == "router1"
    assert body["mode"] == "new"
    assert "service_discovery_run" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_start_service_discovery_defaults_mode_to_new():
    """Default discovery mode is 'new'."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "r"})
    ) as req:
        client.start_service_discovery("router1")

    assert req.call_args.kwargs["json"]["mode"] == "new"


# ── wait_for_service_discovery ─────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_wait_for_service_discovery_posts_host_name():
    """wait_for_service_discovery POSTs to the wait-for-completion endpoint."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"done": True})
    ) as req:
        client.wait_for_service_discovery("router1")

    assert req.call_args.kwargs["method"] == "POST"
    assert "wait-for-completion" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["json"]["host_name"] == "router1"


# ── update_discovery_phase ─────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_discovery_phase_forwards_kwargs_as_json_body():
    """Arbitrary kwargs are forwarded as the POST body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.update_discovery_phase("router1", action="fix_all", phase="done")

    body = req.call_args.kwargs["json"]
    assert body["action"] == "fix_all"
    assert body["phase"] == "done"
    assert "update_discovery_phase" in req.call_args.kwargs["url"]
    assert "router1" in req.call_args.kwargs["url"]


# ── start_bulk_discovery ───────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_start_bulk_discovery_sends_hostnames_and_options():
    """start_bulk_discovery POSTs hostnames and options to the bulk endpoint."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "bulk1"})
    ) as req:
        client.start_bulk_discovery(["h1", "h2"])

    body = req.call_args.kwargs["json"]
    assert body["hostnames"] == ["h1", "h2"]
    assert "monitor_undecided_services" in body["options"]
    assert "bulk-discovery-start" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_start_bulk_discovery_204_returns_success_dict():
    """A 204 response means discovery started — returns success sentinel instead of empty."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(204)):
        result = client.start_bulk_discovery(["h1"])

    assert result == {"success": True, "message": "Bulk discovery started"}


@pytest.mark.unit
@pytest.mark.checkmk
def test_start_bulk_discovery_uses_custom_options_when_provided():
    """Custom options override the default option dict."""
    client = _make_client()
    custom_options = {"monitor_undecided_services": False}
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.start_bulk_discovery(["h1"], options=custom_options)

    assert req.call_args.kwargs["json"]["options"] == custom_options


# ── acknowledge_host_problem ───────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_acknowledge_host_problem_sends_correct_body():
    """acknowledge_host_problem POSTs host_name, comment, and boolean flags."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.acknowledge_host_problem("router1", "maintenance", sticky=True, notify=True)

    body = req.call_args.kwargs["json"]
    assert body["host_name"] == "router1"
    assert body["comment"] == "maintenance"
    assert body["sticky"] is True
    assert body["notify"] is True
    assert body["persistent"] is False
    assert "domain-types/acknowledge/collections/host" in req.call_args.kwargs["url"]


# ── acknowledge_service_problem ────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_acknowledge_service_problem_includes_service_description():
    """acknowledge_service_problem includes service_description in the body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.acknowledge_service_problem("router1", "CPU load", "high CPU")

    body = req.call_args.kwargs["json"]
    assert body["service_description"] == "CPU load"
    assert body["host_name"] == "router1"
    assert "domain-types/acknowledge/collections/service" in req.call_args.kwargs["url"]


# ── delete_acknowledgment ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_acknowledgment_sends_delete_id_and_returns_true():
    """delete_acknowledgment POSTs the ack ID and returns True."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        result = client.delete_acknowledgment("ack-123")

    assert req.call_args.kwargs["json"] == {"delete_id": "ack-123"}
    assert "domain-types/acknowledge/actions/delete" in req.call_args.kwargs["url"]
    assert result is True


# ── create_host_downtime ───────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_downtime_sends_timing_and_type():
    """create_host_downtime sends host_name, start/end times, and downtime_type."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "dt1"})
    ) as req:
        client.create_host_downtime(
            "router1",
            start_time="2024-01-01T00:00:00Z",
            end_time="2024-01-01T04:00:00Z",
        )

    body = req.call_args.kwargs["json"]
    assert body["host_name"] == "router1"
    assert body["start_time"] == "2024-01-01T00:00:00Z"
    assert body["end_time"] == "2024-01-01T04:00:00Z"
    assert body["downtime_type"] == "fixed"
    assert "domain-types/downtime/collections/host" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_downtime_uses_custom_comment():
    """Custom comment overrides the default 'Scheduled downtime'."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "dt1"})
    ) as req:
        client.create_host_downtime("h", "2024-01-01T00:00:00Z", "2024-01-01T01:00:00Z", comment="hw maintenance")

    assert req.call_args.kwargs["json"]["comment"] == "hw maintenance"


# ── add_host_comment ───────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_add_host_comment_sends_correct_body():
    """add_host_comment POSTs host_name, comment, and persistent flag."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.add_host_comment("router1", "check cables", persistent=True)

    body = req.call_args.kwargs["json"]
    assert body["host_name"] == "router1"
    assert body["comment"] == "check cables"
    assert body["persistent"] is True
    assert "domain-types/comment/collections/host" in req.call_args.kwargs["url"]


# ── add_service_comment ────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_add_service_comment_includes_service_description():
    """add_service_comment includes service_description in the body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.add_service_comment("router1", "CPU load", "expected during backup")

    body = req.call_args.kwargs["json"]
    assert body["service_description"] == "CPU load"
    assert body["host_name"] == "router1"
    assert body["comment"] == "expected during backup"
    assert "domain-types/comment/collections/service" in req.call_args.kwargs["url"]
