"""Pure in-memory filter functions for DeviceInfo lists."""

from __future__ import annotations

from typing import List

from models.inventory import DeviceInfo


def by_name(
    devices: List[DeviceInfo], name_filter: str, use_contains: bool = False
) -> List[DeviceInfo]:
    if use_contains:
        needle = name_filter.lower()
        return [d for d in devices if d.name and needle in d.name.lower()]
    return [d for d in devices if d.name == name_filter]


def by_role(
    devices: List[DeviceInfo], role_filter: str, use_negation: bool = False
) -> List[DeviceInfo]:
    if use_negation:
        return [d for d in devices if d.role != role_filter]
    return [d for d in devices if d.role == role_filter]


def by_status(devices: List[DeviceInfo], status_filter: str) -> List[DeviceInfo]:
    return [d for d in devices if d.status == status_filter]


def by_tag(devices: List[DeviceInfo], tag_filter: str) -> List[DeviceInfo]:
    return [d for d in devices if tag_filter in (d.tags or [])]


def by_device_type(
    devices: List[DeviceInfo], devicetype_filter: str, use_negation: bool = False
) -> List[DeviceInfo]:
    if use_negation:
        return [d for d in devices if d.device_type != devicetype_filter]
    return [d for d in devices if d.device_type == devicetype_filter]


def by_manufacturer(
    devices: List[DeviceInfo], manufacturer_filter: str, use_negation: bool = False
) -> List[DeviceInfo]:
    if use_negation:
        return [d for d in devices if d.manufacturer != manufacturer_filter]
    return [d for d in devices if d.manufacturer == manufacturer_filter]


def by_platform(devices: List[DeviceInfo], platform_filter: str) -> List[DeviceInfo]:
    return [d for d in devices if d.platform == platform_filter]


def by_has_primary_ip(
    devices: List[DeviceInfo], has_primary_filter: str
) -> List[DeviceInfo]:
    has_primary = has_primary_filter.lower() == "true"
    if has_primary:
        return [d for d in devices if d.primary_ip4]
    return [d for d in devices if not d.primary_ip4]
