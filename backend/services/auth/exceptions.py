"""Typed exceptions for the auth/RBAC service domain."""

from __future__ import annotations


class RBACNotFoundError(Exception):
    def __init__(self, resource: str, id_val: int) -> None:
        super().__init__(f"{resource} with id {id_val} not found")
        self.resource = resource
        self.id_val = id_val


class RBACConflictError(Exception):
    """Raised when a resource already exists (duplicate name/key)."""


class RBACConstraintError(Exception):
    """Raised when an operation violates a business constraint (e.g. system role)."""
