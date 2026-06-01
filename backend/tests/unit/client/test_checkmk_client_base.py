"""Unit tests for _CheckMKBase: response handling, error parsing, bulk operations.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
import requests.exceptions

from services.checkmk.client import CheckMKClient
from services.checkmk.client._base import _extract_validation_errors
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


# ── _extract_validation_errors ─────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_picks_invalid_value_prefix():
    """List errors with 'Invalid value for' prefix are chosen over others."""
    error_data = {
        "fields": {
            "attributes": {
                "ipaddress": ["Some generic error", "Invalid value for ipaddress: not an IP"],
            }
        }
    }
    result = _extract_validation_errors(error_data)
    assert result == ["ipaddress: Invalid value for ipaddress: not an IP"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_falls_back_to_first_list_item():
    """Without a prefixed message, the first list item is used."""
    error_data = {
        "fields": {
            "attributes": {
                "alias": ["Must not be empty"],
            }
        }
    }
    result = _extract_validation_errors(error_data)
    assert result == ["alias: Must not be empty"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_handles_string_values():
    """String error values are formatted as 'field: message'."""
    error_data = {
        "fields": {
            "attributes": {
                "tag_agent": "Unknown tag value",
            }
        }
    }
    result = _extract_validation_errors(error_data)
    assert result == ["tag_agent: Unknown tag value"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_empty_list_produces_no_entry():
    """An empty list for a field contributes nothing to the result."""
    error_data = {"fields": {"attributes": {"ipaddress": []}}}
    result = _extract_validation_errors(error_data)
    assert result == []


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_no_fields_key():
    """Missing 'fields' key returns an empty list without raising."""
    result = _extract_validation_errors({"title": "Bad request"})
    assert result == []


@pytest.mark.unit
@pytest.mark.checkmk
def test_extract_validation_errors_multiple_fields():
    """Multiple field errors are all returned."""
    error_data = {
        "fields": {
            "attributes": {
                "ipaddress": ["Invalid value for ipaddress"],
                "alias": ["Too long"],
            }
        }
    }
    result = _extract_validation_errors(error_data)
    assert len(result) == 2
    assert any("ipaddress" in r for r in result)
    assert any("alias" in r for r in result)


# ── _handle_response ───────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_200_returns_parsed_json():
    """200 with a body returns the parsed JSON dict."""
    client = _make_client()
    payload = {"id": "router1", "host_name": "router1"}
    result = client._handle_response(_mock_response(200, payload))
    assert result == payload


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_201_returns_parsed_json():
    """201 Created returns the parsed JSON body."""
    client = _make_client()
    payload = {"id": "new-host"}
    result = client._handle_response(_mock_response(201, payload))
    assert result == payload


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_204_no_content_returns_empty_dict():
    """204 No Content (empty body) returns an empty dict, not None."""
    client = _make_client()
    result = client._handle_response(_mock_response(204))
    assert result == {}


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_303_returns_redirect_dict():
    """303 returns a dict with redirected=True and the location header."""
    client = _make_client()
    resp = _mock_response(303, None, headers={"location": "/new/path"})
    resp.content = b""
    result = client._handle_response(resp)
    assert result == {"redirected": True, "location": "/new/path"}


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_400_raises_with_detail():
    """400 with a 'detail' field raises CheckMKAPIError containing that detail."""
    client = _make_client()
    error_body = {"detail": "Host already exists"}
    with pytest.raises(CheckMKAPIError, match="Host already exists"):
        client._handle_response(_mock_response(400, error_body))


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_400_extracts_validation_errors():
    """400 with field-level validation errors attaches them as validation_summary."""
    client = _make_client()
    error_body = {
        "fields": {
            "attributes": {
                "ipaddress": ["Invalid value for ipaddress: foo"],
            }
        }
    }
    with pytest.raises(CheckMKAPIError) as exc_info:
        client._handle_response(_mock_response(400, error_body))
    assert exc_info.value.status_code == 400
    assert "validation_summary" in exc_info.value.response_data


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_401_raises_with_status_code():
    """401 raises CheckMKAPIError with status_code=401."""
    client = _make_client()
    with pytest.raises(CheckMKAPIError) as exc_info:
        client._handle_response(_mock_response(401, {"detail": "Unauthorized"}))
    assert exc_info.value.status_code == 401


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_404_raises_with_status_code():
    """404 raises CheckMKAPIError with status_code=404."""
    client = _make_client()
    with pytest.raises(CheckMKAPIError) as exc_info:
        client._handle_response(_mock_response(404, {"title": "Not Found"}))
    assert exc_info.value.status_code == 404


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_500_raises():
    """500 raises CheckMKAPIError."""
    client = _make_client()
    with pytest.raises(CheckMKAPIError) as exc_info:
        client._handle_response(_mock_response(500, {"message": "Internal error"}))
    assert exc_info.value.status_code == 500


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_json_decode_error_raises_api_error():
    """A non-JSON response body raises CheckMKAPIError with the raw text."""
    client = _make_client()
    resp = MagicMock()
    resp.status_code = 200
    resp.content = b"not valid json"
    resp.json.side_effect = json.JSONDecodeError("Expecting value", "not valid json", 0)
    resp.text = "not valid json"

    with pytest.raises(CheckMKAPIError, match="Invalid JSON response"):
        client._handle_response(resp)


@pytest.mark.unit
@pytest.mark.checkmk
def test_handle_response_error_uses_message_field_when_no_detail():
    """Error response with 'message' field (no 'detail') includes it in the error."""
    client = _make_client()
    error_body = {"message": "Something went wrong"}
    with pytest.raises(CheckMKAPIError, match="Something went wrong"):
        client._handle_response(_mock_response(503, error_body))


# ── test_connection ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_test_connection_returns_true_on_200():
    """200 from /version endpoint means connection succeeded."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {})):
        assert client.test_connection() is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_test_connection_returns_false_on_non_200():
    """Non-200 status means connection failed."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(401, {})):
        assert client.test_connection() is False


@pytest.mark.unit
@pytest.mark.checkmk
def test_test_connection_returns_false_on_network_error():
    """A network-level exception is caught and returns False."""
    client = _make_client()
    with patch.object(client.session, "request", side_effect=requests.exceptions.ConnectionError("refused")):
        assert client.test_connection() is False


# ── get_version ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_version_returns_parsed_response():
    """get_version calls GET /version and returns the parsed dict."""
    client = _make_client()
    version_data = {"site": "monitoring", "versions": {"checkmk": "2.3.0"}}
    with patch.object(client.session, "request", return_value=_mock_response(200, version_data)) as req:
        result = client.get_version()

    assert "version" in req.call_args.kwargs["url"]
    assert result == version_data


# ── bulk_operation ─────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_create_host_records_success():
    """A successful create_host operation is recorded with success=True."""
    client = _make_client()
    created = {"id": "new-host"}
    with patch.object(client, "create_host", return_value=created):
        results = client.bulk_operation([{"type": "create_host", "params": {"hostname": "new-host", "folder": "/"}}])

    assert len(results) == 1
    assert results[0]["success"] is True
    assert results[0]["result"] == created


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_update_host_dispatches_correctly():
    """update_host is called with the provided params."""
    client = _make_client()
    updated = {"id": "router1"}
    with patch.object(client, "update_host", return_value=updated) as mock_update:
        results = client.bulk_operation([{"type": "update_host", "params": {"hostname": "router1", "attributes": {}}}])

    mock_update.assert_called_once_with(hostname="router1", attributes={})
    assert results[0]["success"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_delete_host_dispatches_correctly():
    """delete_host is called with the hostname from params."""
    client = _make_client()
    with patch.object(client, "delete_host", return_value=True) as mock_del:
        results = client.bulk_operation([{"type": "delete_host", "params": {"hostname": "old-host"}}])

    mock_del.assert_called_once_with("old-host")
    assert results[0]["success"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_unknown_type_returns_error_in_result():
    """An unknown operation type is recorded as success=True with an error dict."""
    client = _make_client()
    results = client.bulk_operation([{"type": "unsupported_op", "params": {}}])

    assert len(results) == 1
    assert results[0]["success"] is True
    assert "Unknown operation type" in results[0]["result"]["error"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_api_error_recorded_as_failure():
    """A CheckMKAPIError during an operation is recorded with success=False."""
    client = _make_client()
    with patch.object(client, "create_host", side_effect=CheckMKAPIError("duplicate", 400)):
        results = client.bulk_operation([{"type": "create_host", "params": {"hostname": "dup-host"}}])

    assert results[0]["success"] is False
    assert "duplicate" in results[0]["error"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_operation_processes_multiple_operations():
    """All operations in a batch are executed and results collected."""
    client = _make_client()
    with (
        patch.object(client, "create_host", return_value={"id": "host1"}),
        patch.object(client, "delete_host", return_value=True),
    ):
        results = client.bulk_operation(
            [
                {"type": "create_host", "params": {"hostname": "host1"}},
                {"type": "delete_host", "params": {"hostname": "host2"}},
            ]
        )

    assert len(results) == 2
    assert all(r["success"] for r in results)
