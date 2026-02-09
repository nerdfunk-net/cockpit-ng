/**
 * Utility functions for working with ConditionTree
 */

import {
  ConditionTree,
  ConditionGroup,
  ConditionItem
} from '@/types/shared/device-selector'

/**
 * Format operator for display
 */
function formatOperator(operator: string): string {
  const operatorMap: Record<string, string> = {
    'equals': '=',
    'not_equals': '!=',
    'contains': 'contains',
    'not_contains': 'not contains',
    'starts_with': 'starts with',
    'ends_with': 'ends with',
    'greater_than': '>',
    'less_than': '<',
    'is_empty': 'is empty',
    'is_not_empty': 'is not empty'
  }
  return operatorMap[operator] || operator
}

/**
 * Convert a condition tree to a human-readable expression string
 */
export function conditionTreeToExpression(tree: ConditionTree | ConditionGroup | null | undefined): string {
  if (!tree || !tree.items || tree.items.length === 0) {
    return 'No conditions'
  }

  const items = tree.items
  const logic = tree.internalLogic || 'AND'

  // Convert each item to string
  const parts = items.map((item, index) => {
    if ('type' in item && item.type === 'group') {
      // Recursive: handle nested group
      const groupExpr = conditionTreeToExpression(item as ConditionGroup)
      const prefix = index > 0 ? ` ${item.logic} ` : ''
      return `${prefix}(${groupExpr})`
    } else {
      // Base condition
      const cond = item as ConditionItem
      const operator = formatOperator(cond.operator)
      return `${cond.field} ${operator} "${cond.value}"`
    }
  })

  // Join with internal logic
  if (items.length === 1) {
    return parts[0] || ''
  }

  // Join all parts with the internal logic
  return parts.map((part, index) => {
    if (index === 0) return part
    // Check if part already has a logic prefix (from nested groups)
    if (part.trim().startsWith('AND ') || part.trim().startsWith('OR ') || part.trim().startsWith('NOT ')) {
      return part
    }
    return `${logic} ${part}`
  }).join(' ')
}
