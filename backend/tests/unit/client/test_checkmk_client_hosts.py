"""Unit tests for _HostsMixin: URL construction, request bodies, ETag handling.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.checkmk.client import CheckMKClient
from services.checkmk.exceptions import CheckMKAPIError


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


# ── get_all_hosts ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_hosts_calls_correct_endpoint():
    """get_all_hosts uses the host_config collection endpoint."""
    client = _make_client()
    payload = {"value": []}
    with patch.object(
        client.session, "request", return_value=_mock_response(200, payload)
    ) as req:
        result = client.get_all_hosts()

    assert "domain-types/host_config/collections/all" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"
    assert result == payload


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_hosts_passes_effective_attributes_param():
    """effective_attributes=True is forwarded as a query parameter."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_hosts(effective_attributes=True)

    assert req.call_args.kwargs["params"]["effective_attributes"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_hosts_passes_site_param_when_provided():
    """Optional site filter is included in query params when given."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_hosts(site="prod-site")

    assert req.call_args.kwargs["params"]["site"] == "prod-site"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_hosts_omits_site_param_when_not_provided():
    """Site param is absent from the request when not specified."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_hosts()

    assert "site" not in req.call_args.kwargs["params"]


# ── get_host ───────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_builds_correct_url():
    """get_host includes the hostname in the resource URL."""
    client = _make_client()
    payload = {"id": "router1", "extensions": {"attributes": {}}}
    with patch.object(
        client.session, "request", return_value=_mock_response(200, payload)
    ) as req:
        result = client.get_host("router1")

    assert "objects/host_config/router1" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"
    assert result["id"] == "router1"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_raises_on_404():
    """A 404 response propagates as CheckMKAPIError."""
    client = _make_client()
    with patch.object(
        client.session,
        "request",
        return_value=_mock_response(404, {"title": "Not Found"}),
    ):
        with pytest.raises(CheckMKAPIError) as exc_info:
            client.get_host("nonexistent")

    assert exc_info.value.status_code == 404


# ── get_host_etag ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_etag_extracts_header():
    """get_host_etag returns the ETag value from the response header."""
    client = _make_client()
    with patch.object(
        client.session,
        "request",
        return_value=_mock_response(200, None, headers={"ETag": '"v42"'}),
    ):
        etag = client.get_host_etag("router1")

    assert etag == '"v42"'


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_etag_defaults_to_star_when_header_missing():
    """Missing ETag header falls back to '*'."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, None, headers={})
    ):
        etag = client.get_host_etag("router1")

    assert etag == "*"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_etag_raises_on_non_200():
    """A non-200 response raises CheckMKAPIError."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(404, None)
    ):
        with pytest.raises(CheckMKAPIError):
            client.get_host_etag("missing-host")


# ── create_host ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_posts_correct_json_body():
    """create_host sends host_name, folder, and attributes in the JSON body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "new-host"})
    ) as req:
        client.create_host(
            "new-host", folder="/dc1", attributes={"ipaddress": "10.0.0.1"}
        )

    body = req.call_args.kwargs["json"]
    assert body["host_name"] == "new-host"
    assert body["folder"] == "/dc1"
    assert body["attributes"] == {"ipaddress": "10.0.0.1"}


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_uses_collection_endpoint():
    """create_host POSTs to the host_config collection endpoint."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "h"})
    ) as req:
        client.create_host("h", folder="/")

    assert req.call_args.kwargs["method"] == "POST"
    assert "domain-types/host_config/collections/all" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_defaults_attributes_to_empty_dict():
    """When attributes is None, an empty dict is sent in the body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "h"})
    ) as req:
        client.create_host("h", folder="/")

    assert req.call_args.kwargs["json"]["attributes"] == {}


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_passes_bake_agent_param():
    """bake_agent is forwarded as a query parameter."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "h"})
    ) as req:
        client.create_host("h", folder="/", bake_agent=True)

    assert req.call_args.kwargs["params"]["bake_agent"] is True


# ── update_host ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_sends_put_with_etag_header():
    """update_host with an explicit ETag sends a PUT with If-Match."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "router1"})
    ) as req:
        client.update_host("router1", {"ipaddress": "10.0.0.1"}, etag='"v1"')

    call = req.call_args
    assert call.kwargs["method"] == "PUT"
    assert "objects/host_config/router1" in call.kwargs["url"]
    assert call.kwargs["headers"]["If-Match"] == '"v1"'
    assert call.kwargs["json"] == {"attributes": {"ipaddress": "10.0.0.1"}}


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_auto_fetches_etag_when_none():
    """When etag is None, get_host_etag is called first before the PUT."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"fetched"'})
    update_resp = _mock_response(200, {"updated": True})

    with patch.object(
        client.session, "request", side_effect=[etag_resp, update_resp]
    ) as req:
        result = client.update_host("router1", {"ipaddress": "10.0.0.2"})

    assert req.call_count == 2
    put_call = req.call_args_list[1]
    assert put_call.kwargs["method"] == "PUT"
    assert put_call.kwargs["headers"]["If-Match"] == '"fetched"'
    assert result == {"updated": True}


# ── delete_host ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_sends_delete_and_returns_true():
    """delete_host sends DELETE and returns True on success."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        result = client.delete_host("old-host")

    assert req.call_args.kwargs["method"] == "DELETE"
    assert "objects/host_config/old-host" in req.call_args.kwargs["url"]
    assert result is True


# ── move_host ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_move_host_posts_to_move_action_endpoint():
    """move_host POSTs to the /actions/move/invoke endpoint."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"v1"'})
    move_resp = _mock_response(200, {"id": "router1"})

    with patch.object(
        client.session, "request", side_effect=[etag_resp, move_resp]
    ) as req:
        client.move_host("router1", "/dc2")

    move_call = req.call_args_list[1]
    assert "actions/move/invoke" in move_call.kwargs["url"]
    assert move_call.kwargs["json"] == {"target_folder": "/dc2"}


# ── rename_host ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_rename_host_posts_new_name_to_rename_endpoint():
    """rename_host sends new_name in the body to the rename action."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "router2"})
    ) as req:
        client.rename_host("router1", "router2")

    assert "actions/rename/invoke" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["json"] == {"new_name": "router2"}


# ── bulk operations ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_create_hosts_sends_entries_array():
    """bulk_create_hosts wraps the host list in an 'entries' key."""
    client = _make_client()
    hosts = [{"host_name": "h1"}, {"host_name": "h2"}]
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"result": []})
    ) as req:
        client.bulk_create_hosts(hosts)

    assert req.call_args.kwargs["json"] == {"entries": hosts}
    assert "bulk-create" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_update_hosts_sends_entries():
    """bulk_update_hosts wraps the host dict in an 'entries' key."""
    client = _make_client()
    hosts = {"h1": {"attributes": {}}}
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"result": []})
    ) as req:
        client.bulk_update_hosts(hosts)

    assert req.call_args.kwargs["json"] == {"entries": hosts}
    assert "bulk-update" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_delete_hosts_sends_hostname_list():
    """bulk_delete_hosts wraps hostnames list in an 'entries' key."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"result": []})
    ) as req:
        client.bulk_delete_hosts(["h1", "h2", "h3"])

    assert req.call_args.kwargs["json"] == {"entries": ["h1", "h2", "h3"]}
    assert "bulk-delete" in req.call_args.kwargs["url"]
