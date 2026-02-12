import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { VMDropdownsResponse } from '../../types'

interface UseVMDropdownsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseVMDropdownsQueryOptions = {
  enabled: true,
}

/**
 * Fetches all VM dropdown data in parallel
 * Cached for 5 minutes (static data)
 */
export function useVMDropdownsQuery(
  options: UseVMDropdownsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.vmDropdowns(),
    queryFn: async (): Promise<VMDropdownsResponse> => {
      const [
        roles,
        statuses,
        clusters,
        clusterGroups,
        platforms,
        namespaces,
        tags,
        interfaceTypes,
        interfaceStatuses,
        ipRoles,
      ] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/roles/vm', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/statuses/vm', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/virtualization/clusters', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/virtualization/cluster-groups', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/platforms', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/namespaces', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/tags/vm', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/interface-types', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/statuses/interface', { method: 'GET' }).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiCall<any>('nautobot/roles/ipaddress', { method: 'GET' }).catch(() => []),
      ])

      return {
        roles: Array.isArray(roles) ? roles : [],
        statuses: Array.isArray(statuses) ? statuses : [],
        clusters: Array.isArray(clusters) ? clusters : [],
        clusterGroups: Array.isArray(clusterGroups) ? clusterGroups : [],
        platforms: Array.isArray(platforms) ? platforms : [],
        namespaces: Array.isArray(namespaces) ? namespaces : [],
        tags: Array.isArray(tags) ? tags : [],
        interfaceTypes: Array.isArray(interfaceTypes) ? interfaceTypes : [],
        interfaceStatuses: Array.isArray(interfaceStatuses) ? interfaceStatuses : [],
        ipRoles: Array.isArray(ipRoles) ? ipRoles : [],
      }
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000,
  })
}
