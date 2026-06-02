"""Unit tests for Nautobot taxonomy router contact endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers.nautobot.taxonomy import (
    get_nautobot_contact_details,
    get_nautobot_contacts,
)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_nautobot_contacts_returns_results_list() -> None:
    """List endpoint returns the Nautobot paginated result list."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={"results": [{"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4"}]}
    )

    result = await get_nautobot_contacts(
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == [{"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4"}]
    mock_nb.rest_request.assert_awaited_once_with("extras/contacts/?limit=0")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_nautobot_contacts_returns_empty_list_without_results() -> None:
    """List endpoint safely handles missing pagination keys."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={})

    result = await get_nautobot_contacts(
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == []


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_nautobot_contact_details_returns_contact_payload() -> None:
    """Details endpoint returns the Nautobot contact payload unchanged."""
    contact_id = "13b79fe1-264f-40a3-91ed-9e93dd45a5d4"
    payload = {"id": contact_id, "name": "Marc", "email": "user@mail.com"}
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value=payload)

    result = await get_nautobot_contact_details(
        contact_id=contact_id,
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == payload
    mock_nb.rest_request.assert_awaited_once_with(f"extras/contacts/{contact_id}/")
