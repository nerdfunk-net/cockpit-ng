"""
CheckMK API Client Package

A comprehensive Python client for interacting with CheckMK REST API.
"""

from checkmk.client import CheckMKClient, CheckMKAPIError

__version__ = "1.0.0"
__all__ = ["CheckMKClient", "CheckMKAPIError"]
