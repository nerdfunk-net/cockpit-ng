"""
Cache helper functions for Nautobot data.
"""

from typing import Optional
from services.settings.cache import cache_service

# Cache configuration
DEVICE_CACHE_TTL = 30 * 60  # 30 minutes in seconds


def get_device_cache_key(device_id: str) -> str:
    """Generate cache key for individual device."""
    return f"nautobot:devices:{device_id}"


def get_device_details_cache_key(device_id: str) -> str:
    """Generate cache key for device details."""
    return f"nautobot:device_details:{device_id}"


def get_device_list_cache_key(
    filter_type: str = None,
    filter_value: str = None,
    limit: int = None,
    offset: int = None,
) -> str:
    """Generate cache key for device list."""
    if filter_type and filter_value:
        key = f"nautobot:devices:list:{filter_type}:{filter_value}"
    else:
        key = "nautobot:devices:list:all"

    if limit is not None and offset is not None:
        key += f":limit_{limit}:offset_{offset}"

    return key


def get_ip_address_cache_key(ip_id: str) -> str:
    """Generate cache key for individual IP address."""
    return f"nautobot:ip_address:{ip_id}"


def cache_device(device: dict) -> None:
    """Cache individual device data."""
    if device and device.get("id"):
        cache_key = get_device_cache_key(device["id"])
        cache_service.set(cache_key, device, DEVICE_CACHE_TTL)


def get_cached_device(device_id: str) -> Optional[dict]:
    """Get cached device data."""
    cache_key = get_device_cache_key(device_id)
    return cache_service.get(cache_key)


def cache_device_list(cache_key: str, devices: list) -> None:
    """Cache device list and individual devices."""
    # Don't cache the full response data, that's handled elsewhere
    # Just cache individual devices
    for device in devices:
        if isinstance(device, dict):
            cache_device(device)


def get_cached_device_list(cache_key: str) -> Optional[list]:
    """Get cached device list."""
    return cache_service.get(cache_key)
