import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FieldOption, CustomField, LocationItem } from '@/types/shared/device-selector'

/**
 * Hook for fetching inventory field options
 *
 * Returns available fields, operators, and logical operations for device filtering.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useInventoryFieldOptionsQuery()
 *
 * const fields = data?.fields || []
 * const operators = data?.operators || []
 * ```
 */
export function useInventoryFieldOptionsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.inventory.fieldOptions(),

    queryFn: async () => {
      return apiCall<{
        fields: FieldOption[]
        operators: FieldOption[]
        logical_operations: FieldOption[]
      }>('inventory/field-options')
    },

    // Field options are static - cache aggressively
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
  })
}

/**
 * Hook for fetching field values for a specific field
 *
 * Returns available values for a given field (e.g., all device types, all roles).
 *
 * @param fieldName - The field to get values for (e.g., 'role', 'device_type')
 * @param enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data: fieldValues, isLoading } = useInventoryFieldValuesQuery('role')
 * ```
 */
export function useInventoryFieldValuesQuery(fieldName: string | null, enabled = true) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.inventory.fieldValues(fieldName || ''),

    queryFn: async () => {
      if (!fieldName) return { field: '', values: [], input_type: 'select' }

      return apiCall<{
        field: string
        values: FieldOption[]
        input_type: string
      }>(`inventory/field-values/${fieldName}`)
    },

    // Only run if fieldName exists and is not 'custom_fields' or 'has_primary'
    enabled: !!fieldName && fieldName !== 'custom_fields' && fieldName !== 'has_primary' && enabled,

    // Field values change less frequently
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  })
}

/**
 * Hook for fetching custom fields
 *
 * Returns all available custom fields for device filtering.
 *
 * @param enabled - Whether to enable the query (default: false - load on demand)
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useInventoryCustomFieldsQuery()
 *
 * const customFields = data?.custom_fields || []
 * ```
 */
export function useInventoryCustomFieldsQuery(enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.inventory.customFields(),

    queryFn: async () => {
      return apiCall<{ custom_fields: CustomField[] }>('inventory/custom-fields')
    },

    // Only run when explicitly enabled
    enabled,

    // Custom fields are relatively static
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,    // 20 minutes
  })
}

/**
 * Hook for fetching Nautobot locations
 *
 * Returns all available locations for device filtering with hierarchy.
 *
 * @param enabled - Whether to enable the query (default: false - load on demand)
 *
 * @example
 * ```tsx
 * const { data: locations, isLoading } = useNautobotLocationsQuery()
 * ```
 */
export function useNautobotLocationsQuery(enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),

    queryFn: async () => {
      return apiCall<LocationItem[]>('nautobot/locations')
    },

    // Only run when explicitly enabled
    enabled,

    // Locations are relatively static
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,    // 20 minutes
  })
}

export type { FieldOption, CustomField, LocationItem }
