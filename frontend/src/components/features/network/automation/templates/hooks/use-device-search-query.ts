import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import type { DeviceSearchResult } from '../types/templates'
import { STALE_TIME } from '../utils/template-constants'

interface DeviceSearchResponse {
  devices: DeviceSearchResult[]
}

const EMPTY_DEVICES: DeviceSearchResult[] = []

/**
 * Debounced device search using TanStack Query.
 * Replaces manual useEffect + setTimeout debounce pattern.
 *
 * The `enabled` flag controls when the query fires:
 * - Search term must be >= 3 characters
 * - No device should already be selected
 */
export function useDeviceSearchQuery(searchTerm: string, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: ['devices', 'search', searchTerm],
    queryFn: async () => {
      const response = await apiCall<DeviceSearchResponse>(
        `nautobot/devices?filter_type=name__ic&filter_value=${encodeURIComponent(searchTerm)}`
      )
      return response.devices || EMPTY_DEVICES
    },
    enabled: enabled && searchTerm.length >= 3,
    staleTime: STALE_TIME.DEVICE_SEARCH,
    gcTime: 30 * 1000,
  })
}
