"""Types and constants for the offboarding module."""

from __future__ import annotations

from typing import List, TypedDict

DEVICE_CACHE_TTL = 30 * 60  # 30 minutes


class OffboardingResult(TypedDict):
    """Result structure for offboarding operations."""

    success: bool
    device_id: str
    device_name: str
    removed_items: List[str]
    skipped_items: List[str]
    errors: List[str]
    summary: str


def make_result(device_id: str) -> OffboardingResult:
    """Create a fresh offboarding result dict."""
    return OffboardingResult(
        success=True,
        device_id=device_id,
        device_name="",
        removed_items=[],
        skipped_items=[],
        errors=[],
        summary="",
    )
