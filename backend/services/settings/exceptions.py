"""Typed exceptions for settings-domain services."""

from __future__ import annotations


class CredentialNotFoundError(Exception):
    def __init__(self, cred_id: int) -> None:
        super().__init__(f"Credential {cred_id} not found")
        self.cred_id = cred_id


class CredentialMissingFieldError(Exception):
    """Raised when a requested decrypted field (password, SSH key) is absent."""


class ProfileValidationError(Exception):
    """Raised for invalid profile input (duplicate/empty name, built-in mutation)."""
