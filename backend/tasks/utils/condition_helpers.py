"""
Helper functions for condition conversion and filtering.
Moved from job_tasks.py to improve code organization.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)


def convert_conditions_to_operations(conditions: list) -> list:
    """
    Convert SavedInventoryConditions to LogicalOperations.

    The saved inventory stores conditions with a 'logic' field (AND, OR, NOT).
    We need to convert these to the LogicalOperation format used by preview_inventory.

    Args:
        conditions: List of SavedInventoryCondition objects

    Returns:
        List of LogicalOperation objects
    """
    from models.ansible_inventory import LogicalOperation, LogicalCondition

    if not conditions:
        return []

    operations = []
    current_op_type = "AND"  # Default
    current_conditions = []

    for cond in conditions:
        # Get the logic type (AND, OR, NOT)
        logic = getattr(cond, 'logic', 'AND').upper()

        # Create LogicalCondition
        lc = LogicalCondition(
            field=cond.field,
            operator=cond.operator,
            value=cond.value
        )

        if logic == "NOT":
            # NOT operations should be separate
            if current_conditions:
                # First, add the current conditions as an operation
                operations.append(LogicalOperation(
                    operation_type=current_op_type,
                    conditions=current_conditions,
                    nested_operations=[]
                ))
                current_conditions = []

            # Add NOT operation separately
            operations.append(LogicalOperation(
                operation_type="NOT",
                conditions=[lc],
                nested_operations=[]
            ))
        else:
            # For AND/OR, group conditions
            if current_conditions and logic != current_op_type:
                # Logic type changed, create new operation
                operations.append(LogicalOperation(
                    operation_type=current_op_type,
                    conditions=current_conditions,
                    nested_operations=[]
                ))
                current_conditions = []

            current_op_type = logic
            current_conditions.append(lc)

    # Add any remaining conditions
    if current_conditions:
        operations.append(LogicalOperation(
            operation_type=current_op_type,
            conditions=current_conditions,
            nested_operations=[]
        ))

    return operations
