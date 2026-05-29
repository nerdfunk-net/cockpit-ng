import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ServerResponse } from '@/components/features/server-clients/server/types'

export function useServerQuery(id: number | null) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.servers.detail(id ?? 0),
    queryFn: () => apiCall<ServerResponse>(`servers/${id}`),
    enabled: id !== null,
    staleTime: 60 * 1000,
  })
}
