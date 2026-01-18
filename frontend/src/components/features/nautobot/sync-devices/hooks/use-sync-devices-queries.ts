import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Device, DropdownOption, LocationItem, NautobotDefaults } from '../types'

// Devices query
export function useDevicesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.devices(),
    queryFn: async () => {
      const data = await apiCall<{ devices: Device[] }>('nautobot/devices')
      return data?.devices ?? []
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Reload devices (bypasses cache)
export function useReloadDevices() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()

  const reloadDevices = async () => {
    const data = await apiCall<{ devices: Device[] }>('nautobot/devices?reload=true')
    const devices = data?.devices ?? []
    // Update the cache with fresh data
    queryClient.setQueryData(queryKeys.nautobot.devices(), devices)
    return devices
  }

  return { reloadDevices }
}

// Namespaces query
export function useNamespacesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.namespaces(),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/namespaces')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (static data)
  })
}

// Locations query
export function useLocationsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),
    queryFn: async () => {
      const data = await apiCall<LocationItem[]>('nautobot/locations')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Nautobot defaults query
export function useNautobotDefaultsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.defaults(),
    queryFn: async () => {
      const response = await apiCall<{
        success: boolean
        data?: NautobotDefaults
      }>('settings/nautobot/defaults')
      return response?.data ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Prefix statuses query
export function usePrefixStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses('prefix'),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/prefix')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Interface statuses query
export function useInterfaceStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses('interface'),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/interface')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

// IP Address statuses query
export function useIPAddressStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses('ipaddress'),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/ipaddress')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
