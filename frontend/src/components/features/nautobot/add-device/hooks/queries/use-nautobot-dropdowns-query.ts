import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { NautobotDropdownsResponse } from '../../types'

interface UseNautobotDropdownsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotDropdownsQueryOptions = {
  enabled: true,
}

/**
 * Fetches all Nautobot dropdown data in parallel
 * Cached for 5 minutes (static data)
 */
export function useNautobotDropdownsQuery(
  options: UseNautobotDropdownsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.dropdowns(),
    queryFn: async (): Promise<NautobotDropdownsResponse> => {
      // Parallel API calls for all dropdown data
      const [
        roles,
        statuses,
        locations,
        deviceTypes,
        platforms,
        softwareVersions,
        interfaceTypes,
        interfaceStatuses,
        namespaces,
        nautobotDefaults,
      ] = await Promise.all([
        apiCall<any>('nautobot/roles/devices', { method: 'GET' }),
        apiCall<any>('nautobot/statuses/device', { method: 'GET' }),
        apiCall<any>('nautobot/locations', { method: 'GET' }),
        apiCall<any>('nautobot/device-types', { method: 'GET' }),
        apiCall<any>('nautobot/platforms', { method: 'GET' }),
        apiCall<any>('nautobot/software-versions', { method: 'GET' }),
        apiCall<any>('nautobot/interface-types', { method: 'GET' }),
        apiCall<any>('nautobot/statuses/interface', { method: 'GET' }),
        apiCall<any>('nautobot/namespaces', { method: 'GET' }),
        apiCall<any>('settings/nautobot/defaults', { method: 'GET' }).catch(() => null),
      ])

      return {
        roles: Array.isArray(roles) ? roles : [],
        statuses: Array.isArray(statuses) ? statuses : [],
        locations: Array.isArray(locations) ? locations : [],
        deviceTypes: Array.isArray(deviceTypes) ? deviceTypes : [],
        platforms: Array.isArray(platforms) ? platforms : [],
        softwareVersions: Array.isArray(softwareVersions) ? softwareVersions : [],
        interfaceTypes: Array.isArray(interfaceTypes) ? interfaceTypes : [],
        interfaceStatuses: Array.isArray(interfaceStatuses) ? interfaceStatuses : [],
        namespaces: Array.isArray(namespaces) ? namespaces : [],
        nautobotDefaults,
      }
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
}
