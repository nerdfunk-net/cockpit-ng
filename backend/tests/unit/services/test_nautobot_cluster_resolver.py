"""Unit tests for ClusterResolver.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import ANY, AsyncMock, MagicMock

import pytest

from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.resolvers.cluster_resolver import ClusterResolver


CLUSTER_ID = "ad000000-0000-0000-0005-000000000001"
GROUP_ID = "ad000000-0000-0000-0006-000000000001"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_all_cluster_groups_returns_groups() -> None:
    """Cluster groups are extracted from GraphQL data."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={"data": {"cluster_groups": [{"id": GROUP_ID, "name": "prod"}]}}
    )
    resolver = ClusterResolver(mock_nb)

    result = await resolver.get_all_cluster_groups()

    assert result == [{"id": GROUP_ID, "name": "prod"}]


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_all_clusters_passes_group_filter() -> None:
    """Cluster group filters are sent as GraphQL variables."""
    clusters = [{"id": CLUSTER_ID, "name": "cluster-01"}]
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"clusters": clusters}})
    resolver = ClusterResolver(mock_nb)

    result = await resolver.get_all_clusters(group=[GROUP_ID])

    assert result == clusters
    mock_nb.graphql_query.assert_awaited_once()
    assert mock_nb.graphql_query.await_args.args[1] == {"group": [GROUP_ID]}


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_cluster_by_id_returns_first_match() -> None:
    """A matching cluster ID returns the first GraphQL cluster."""
    cluster = {"id": CLUSTER_ID, "name": "cluster-01"}
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"clusters": [cluster]}})
    resolver = ClusterResolver(mock_nb)

    result = await resolver.get_cluster_by_id(CLUSTER_ID)

    assert result == cluster
    mock_nb.graphql_query.assert_awaited_once_with(ANY, {"id": CLUSTER_ID})
    query = mock_nb.graphql_query.await_args.args[0]
    assert "query getCluster" in query
    assert "clusters(id: $id)" in query


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_cluster_by_id_returns_none_when_not_found() -> None:
    """Missing clusters return None."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"clusters": []}})
    resolver = ClusterResolver(mock_nb)

    result = await resolver.get_cluster_by_id(CLUSTER_ID)

    assert result is None


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_all_clusters_graphql_errors_raise() -> None:
    """GraphQL resolver errors raise NautobotAPIError."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"errors": [{"message": "boom"}]})
    resolver = ClusterResolver(mock_nb)

    with pytest.raises(NautobotAPIError, match="GraphQL errors"):
        await resolver.get_all_clusters()
