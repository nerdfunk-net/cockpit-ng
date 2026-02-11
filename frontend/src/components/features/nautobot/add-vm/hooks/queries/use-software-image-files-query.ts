import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { QUERY_STALE_TIMES } from '../../constants'
import type { SoftwareImageOption } from '../../types'

interface UseSoftwareImageFilesQueryOptions {
  softwareVersion?: string
}

const DEFAULT_OPTIONS: UseSoftwareImageFilesQueryOptions = {}

/**
 * Fetches software image files, optionally filtered by software version string.
 * Refetches when softwareVersion changes.
 */
export function useSoftwareImageFilesQuery(
  options: UseSoftwareImageFilesQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { softwareVersion } = options

  return useQuery({
    queryKey: ['nautobot', 'software-image-files', softwareVersion ?? 'all'] as const,
    queryFn: async (): Promise<SoftwareImageOption[]> => {
      const params = softwareVersion ? `?software_version=${encodeURIComponent(softwareVersion)}` : ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await apiCall<any>(`nautobot/software-image-files${params}`, { method: 'GET' }).catch(() => [])
      return Array.isArray(data) ? data : []
    },
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000,
  })
}
