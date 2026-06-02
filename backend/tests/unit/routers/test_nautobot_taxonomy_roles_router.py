"""Unit tests for Nautobot taxonomy role endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers.nautobot.taxonomy import get_nautobot_contact_roles


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_nautobot_contact_roles_filters_by_contactassociation() -> None:
    """Contact roles endpoint filters extras.roles by contactassociation content type."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={
            "results": [
                {
                    "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
                    "name": "Administrative",
                }
            ]
        }
    )

    result = await get_nautobot_contact_roles(
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == [
        {
            "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
            "name": "Administrative",
        }
    ]
    mock_nb.rest_request.assert_awaited_once_with(
        "extras/roles/?content_types=extras.contactassociation&limit=0"
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_nautobot_contact_roles_returns_empty_list_without_results() -> None:
    """Contact roles endpoint safely handles missing pagination keys."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={})

    result = await get_nautobot_contact_roles(
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == []
