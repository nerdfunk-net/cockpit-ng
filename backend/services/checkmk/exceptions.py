"""
CheckMK domain exceptions.

Moved from services/checkmk/client_factory.py during Phase 6 cleanup.
"""


class CheckMKClientError(Exception):
    """Exception raised when CheckMK client cannot be created or used."""
    pass


class HostNotFoundError(Exception):
    """Exception raised when a host is not found in CheckMK."""
    pass
