import { useQuery, useQueries } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CustomField, CustomFieldChoice } from '../types'
import { CACHE_TIME, EMPTY_ARRAY } from '../utils/constants'

interface UseCustomFieldsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCustomFieldsQueryOptions = { enabled: true }

/**
 * Fetch custom fields for devices
 */
export function useCustomFieldsQuery(
  options: UseCustomFieldsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.customFields(),
    queryFn: async () => {
      const response = await apiCall('nautobot/custom-fields/devices')
      return Array.isArray(response) ? response as CustomField[] : EMPTY_ARRAY as CustomField[]
    },
    enabled,
    staleTime: CACHE_TIME.CUSTOM_FIELDS,
  })
}

/**
 * Fetch custom field choices for all select-type fields
 */
export function useCustomFieldChoicesQueries(customFields: CustomField[]) {
  const { apiCall } = useApi()

  // Get all select-type fields
  const selectFields = customFields.filter(field => field.type?.value === 'select')

  return useQueries({
    queries: selectFields.map(field => {
      const fieldName = field.name || field.key || field.id

      return {
        queryKey: queryKeys.nautobotSettings.customFieldChoices(fieldName),
        queryFn: async () => {
          try {
            const choices = await apiCall(`nautobot/custom-field-choices/${fieldName}`)
            return {
              fieldName,
              choices: Array.isArray(choices) ? choices as CustomFieldChoice[] : EMPTY_ARRAY as CustomFieldChoice[],
            }
          } catch (error) {
            console.error(`Error loading choices for ${fieldName}:`, error)
            return { fieldName, choices: EMPTY_ARRAY as CustomFieldChoice[] }
          }
        },
        staleTime: CACHE_TIME.CUSTOM_FIELDS,
      }
    }),
  })
}
