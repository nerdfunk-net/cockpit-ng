import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { DEVICE_SEARCH_MIN_CHARS } from '../constants'
import type { DeviceSearchResult } from '../types'

const EMPTY_RESULTS: DeviceSearchResult[] = []

interface UseDeviceSearchQueryOptions {
  query: string
  locationId?: string
  enabled?: boolean
}

interface NautobotDeviceListItem {
  id: string
  name: string
}

export function useDeviceSearchQuery({
  query,
  locationId,
  enabled = true,
}: UseDeviceSearchQueryOptions) {
  const { apiCall } = useApi()

  const isEnabled = enabled && query.length >= DEVICE_SEARCH_MIN_CHARS

  const searchQuery = useQuery({
    queryKey: queryKeys.nautobot.deviceSearch({ query, location_id: locationId }),
    queryFn: async (): Promise<DeviceSearchResult[]> => {
      const params = new URLSearchParams({ name_ic: query })
      if (locationId) {
        params.append('location_id', locationId)
      }
      const result = await apiCall<NautobotDeviceListItem[] | { devices?: NautobotDeviceListItem[] }>(
        `nautobot/devices?${params.toString()}`
      )
      // Handle both array and paginated response
      const items = Array.isArray(result)
        ? result
        : (result as { devices?: NautobotDeviceListItem[] }).devices ?? []
      return items.map((d) => ({ id: d.id, name: d.name }))
    },
    enabled: isEnabled,
    staleTime: 0,
  })

  return {
    results: searchQuery.data ?? EMPTY_RESULTS,
    isSearching: searchQuery.isFetching,
  }
}
