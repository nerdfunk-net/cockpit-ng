"""Unit tests for _ActivationMixin, _HostGroupsMixin, _TagGroupsMixin.

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


# ── get_pending_changes ────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_pending_changes_calls_correct_endpoint():
    """get_pending_changes GETs the pending_changes collection."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        result = client.get_pending_changes()

    assert req.call_args.kwargs["method"] == "GET"
    assert "pending_changes" in req.call_args.kwargs["url"]
    assert result == {"value": []}


# ── activate_changes ───────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_activate_changes_sends_post_with_sites():
    """activate_changes POSTs to the activate-changes endpoint with explicit sites."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "act1"})
    ) as req:
        client.activate_changes(sites=["prod"])

    assert req.call_args.kwargs["method"] == "POST"
    assert "activate-changes" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["json"]["sites"] == ["prod"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_activate_changes_defaults_sites_to_own_site_name():
    """When sites is None, site_name is used as the default site."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "act1"})
    ) as req:
        client.activate_changes()

    assert req.call_args.kwargs["json"]["sites"] == ["monitoring"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_activate_changes_sends_if_match_star_by_default():
    """Default etag='*' is sent as the If-Match header."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "act1"})
    ) as req:
        client.activate_changes()

    assert req.call_args.kwargs["headers"]["If-Match"] == "*"


@pytest.mark.unit
@pytest.mark.checkmk
def test_activate_changes_forwards_force_foreign_changes_flag():
    """force_foreign_changes is included in the JSON body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "act1"})
    ) as req:
        client.activate_changes(force_foreign_changes=True)

    assert req.call_args.kwargs["json"]["force_foreign_changes"] is True


# ── get_activation_status ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_activation_status_includes_id_in_url():
    """get_activation_status GETs the activation_run resource by ID."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "act-99"})
    ) as req:
        client.get_activation_status("act-99")

    assert "objects/activation_run/act-99" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"


# ── wait_for_activation_completion ────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_wait_for_activation_completion_posts_to_action_endpoint():
    """wait_for_activation_completion POSTs to the wait-for-completion action."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"state": "done"})
    ) as req:
        client.wait_for_activation_completion("act-42")

    assert "act-42" in req.call_args.kwargs["url"]
    assert "wait-for-completion" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "POST"


# ── get_running_activations ────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_running_activations_calls_running_collection():
    """get_running_activations GETs the running activations collection."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_running_activations()

    assert "collections/running" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"


# ── get_host_groups ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_groups_calls_collection_endpoint():
    """get_host_groups GETs the host_group_config collection."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_host_groups()

    assert "domain-types/host_group_config/collections/all" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_group_includes_name_in_url():
    """get_host_group GETs the named host_group_config resource."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "network"})
    ) as req:
        client.get_host_group("network")

    assert "objects/host_group_config/network" in req.call_args.kwargs["url"]


# ── create_host_group ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_group_sends_name_and_alias():
    """create_host_group POSTs name and alias in the body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "net"})
    ) as req:
        client.create_host_group("net", alias="Network Devices")

    body = req.call_args.kwargs["json"]
    assert body["name"] == "net"
    assert body["alias"] == "Network Devices"


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_group_omits_alias_when_none():
    """Alias is not included in the body when not specified."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "net"})
    ) as req:
        client.create_host_group("net")

    assert "alias" not in req.call_args.kwargs["json"]


# ── update_host_group ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_group_auto_fetches_etag_when_none():
    """When etag is None, get_host_group_etag is called first."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"grp-v1"'})
    update_resp = _mock_response(200, {"id": "net"})

    with patch.object(client.session, "request", side_effect=[etag_resp, update_resp]) as req:
        client.update_host_group("net", alias="Updated")

    assert req.call_count == 2
    put_call = req.call_args_list[1]
    assert put_call.kwargs["method"] == "PUT"
    assert put_call.kwargs["headers"]["If-Match"] == '"grp-v1"'


# ── delete_host_group ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_group_returns_true():
    """delete_host_group sends DELETE and returns True."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        result = client.delete_host_group("old-group")

    assert req.call_args.kwargs["method"] == "DELETE"
    assert "old-group" in req.call_args.kwargs["url"]
    assert result is True


# ── bulk host group operations ─────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_update_host_groups_sends_entries():
    """bulk_update_host_groups wraps entries and uses PUT."""
    client = _make_client()
    entries = [{"name": "net", "alias": "Network"}]
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {})
    ) as req:
        client.bulk_update_host_groups(entries)

    assert req.call_args.kwargs["method"] == "PUT"
    assert req.call_args.kwargs["json"] == {"entries": entries}
    assert "bulk-update" in req.call_args.kwargs["url"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_bulk_delete_host_groups_sends_entries():
    """bulk_delete_host_groups wraps name list and uses DELETE."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        client.bulk_delete_host_groups(["net", "servers"])

    assert req.call_args.kwargs["method"] == "DELETE"
    assert req.call_args.kwargs["json"] == {"entries": ["net", "servers"]}
    assert "bulk-delete" in req.call_args.kwargs["url"]


# ── get_all_host_tag_groups ────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_all_host_tag_groups_calls_collection():
    """get_all_host_tag_groups GETs the tag group collection."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"value": []})
    ) as req:
        client.get_all_host_tag_groups()

    assert "domain-types/host_tag_group/collections/all" in req.call_args.kwargs["url"]
    assert req.call_args.kwargs["method"] == "GET"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_host_tag_group_includes_name_in_url():
    """get_host_tag_group GETs the named tag group resource."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "tag_agent"})
    ) as req:
        client.get_host_tag_group("tag_agent")

    assert "objects/host_tag_group/tag_agent" in req.call_args.kwargs["url"]


# ── create_host_tag_group ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_tag_group_sends_required_fields():
    """create_host_tag_group POSTs id, title, and tags."""
    client = _make_client()
    tags = [{"id": "cmk-agent", "title": "CMK Agent"}]
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "tag_env"})
    ) as req:
        client.create_host_tag_group("tag_env", "Environment", tags)

    body = req.call_args.kwargs["json"]
    assert body["id"] == "tag_env"
    assert body["title"] == "Environment"
    assert body["tags"] == tags


@pytest.mark.unit
@pytest.mark.checkmk
def test_create_host_tag_group_includes_optional_topic():
    """topic is added to the body when provided."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "t"})
    ) as req:
        client.create_host_tag_group("t", "T", [], topic="Monitoring")

    assert req.call_args.kwargs["json"]["topic"] == "Monitoring"


# ── update_host_tag_group ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_tag_group_auto_fetches_etag_when_none():
    """When etag is None, get_host_tag_group_etag is fetched first."""
    client = _make_client()
    etag_resp = _mock_response(200, None, headers={"ETag": '"tg-v1"'})
    update_resp = _mock_response(200, {"id": "tag_env"})

    with patch.object(client.session, "request", side_effect=[etag_resp, update_resp]) as req:
        client.update_host_tag_group("tag_env", title="Env Updated")

    assert req.call_count == 2
    put_call = req.call_args_list[1]
    assert put_call.kwargs["method"] == "PUT"
    assert put_call.kwargs["headers"]["If-Match"] == '"tg-v1"'


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_tag_group_includes_repair_in_body():
    """repair flag is always sent in the PUT body."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "t"})
    ) as req:
        client.update_host_tag_group("t", title="T", etag='"v1"', repair=True)

    assert req.call_args.kwargs["json"]["repair"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_update_host_tag_group_repair_defaults_to_false():
    """repair defaults to False when not specified."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(200, {"id": "t"})
    ) as req:
        client.update_host_tag_group("t", etag='"v1"')

    assert req.call_args.kwargs["json"]["repair"] is False


# ── delete_host_tag_group ──────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_tag_group_returns_true():
    """delete_host_tag_group sends DELETE and returns True."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        result = client.delete_host_tag_group("old-tag")

    assert req.call_args.kwargs["method"] == "DELETE"
    assert "old-tag" in req.call_args.kwargs["url"]
    assert result is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_tag_group_passes_repair_param():
    """repair param is forwarded as a query parameter."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        client.delete_host_tag_group("t", repair=True)

    assert req.call_args.kwargs["params"]["repair"] is True


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_tag_group_passes_mode_when_provided():
    """mode param is forwarded when specified."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        client.delete_host_tag_group("t", mode="delete_tags")

    assert req.call_args.kwargs["params"]["mode"] == "delete_tags"


@pytest.mark.unit
@pytest.mark.checkmk
def test_delete_host_tag_group_omits_mode_when_none():
    """mode is absent from params when not provided."""
    client = _make_client()
    with patch.object(
        client.session, "request", return_value=_mock_response(204)
    ) as req:
        client.delete_host_tag_group("t")

    assert "mode" not in req.call_args.kwargs["params"]
