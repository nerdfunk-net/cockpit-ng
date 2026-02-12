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
    queryKey: queryKeys.nautobot.customFields('vm'),
    queryFn: async (): Promise<CustomField[]> => {
      const data = await apiCall<CustomField[]>('nautobot/custom-fields/vm', { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
