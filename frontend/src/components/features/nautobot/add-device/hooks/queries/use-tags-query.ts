import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { TagItem } from '../../types'

interface UseTagsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTagsQueryOptions = {
  enabled: false, // Only fetch when modal is open
}

export function useTagsQuery(options: UseTagsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.tags('devices'),
    queryFn: async (): Promise<TagItem[]> => {
      const data = await apiCall<TagItem[]>('nautobot/tags/devices', { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
