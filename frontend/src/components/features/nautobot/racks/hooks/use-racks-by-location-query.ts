import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { RACK_STALE_TIMES } from '../constants'
import type { RackItem } from '../../add-device/types'

const EMPTY_RACKS: RackItem[] = []

interface UseRacksByLocationQueryOptions {
  locationId?: string
}

const DEFAULT_OPTIONS: UseRacksByLocationQueryOptions = {}

export function useRacksByLocationQuery({ locationId }: UseRacksByLocationQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()

  const query = useQuery({
    queryKey: queryKeys.nautobot.racks({ location: locationId }),
    queryFn: async () => {
      const endpoint = locationId
        ? `nautobot/racks?location=${locationId}`
        : 'nautobot/racks'
      const result = await apiCall<RackItem[]>(endpoint)
      return Array.isArray(result) ? result : EMPTY_RACKS
    },
    enabled: !!locationId,
    staleTime: RACK_STALE_TIMES.SEMI_STATIC,
  })

  return {
    racks: query.data ?? EMPTY_RACKS,
    isLoading: query.isLoading,
  }
}
