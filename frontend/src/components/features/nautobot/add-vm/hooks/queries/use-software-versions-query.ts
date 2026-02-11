import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { SoftwareVersion } from '../../types'

interface UseSoftwareVersionsQueryOptions {
  platformName?: string
}

const DEFAULT_OPTIONS: UseSoftwareVersionsQueryOptions = {}

/**
 * Fetches software versions, optionally filtered by platform name.
 * Refetches when platformName changes.
 */
export function useSoftwareVersionsQuery(
  options: UseSoftwareVersionsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { platformName } = options

  return useQuery({
    queryKey: queryKeys.nautobot.softwareVersions(platformName),
    queryFn: async (): Promise<SoftwareVersion[]> => {
      const params = platformName ? `?platform=${encodeURIComponent(platformName)}` : ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await apiCall<any>(`nautobot/software-versions${params}`, { method: 'GET' }).catch(() => [])
      return Array.isArray(data) ? data : []
    },
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000,
  })
}
