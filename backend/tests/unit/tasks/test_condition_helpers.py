"""Unit tests for tasks/utils/condition_helpers.py.

All tests run offline — the underlying inventory converter is tested directly;
here we verify the delegation contract.
"""

from __future__ import annotations

import pytest

from tasks.utils.condition_helpers import convert_conditions_to_operations

# ── convert_conditions_to_operations ──────────────────────────────────────────


@pytest.mark.unit
def test_convert_conditions_empty_list():
    """Empty list returns empty operations."""
    assert convert_conditions_to_operations([]) == []


@pytest.mark.unit
def test_convert_conditions_version_2():
    """Version 2 tree structure is converted to operations."""
    conditions = [
        {
            "version": 2,
            "tree": {
                "type": "root",
                "internalLogic": "AND",
                "items": [{"field": "location", "operator": "equals", "value": "NYC"}],
            },
        }
    ]
    ops = convert_conditions_to_operations(conditions)
    assert len(ops) == 1
    assert ops[0].conditions[0].field == "location"


@pytest.mark.unit
def test_convert_conditions_unsupported_version_raises():
    """Unsupported version raises ValueError."""
    conditions = [{"version": 1}]
    with pytest.raises(ValueError):
        convert_conditions_to_operations(conditions)


@pytest.mark.unit
def test_convert_conditions_non_list_raises():
    """Non-list input raises ValueError."""
    with pytest.raises(ValueError):
        convert_conditions_to_operations({"version": 2})
