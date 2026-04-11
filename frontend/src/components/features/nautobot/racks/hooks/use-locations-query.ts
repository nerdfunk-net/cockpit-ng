import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { RACK_STALE_TIMES } from '../constants'
import type { LocationItem } from '../../add-device/types'

const EMPTY_LOCATIONS: LocationItem[] = []

export function useLocationsQuery() {
  const { apiCall } = useApi()

  const query = useQuery({
    queryKey: queryKeys.nautobot.locations(),
    queryFn: async () => {
      const result = await apiCall<LocationItem[]>('nautobot/locations')
      return Array.isArray(result) ? result : EMPTY_LOCATIONS
    },
    staleTime: RACK_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000,
  })

  return {
    locations: query.data ?? EMPTY_LOCATIONS,
    isLoading: query.isLoading,
  }
}
