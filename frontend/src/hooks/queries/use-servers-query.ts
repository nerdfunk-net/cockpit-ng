import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ListServersResponse } from '@/components/features/server-clients/server/types'

interface UseServersQueryOptions {
  search?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServersQueryOptions = {}

export function useServersQuery(options: UseServersQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { search, enabled = true } = options
  const trimmedSearch = search?.trim() ?? ''
  const queryFilter = trimmedSearch ? { q: trimmedSearch } : undefined

  return useQuery({
    queryKey: queryKeys.servers.list(queryFilter),
    queryFn: () => {
      const params = trimmedSearch
        ? `?q=${encodeURIComponent(trimmedSearch)}`
        : ''
      return apiCall<ListServersResponse>(`servers${params}`)
    },
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  })
}
