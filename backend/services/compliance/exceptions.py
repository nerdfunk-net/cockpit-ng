"""Typed exceptions for the compliance service domain."""

from __future__ import annotations


class ComplianceValidationError(Exception):
    """Raised for invalid input values (e.g. unknown enum, malformed pattern)."""
