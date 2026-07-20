import { useMutation, useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  ServerSearchFacets,
  ServerSearchResponse,
} from '@/components/features/server-clients/search/types'

interface UseServerSearchFacetsOptions {
  enabled?: boolean
}

const DEFAULT_FACETS_OPTIONS: UseServerSearchFacetsOptions = {}

export function useServerSearchFacetsQuery(
  options: UseServerSearchFacetsOptions = DEFAULT_FACETS_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.servers.searchFacets(),
    queryFn: () => apiCall<ServerSearchFacets>('servers/search/facets'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useServerSearchMutation() {
  const { apiCall } = useApi()

  return useMutation({
    mutationFn: async (query: unknown) =>
      apiCall<ServerSearchResponse>('servers/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
  })
}
