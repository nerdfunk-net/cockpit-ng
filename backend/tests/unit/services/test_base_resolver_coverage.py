"""Unit tests for services/nautobot/resolvers/base_resolver.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.resolvers.base_resolver import BaseResolver


def _make_resolver(graphql_result=None, raise_exc=None):
    nb = MagicMock()
    if raise_exc:
        nb.graphql_query = AsyncMock(side_effect=raise_exc)
    else:
        nb.graphql_query = AsyncMock(return_value=graphql_result or {})
    return BaseResolver(nb)


@pytest.mark.unit
class TestResolveByField:
    @pytest.mark.asyncio
    async def test_returns_id_when_resource_found(self):
        result = {"data": {"platforms": [{"id": "abc-123"}]}}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_field("platforms", "name", "ios")
        assert value == "abc-123"

    @pytest.mark.asyncio
    async def test_returns_none_when_resource_not_found(self):
        result = {"data": {"platforms": []}}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_field("platforms", "name", "unknown")
        assert value is None

    @pytest.mark.asyncio
    async def test_returns_none_on_graphql_errors(self):
        result = {"errors": [{"message": "field not found"}]}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_field("platforms", "name", "ios")
        assert value is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        resolver = _make_resolver(raise_exc=RuntimeError("network error"))
        value = await resolver._resolve_by_field("platforms", "name", "ios")
        assert value is None

    @pytest.mark.asyncio
    async def test_wraps_string_value_in_list_for_variables(self):
        result = {"data": {"devices": [{"id": "dev-uuid"}]}}
        resolver = _make_resolver(result)
        await resolver._resolve_by_field("devices", "name", "router-01")
        call_args = resolver.nautobot.graphql_query.call_args
        variables = call_args[0][1]
        assert variables["value"] == ["router-01"]

    @pytest.mark.asyncio
    async def test_passes_list_value_as_is(self):
        result = {"data": {"devices": [{"id": "dev-uuid"}]}}
        resolver = _make_resolver(result)
        await resolver._resolve_by_field("devices", "name", ["r1", "r2"])
        call_args = resolver.nautobot.graphql_query.call_args
        variables = call_args[0][1]
        assert variables["value"] == ["r1", "r2"]

    @pytest.mark.asyncio
    async def test_custom_return_field(self):
        result = {"data": {"platforms": [{"name": "ios"}]}}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_field(
            "platforms", "id", "abc", return_field="name"
        )
        assert value == "ios"

    @pytest.mark.asyncio
    async def test_returns_none_when_data_key_missing(self):
        resolver = _make_resolver({})
        value = await resolver._resolve_by_field("platforms", "name", "ios")
        assert value is None


@pytest.mark.unit
class TestResolveByName:
    @pytest.mark.asyncio
    async def test_delegates_to_resolve_by_field(self):
        result = {"data": {"roles": [{"id": "role-uuid"}]}}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_name("roles", "access-switch")
        assert value == "role-uuid"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        result = {"data": {"roles": []}}
        resolver = _make_resolver(result)
        value = await resolver._resolve_by_name("roles", "nonexistent")
        assert value is None
