"""Unit tests for _FoldersMixin: path encoding, ETag handling, folder CRUD.

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


# ── get_all_folders ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_folders_calls_collection_endpoint():
    """get_all_folders uses the folder_config collection endpoint."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"value": []})) as req:
        client.get_all_folders()

    assert "domain-types/folder_config/collections/all" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_folders_passes_recursive_param():
    """recursive=True is forwarded as a query parameter."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"value": []})) as req:
        client.get_all_folders(recursive=True)

    assert req.call_args.kwargs["params"]["recursive"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_folders_passes_parent_when_given():
    """Parent filter is included in query params when specified."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"value": []})) as req:
        client.get_all_folders(parent="/dc1")

    assert req.call_args.kwargs["params"]["parent"] == "/dc1"


# ── get_folder ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_converts_slash_path_to_tilde_notation():
    """slash_to_tilde encodes /dc1 as ~dc1 in the URL."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~dc1"})) as req:
        result = client.get_folder("/dc1")

    assert "objects/folder_config/~dc1" in req.call_args.kwargs["url"]
    assert result["id"] == "~dc1"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_encodes_nested_path():
    """/dc1/servers becomes ~dc1~servers in the URL."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~dc1~servers"})) as req:
        client.get_folder("/dc1/servers")

    assert "~dc1~servers" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_root_encodes_as_tilde():
    """Root path '/' is encoded as '~'."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~"})) as req:
        client.get_folder("/")

    url = req.call_args.kwargs["url"]
    assert url.endswith("objects/folder_config/~") or "folder_config/~" in url


# ── get_folder_etag ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_etag_extracts_header():
    """get_folder_etag returns the ETag from the response header."""
    client = _make_client()
    with patch.object(
        client.session,
        "request",
        return_value=_mock_response(200, None, headers={"ETag": '"folder-v1"'}),
    ):
        etag = client.get_folder_etag("/dc1")

    assert etag == '"folder-v1"'


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_etag_defaults_to_star_when_missing():
    """Missing ETag header returns '*'."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, None, headers={})):
        etag = client.get_folder_etag("/dc1")

    assert etag == "*"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_folder_etag_raises_on_non_200():
    """Non-200 response raises CheckMKAPIError."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(404, None)):
        with pytest.raises(CheckMKAPIError):
            client.get_folder_etag("/missing")


# ── create_folder ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_folder_posts_correct_json_body():
    """create_folder sends name, title, and parent in the JSON body."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~dc1~new"})) as req:
        client.create_folder("new", "New Folder", parent="/dc1")

    body = req.call_args.kwargs["json"]
    assert body["name"] == "new"
    assert body["title"] == "New Folder"
    assert body["parent"] == "/dc1"


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_folder_uses_collection_endpoint():
    """create_folder POSTs to the folder_config collection."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~f"})) as req:
        client.create_folder("f", "F", parent="/")

    assert req.call_args.kwargs["method"] == "POST"
    assert "domain-types/folder_config/collections/all" in req.call_args.kwargs["url"]


# ── update_folder ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_folder_sends_put_with_etag():
    """update_folder with explicit ETag sends PUT with If-Match header."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~dc1"})) as req:
        client.update_folder("/dc1", title="Updated DC1", etag='"v3"')

    call = req.call_args
    assert call.kwargs["method"] == "PUT"
    assert "~dc1" in call.kwargs["url"]
    assert call.kwargs["headers"]["If-Match"] == '"v3"'
    assert call.kwargs["json"]["title"] == "Updated DC1"


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_folder_auto_fetches_etag_when_none():
    """When etag is None, get_folder_etag is called first."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"f-etag"'})
    update_resp = _mock_response(200, {"id": "~dc1"})

    with patch.object(client.session, "request", side_effect=[etag_resp, update_resp]) as req:
        client.update_folder("/dc1", title="DC1")

    assert req.call_count == 2
    put_call = req.call_args_list[1]
    assert put_call.kwargs["method"] == "PUT"
    assert put_call.kwargs["headers"]["If-Match"] == '"f-etag"'


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_folder_includes_only_provided_fields():
    """Only non-None fields (title, attributes, remove_attributes) are sent."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"id": "~dc1"})) as req:
        client.update_folder("/dc1", attributes={"tag_criticality": "prod"}, etag='"v1"')

    body = req.call_args.kwargs["json"]
    assert "attributes" in body
    assert "title" not in body
    assert "remove_attributes" not in body


# ── delete_folder ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_folder_passes_delete_mode_param():
    """delete_mode is forwarded as a query parameter."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(204)) as req:
        result = client.delete_folder("/dc1", delete_mode="recursive")

    assert req.call_args.kwargs["params"]["delete_mode"] == "recursive"
    assert "~dc1" in req.call_args.kwargs["url"]
    assert result is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_folder_uses_recursive_mode_by_default():
    """Default delete_mode is 'recursive'."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(204)) as req:
        client.delete_folder("/dc1")

    assert req.call_args.kwargs["params"]["delete_mode"] == "recursive"


# ── move_folder ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_move_folder_posts_to_move_action():
    """move_folder POSTs to the move action endpoint with encoded path."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"v2"'})
    move_resp = _mock_response(200, {"id": "~dc1"})

    with patch.object(client.session, "request", side_effect=[etag_resp, move_resp]) as req:
        client.move_folder("/dc1", "/archive")

    move_call = req.call_args_list[1]
    assert "actions/move/invoke" in move_call.kwargs["url"]
    assert "~dc1" in move_call.kwargs["url"]
    assert move_call.kwargs["json"] == {"destination": "/archive"}


# ── bulk_update_folders ────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_update_folders_sends_entries():
    """bulk_update_folders wraps entries list and uses PUT."""
    client = _make_client()
    entries = [{"folder": "/dc1", "title": "DC1"}]
    with patch.object(client.session, "request", return_value=_mock_response(200, {"result": []})) as req:
        client.bulk_update_folders(entries)

    assert req.call_args.kwargs["method"] == "PUT"
    assert req.call_args.kwargs["json"] == {"entries": entries}
    assert "bulk-update" in req.call_args.kwargs["url"]


# ── get_hosts_in_folder ────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_hosts_in_folder_uses_encoded_path_in_url():
    """Folder path is tilde-encoded and points to the hosts sub-collection."""
    client = _make_client()
    with patch.object(client.session, "request", return_value=_mock_response(200, {"value": []})) as req:
        client.get_hosts_in_folder("/dc1")

    url = req.call_args.kwargs["url"]
    assert "~dc1" in url
    assert "collections/hosts" in url
