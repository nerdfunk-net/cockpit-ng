import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { RackItem } from '../../types'

interface UseRacksQueryOptions {
  location?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRacksQueryOptions = {
  enabled: false,
}

export function useRacksQuery(options: UseRacksQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { location, enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.racks({ location }),
    queryFn: async (): Promise<RackItem[]> => {
      const params = new URLSearchParams()
      if (location) {
        params.append('location', location)
      }
      const queryString = params.toString()
      const url = queryString ? `nautobot/racks?${queryString}` : 'nautobot/racks'
      const data = await apiCall<RackItem[]>(url, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
