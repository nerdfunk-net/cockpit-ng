import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { VlanItem } from '../../types'

interface UseVlansQueryOptions {
  locationName?: string
  includeGlobal?: boolean
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseVlansQueryOptions = {
  includeGlobal: true,
  enabled: false,
}

export function useVlansQuery(options: UseVlansQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { locationName, includeGlobal = true, enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.vlans({ location: locationName, global: includeGlobal }),
    queryFn: async (): Promise<VlanItem[]> => {
      let url = 'nautobot/vlans'
      const params = new URLSearchParams()

      if (includeGlobal) {
        params.append('get_global_vlans', 'true')
      }
      if (locationName) {
        params.append('location', locationName)
      }

      const queryString = params.toString()
      const fullUrl = queryString ? `${url}?${queryString}` : url

      const data = await apiCall<VlanItem[]>(fullUrl, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.DYNAMIC,
  })
}
