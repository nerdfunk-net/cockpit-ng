import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface NautobotLocation {
  id: string
  name: string
  parent?: {
    id: string
  }
}

interface UseNautobotRestQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotRestQueryOptions = {}

/**
 * Hook for fetching Nautobot locations via REST API
 *
 * Provides automatic caching and refetching for locations.
 * Returns locations with parent relationships for building hierarchies.
 *
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNautobotLocationsRestQuery()
 *
 * const locations = data || []
 * ```
 */
export function useNautobotLocationsRestQuery(options: UseNautobotRestQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),

    queryFn: async () => {
      return apiCall<NautobotLocation[]>('nautobot/locations', { method: 'GET' })
    },

    // Only run if enabled
    enabled,

    // Locations don't change frequently, cache for 5 minutes
    staleTime: 5 * 60 * 1000,

    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  })
}

// Export types
export type { NautobotLocation }
