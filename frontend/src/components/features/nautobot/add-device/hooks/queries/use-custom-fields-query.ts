import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { CustomField } from '../../types'

interface UseCustomFieldsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCustomFieldsQueryOptions = {
  enabled: false,
}

export function useCustomFieldsQuery(
  options: UseCustomFieldsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.customFields('devices'),
    queryFn: async (): Promise<CustomField[]> => {
      const data = await apiCall<CustomField[]>('nautobot/custom-fields/devices', { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}

// Separate query for custom field choices
export function useCustomFieldChoicesQuery(fieldKey: string, enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.customFieldChoices(fieldKey),
    queryFn: async (): Promise<string[]> => {
      const data = await apiCall<string[]>(`nautobot/custom-field-choices/${fieldKey}`, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
