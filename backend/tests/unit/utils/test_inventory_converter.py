"""Unit tests for utils/inventory_converter.py.

All tests run offline — no external dependencies required.
"""

from __future__ import annotations

import pytest

from utils.inventory_converter import (
    convert_saved_inventory_to_operations,
    tree_to_operations,
)

# ── tree_to_operations ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_tree_to_operations_empty_tree():
    """Tree with no items returns empty list."""
    tree = {"type": "root", "internalLogic": "AND", "items": []}
    assert tree_to_operations(tree) == []


@pytest.mark.unit
def test_tree_to_operations_invalid_input():
    """Non-dict input returns empty list."""
    assert tree_to_operations(None) == []
    assert tree_to_operations("bad") == []


@pytest.mark.unit
def test_tree_to_operations_single_condition():
    """Single condition item is converted to one operation."""
    tree = {
        "type": "root",
        "internalLogic": "AND",
        "items": [{"field": "location", "operator": "equals", "value": "NYC"}],
    }
    ops = tree_to_operations(tree)
    assert len(ops) == 1
    assert ops[0].conditions[0].field == "location"
    assert ops[0].conditions[0].operator == "equals"
    assert ops[0].conditions[0].value == "NYC"


@pytest.mark.unit
def test_tree_to_operations_multiple_conditions():
    """Multiple conditions at root are combined into one AND operation."""
    tree = {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"field": "location", "operator": "equals", "value": "NYC"},
            {"field": "role", "operator": "equals", "value": "router"},
        ],
    }
    ops = tree_to_operations(tree)
    assert len(ops) == 1
    assert ops[0].operation_type == "AND"
    assert len(ops[0].conditions) == 2


@pytest.mark.unit
def test_tree_to_operations_or_logic():
    """OR root logic produces an OR operation."""
    tree = {
        "type": "root",
        "internalLogic": "OR",
        "items": [
            {"field": "location", "operator": "equals", "value": "NYC"},
            {"field": "location", "operator": "equals", "value": "LAX"},
        ],
    }
    ops = tree_to_operations(tree)
    assert len(ops) == 1
    assert ops[0].operation_type == "OR"


@pytest.mark.unit
def test_tree_to_operations_group_item():
    """Group item is converted to a nested operation."""
    tree = {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "type": "group",
                "logic": "AND",
                "internalLogic": "OR",
                "items": [
                    {"field": "role", "operator": "equals", "value": "switch"},
                    {"field": "role", "operator": "equals", "value": "router"},
                ],
            }
        ],
    }
    ops = tree_to_operations(tree)
    assert len(ops) == 1
    # The single group becomes its own operation
    assert ops[0].operation_type == "OR"
    assert len(ops[0].conditions) == 2


@pytest.mark.unit
def test_tree_to_operations_not_group():
    """NOT group is marked with operation_type='NOT'."""
    tree = {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "type": "group",
                "logic": "NOT",
                "internalLogic": "AND",
                "items": [
                    {"field": "status", "operator": "equals", "value": "retired"}
                ],
            }
        ],
    }
    ops = tree_to_operations(tree)
    not_ops = [op for op in ops if op.operation_type == "NOT"]
    assert len(not_ops) == 1


# ── convert_saved_inventory_to_operations ──────────────────────────────────────


@pytest.mark.unit
def test_convert_saved_inventory_empty_list():
    """Empty list returns empty operations."""
    assert convert_saved_inventory_to_operations([]) == []


@pytest.mark.unit
def test_convert_saved_inventory_version_2():
    """Version 2 format with a simple tree is converted correctly."""
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
    ops = convert_saved_inventory_to_operations(conditions)
    assert len(ops) == 1
    assert ops[0].conditions[0].field == "location"


@pytest.mark.unit
def test_convert_saved_inventory_unsupported_version():
    """Unsupported version raises ValueError."""
    conditions = [{"version": 1, "operations": []}]
    with pytest.raises(ValueError, match="Unsupported conditions format version"):
        convert_saved_inventory_to_operations(conditions)


@pytest.mark.unit
def test_convert_saved_inventory_non_list_raises():
    """Non-list conditions raise ValueError."""
    with pytest.raises(ValueError, match="Conditions must be a list"):
        convert_saved_inventory_to_operations({"version": 2})


@pytest.mark.unit
def test_convert_saved_inventory_missing_tree():
    """Version 2 without 'tree' key raises ValueError."""
    conditions = [{"version": 2}]
    with pytest.raises(ValueError, match="Missing tree structure"):
        convert_saved_inventory_to_operations(conditions)


@pytest.mark.unit
def test_convert_saved_inventory_non_dict_item_raises():
    """Non-dict first item raises ValueError."""
    with pytest.raises(ValueError, match="Invalid conditions format"):
        convert_saved_inventory_to_operations(["not-a-dict"])
