import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ListServersResponse } from '@/components/features/server-clients/server/types'

export function useServersQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.servers.list(),
    queryFn: () => apiCall<ListServersResponse>('servers'),
    staleTime: 60 * 1000,
  })
}
