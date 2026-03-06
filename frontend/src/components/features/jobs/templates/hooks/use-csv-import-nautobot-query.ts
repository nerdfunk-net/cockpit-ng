'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface NautobotItem {
  id: string
  name?: string
  display?: string
  parent?: {
    id: string
    name: string
  }
}

interface CsvImportNautobotData {
  locations: NautobotItem[]
  deviceTypes: NautobotItem[]
  deviceStatuses: NautobotItem[]
  ipAddressStatuses: NautobotItem[]
  prefixStatuses: NautobotItem[]
  deviceRoles: NautobotItem[]
  ipAddressRoles: NautobotItem[]
  prefixRoles: NautobotItem[]
  platforms: NautobotItem[]
  namespaces: NautobotItem[]
  manufacturers: NautobotItem[]
  interfaceStatuses: NautobotItem[]
  interfaceTypes: NautobotItem[]
}

interface UseCsvImportNautobotQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCsvImportNautobotQueryOptions = {}

const EMPTY_DATA: CsvImportNautobotData = {
  locations: [],
  deviceTypes: [],
  deviceStatuses: [],
  ipAddressStatuses: [],
  prefixStatuses: [],
  deviceRoles: [],
  ipAddressRoles: [],
  prefixRoles: [],
  platforms: [],
  namespaces: [],
  manufacturers: [],
  interfaceStatuses: [],
  interfaceTypes: [],
}

export function useCsvImportNautobotQuery(
  options: UseCsvImportNautobotQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.csvImportNautobotData(),
    queryFn: async (): Promise<CsvImportNautobotData> => {
      const [
        locations,
        deviceTypes,
        deviceStatuses,
        ipAddressStatuses,
        prefixStatuses,
        deviceRoles,
        ipAddressRoles,
        prefixRoles,
        platforms,
        namespaces,
        manufacturers,
        interfaceStatuses,
        interfaceTypesRaw,
      ] = await Promise.all([
        apiCall<NautobotItem[]>('nautobot/locations', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/device-types', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/statuses/device', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/statuses/ipaddress', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/statuses/prefix', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/roles/devices', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/roles/ipaddress', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/roles/prefix', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/platforms', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/namespaces', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/manufacturers', { method: 'GET' }),
        apiCall<NautobotItem[]>('nautobot/statuses/interface', { method: 'GET' }),
        apiCall<{ value: string; display_name: string }[]>('nautobot/interface-types', { method: 'GET' }),
      ])

      // interface-types uses a different response shape: { value, display_name }[]
      // Normalise to NautobotItem so the defaults panel can treat it uniformly.
      // item.id is set to the choice value (e.g. "virtual", "1000base-t") which is
      // exactly what the backend expects — it is NOT a UUID.
      const interfaceTypes: NautobotItem[] = Array.isArray(interfaceTypesRaw)
        ? interfaceTypesRaw.map((t) => ({ id: t.value, name: t.display_name }))
        : []

      return {
        locations: Array.isArray(locations) ? locations : [],
        deviceTypes: Array.isArray(deviceTypes) ? deviceTypes : [],
        deviceStatuses: Array.isArray(deviceStatuses) ? deviceStatuses : [],
        ipAddressStatuses: Array.isArray(ipAddressStatuses) ? ipAddressStatuses : [],
        prefixStatuses: Array.isArray(prefixStatuses) ? prefixStatuses : [],
        deviceRoles: Array.isArray(deviceRoles) ? deviceRoles : [],
        ipAddressRoles: Array.isArray(ipAddressRoles) ? ipAddressRoles : [],
        prefixRoles: Array.isArray(prefixRoles) ? prefixRoles : [],
        platforms: Array.isArray(platforms) ? platforms : [],
        namespaces: Array.isArray(namespaces) ? namespaces : [],
        manufacturers: Array.isArray(manufacturers) ? manufacturers : [],
        interfaceStatuses: Array.isArray(interfaceStatuses) ? interfaceStatuses : [],
        interfaceTypes,
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes — this is mostly static data
  })
}

export type { CsvImportNautobotData, NautobotItem }
export { EMPTY_DATA as EMPTY_CSV_IMPORT_NAUTOBOT_DATA }
