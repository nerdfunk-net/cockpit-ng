"""
Helper functions for condition conversion and filtering.
Moved from job_tasks.py to improve code organization.

This module now uses the shared inventory_converter utility for
tree-based structure evaluation (version 2).
"""

import logging
from utils.inventory_converter import convert_saved_inventory_to_operations

logger = logging.getLogger(__name__)


def convert_conditions_to_operations(conditions: list) -> list:
    """
    Convert saved inventory conditions to LogicalOperations.

    This function uses the shared inventory converter which supports
    the modern tree-based structure (version 2).

    Args:
        conditions: List containing tree structure in version 2 format
                   Format: [{"version": 2, "tree": {...}}]

    Returns:
        List of LogicalOperation objects

    Raises:
        ValueError: If conditions format is invalid or unsupported
    """
    return convert_saved_inventory_to_operations(conditions)
