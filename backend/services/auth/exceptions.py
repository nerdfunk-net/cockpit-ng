"""Typed exceptions for the auth/RBAC service domain."""

from __future__ import annotations

from typing import Any, Dict


class RBACNotFoundError(Exception):
    def __init__(self, resource: str, id_val: int) -> None:
        super().__init__(f"{resource} with id {id_val} not found")
        self.resource = resource
        self.id_val = id_val


class RBACConflictError(Exception):
    """Raised when a resource already exists (duplicate name/key)."""


class RBACConstraintError(Exception):
    """Raised when an operation violates a business constraint (e.g. system role)."""


class UserDeletionBlockedError(Exception):
    """Raised when deleting a user requires input the caller didn't supply:
    a target user to reassign the deleted user's global templates/schedules
    to, and/or explicit confirmation to hard-delete their private
    templates/schedules.

    ``impact`` is the same dict returned by
    ``RBACService.get_user_deletion_impact`` — callers (the router) surface
    it verbatim in the 409 response body so the admin/frontend can render
    a confirmation prompt and retry with the missing parameters.
    """

    def __init__(self, impact: Dict[str, Any]) -> None:
        super().__init__("User deletion requires additional confirmation")
        self.impact = impact
