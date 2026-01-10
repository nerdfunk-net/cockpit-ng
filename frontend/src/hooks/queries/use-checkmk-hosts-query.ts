import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CheckMKHost } from '@/types/checkmk/types'

interface CheckMKHostsResponse {
  hosts?: CheckMKHost[]
}

interface UseCheckmkHostsQueryOptions {
  filters?: {
    folder?: string
    name?: string
  }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCheckmkHostsQueryOptions = {}

/**
 * Hook for fetching CheckMK hosts using TanStack Query
 *
 * Provides automatic caching, refetching, and loading states for CheckMK hosts.
 * Supports optional filtering by folder and name.
 *
 * @param options.filters - Optional filters to apply to hosts query
 * @param options.filters.folder - Filter hosts by folder path
 * @param options.filters.name - Filter hosts by name (partial match)
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useCheckmkHostsQuery({
 *   filters: { folder: '/network/switches' }
 * })
 *
 * const hosts = data?.hosts || []
 * ```
 */
export function useCheckmkHostsQuery(options: UseCheckmkHostsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmk.hosts(filters),

    queryFn: async () => {
      return apiCall<CheckMKHostsResponse>('checkmk/hosts', { method: 'GET' })
    },

    // Only run if enabled
    enabled,

    // Cache for 30 seconds (inherited from global config)
    // Hosts data doesn't change frequently, but we want fresh data on focus
    staleTime: 30 * 1000,

    // Keep in cache for 5 minutes (inherited from global config)
    gcTime: 5 * 60 * 1000,
  })
}

// Export types
export type { CheckMKHostsResponse }
