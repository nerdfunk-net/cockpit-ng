/**
 * Utility functions for Ansible Inventory Builder
 */

import type { LogicalCondition, FieldOption, LocationItem } from '../types'

/**
 * Get the display label for a field value
 */
export function getFieldLabel(field: string, fieldOptions: FieldOption[]): string {
  const option = fieldOptions.find(opt => opt.value === field)
  return option?.label || field
}

/**
 * Get the badge color class for a logic operator
 */
export function getLogicBadgeColor(logic: string): string {
  switch (logic) {
    case 'AND': return 'bg-green-100 text-green-800'
    case 'OR': return 'bg-yellow-100 text-yellow-800'
    case 'AND NOT': return 'bg-red-100 text-red-800'
    default: return 'bg-blue-100 text-blue-800'
  }
}

/**
 * Get the badge color class for a device status
 */
export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'planned': return 'bg-blue-100 text-blue-800'
    case 'staged': return 'bg-yellow-100 text-yellow-800'
    case 'failed': return 'bg-red-100 text-red-800'
    case 'offline': return 'bg-gray-100 text-gray-800'
    default: return 'bg-blue-100 text-blue-800'
  }
}

/**
 * Format device value for display, handling undefined/null
 */
export function formatDeviceValue(value: string | undefined): string {
  return value || 'N/A'
}

/**
 * Build operations structure from conditions for API submission
 */
export function buildOperationsFromConditions(conditions: LogicalCondition[]) {
  if (conditions.length === 0) return []

  if (conditions.length === 1 && conditions[0]) {
    return [{
      operation_type: 'AND',
      conditions: [{
        field: conditions[0].field,
        operator: conditions[0].operator,
        value: conditions[0].value
      }],
      nested_operations: []
    }]
  }

  // Group conditions by logic operator
  const andConditions: Array<{field: string, operator: string, value: string}> = []
  const orConditions: Array<{field: string, operator: string, value: string}> = []
  const notConditions: Array<{field: string, operator: string, value: string}> = []

  conditions.forEach((condition, index) => {
    const conditionData = {
      field: condition.field,
      operator: condition.operator,
      value: condition.value
    }

    if (index === 0) {
      andConditions.push(conditionData)
    } else {
      switch (condition.logic) {
        case 'AND':
          andConditions.push(conditionData)
          break
        case 'OR':
          orConditions.push(conditionData)
          break
        case 'NOT':
          notConditions.push(conditionData)
          break
      }
    }
  })

  const operations = []

  // Add OR operation if we have OR conditions
  if (orConditions.length > 0) {
    operations.push({
      operation_type: 'OR',
      conditions: [...andConditions, ...orConditions],
      nested_operations: []
    })
  } else if (andConditions.length > 0) {
    operations.push({
      operation_type: 'AND',
      conditions: andConditions,
      nested_operations: []
    })
  }

  // Add NOT operations
  notConditions.forEach(condition => {
    operations.push({
      operation_type: 'NOT',
      conditions: [condition],
      nested_operations: []
    })
  })

  return operations
}

/**
 * Build hierarchical location structure
 */
export function buildLocationHierarchy(locationData: LocationItem[]): LocationItem[] {
  const locationMap = new Map<string, LocationItem>()
  const rootLocations: LocationItem[] = []

  // First pass: Create map of all locations
  locationData.forEach(loc => {
    locationMap.set(loc.id, { ...loc })
  })

  // Second pass: Build hierarchy
  locationData.forEach(loc => {
    const locationItem = locationMap.get(loc.id)
    if (!locationItem) return

    if (loc.parent?.id) {
      // Has a parent - this is handled by the API's hierarchicalPath
    } else {
      rootLocations.push(locationItem)
    }
  })

  return locationData // Return all locations with hierarchicalPath
}

/**
 * Update operator options based on field type
 */
export function updateOperatorOptions(fieldName: string, baseOperators: FieldOption[]): FieldOption[] {
  // Fields that should only have equals operator
  const equalsOnlyFields = ['status', 'role', 'location', 'device_type', 'manufacturer', 'platform', 'site']
  
  if (equalsOnlyFields.includes(fieldName)) {
    return baseOperators.filter(op => op.value === 'equals')
  }

  return baseOperators
}
