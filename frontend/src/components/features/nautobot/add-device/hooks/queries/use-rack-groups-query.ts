import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { RackGroupItem } from '../../types'

interface UseRackGroupsQueryOptions {
  location?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRackGroupsQueryOptions = {
  enabled: false,
}

export function useRackGroupsQuery(options: UseRackGroupsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { location, enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.rackGroups({ location }),
    queryFn: async (): Promise<RackGroupItem[]> => {
      const params = new URLSearchParams()
      if (location) {
        params.append('location', location)
      }
      const queryString = params.toString()
      const url = queryString ? `nautobot/rack-groups?${queryString}` : 'nautobot/rack-groups'
      const data = await apiCall<RackGroupItem[]>(url, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
