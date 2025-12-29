"""
CheckMK integration services.

This package contains services for:
- CheckMK API client
- CheckMK configuration
- Device normalization
- Folder management
- Nautobot to CheckMK synchronization
"""

from .client import checkmk_service

__all__ = ["checkmk_service"]
