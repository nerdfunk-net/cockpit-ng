"""Unit tests for tasks/utils/device_helpers.py.

All tests run offline — the inventory resolver is patched to avoid DB access.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tasks.utils.device_helpers import get_target_devices


_PATCH_RESOLVER = "utils.inventory_resolver.resolve_inventory_to_device_ids_sync"


# ── get_target_devices ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_target_devices_all_returns_none():
    """inventory_source='all' returns None (use all devices)."""
    template = {"inventory_source": "all"}
    assert get_target_devices(template) is None


@pytest.mark.unit
def test_get_target_devices_unknown_source_returns_none():
    """Unknown inventory_source returns None."""
    template = {"inventory_source": "unknown-type"}
    assert get_target_devices(template) is None


@pytest.mark.unit
def test_get_target_devices_inventory_no_name_returns_none():
    """inventory source without inventory_name logs warning and returns None."""
    template = {"inventory_source": "inventory"}
    result = get_target_devices(template)
    assert result is None


@pytest.mark.unit
def test_get_target_devices_inventory_returns_device_ids():
    """inventory source with valid name returns device IDs from resolver."""
    template = {
        "inventory_source": "inventory",
        "inventory_name": "prod-routers",
        "created_by": "admin",
    }
    device_ids = ["uuid-1", "uuid-2", "uuid-3"]

    with patch(
        "utils.inventory_resolver.resolve_inventory_to_device_ids_sync",
        return_value=device_ids,
    ):
        result = get_target_devices(template)

    assert result == device_ids


@pytest.mark.unit
def test_get_target_devices_inventory_resolver_none_returns_none():
    """Resolver returning None is propagated as None."""
    template = {
        "inventory_source": "inventory",
        "inventory_name": "empty-inventory",
    }

    with patch(
        "utils.inventory_resolver.resolve_inventory_to_device_ids_sync",
        return_value=None,
    ):
        result = get_target_devices(template)

    assert result is None


@pytest.mark.unit
def test_get_target_devices_inventory_resolver_error_returns_none():
    """Exception in resolver is swallowed and returns None."""
    template = {
        "inventory_source": "inventory",
        "inventory_name": "bad-inventory",
    }

    with patch(
        "utils.inventory_resolver.resolve_inventory_to_device_ids_sync",
        side_effect=Exception("DB failure"),
    ):
        result = get_target_devices(template)

    assert result is None


@pytest.mark.unit
def test_get_target_devices_uses_created_by_as_username():
    """created_by field is passed as username to the resolver."""
    template = {
        "inventory_source": "inventory",
        "inventory_name": "my-inv",
        "created_by": "john",
    }

    with patch(
        "utils.inventory_resolver.resolve_inventory_to_device_ids_sync",
        return_value=["uuid-1"],
    ) as mock_resolver:
        get_target_devices(template)

    mock_resolver.assert_called_once_with("my-inv", "john")
