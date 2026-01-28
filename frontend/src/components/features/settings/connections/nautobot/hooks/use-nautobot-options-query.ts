import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NautobotOptionsData, NautobotOption, LocationItem } from '../types'
import { CACHE_TIME, EMPTY_ARRAY } from '../utils/constants'
import { buildLocationHierarchy } from '../utils/location-utils'

interface UseNautobotOptionsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotOptionsQueryOptions = { enabled: true }

/**
 * Fetch all Nautobot dropdown options in parallel with automatic caching
 * Consolidates 9 separate API calls into a single query
 */
export function useNautobotOptionsQuery(
  options: UseNautobotOptionsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.options(),
    queryFn: async (): Promise<NautobotOptionsData> => {
      // Load all options in parallel
      const [
        deviceStatusesRes,
        interfaceStatusesRes,
        ipAddressStatusesRes,
        ipPrefixStatusesRes,
        namespacesRes,
        deviceRolesRes,
        platformsRes,
        locationsRes,
        secretGroupsRes,
      ] = await Promise.all([
        apiCall('nautobot/statuses/device'),
        apiCall('nautobot/statuses/interface'),
        apiCall('nautobot/statuses/ipaddress'),
        apiCall('nautobot/statuses/prefix'),
        apiCall('nautobot/namespaces'),
        apiCall('nautobot/roles/devices'),
        apiCall('nautobot/platforms'),
        apiCall('nautobot/locations'),
        apiCall('nautobot/secret-groups'),
      ])

      // Build location hierarchy
      const rawLocations = Array.isArray(locationsRes) ? locationsRes : EMPTY_ARRAY
      const processedLocations = buildLocationHierarchy(rawLocations as LocationItem[])

      return {
        deviceStatuses: Array.isArray(deviceStatusesRes) ? deviceStatusesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        interfaceStatuses: Array.isArray(interfaceStatusesRes) ? interfaceStatusesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        ipAddressStatuses: Array.isArray(ipAddressStatusesRes) ? ipAddressStatusesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        ipPrefixStatuses: Array.isArray(ipPrefixStatusesRes) ? ipPrefixStatusesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        namespaces: Array.isArray(namespacesRes) ? namespacesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        deviceRoles: Array.isArray(deviceRolesRes) ? deviceRolesRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        platforms: Array.isArray(platformsRes) ? platformsRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
        locations: processedLocations,
        secretGroups: Array.isArray(secretGroupsRes) ? secretGroupsRes as NautobotOption[] : EMPTY_ARRAY as NautobotOption[],
      }
    },
    enabled,
    staleTime: CACHE_TIME.OPTIONS,
  })
}
