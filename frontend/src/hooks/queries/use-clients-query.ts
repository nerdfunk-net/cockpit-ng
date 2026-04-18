import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface NautobotDevice {
  id: string
  name: string
  primary_ip4?: { address?: string }
  platform?: { name?: string }
}

export interface NautobotDevicesSearchResponse {
  devices: NautobotDevice[]
  count: number
  has_more: boolean
}

export interface ClientDataItem {
  ip_address: string | null
  mac_address: string | null
  port: string | null
  vlan: string | null
  hostname: string | null
  device_name: string
  session_id: string
  collected_at: string | null
}

export interface ClientDataResponse {
  items: ClientDataItem[]
  total: number
  page: number
  page_size: number
}

export interface ClientDataFilters {
  deviceName?: string
  ipAddress?: string
  macAddress?: string
  port?: string
  vlan?: string
  hostname?: string
  page?: number
  pageSize?: number
}

const EMPTY_DEVICES: string[] = []
const DEFAULT_FILTERS: ClientDataFilters = {}

const EMPTY_NAUTOBOT_RESPONSE: NautobotDevicesSearchResponse = {
  devices: [],
  count: 0,
  has_more: false,
}

export function useClientDevicesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.clients.devices(),
    queryFn: async () => {
      const response = await apiCall<{ devices: string[] }>('/api/clients/devices', {
        method: 'GET',
      })
      return response?.devices ?? EMPTY_DEVICES
    },
    staleTime: 60 * 1000,
  })
}

export function useClientDataQuery(filters: ClientDataFilters = DEFAULT_FILTERS) {
  const { apiCall } = useApi()

  const {
    deviceName,
    ipAddress,
    macAddress,
    port,
    vlan,
    hostname,
    page = 1,
    pageSize = 50,
  } = filters

  const queryFilters = useMemo(
    () => ({
      device_name: deviceName,
      ip_address: ipAddress,
      mac_address: macAddress,
      port,
      vlan,
      hostname,
      page,
      page_size: pageSize,
    }),
    [deviceName, ipAddress, macAddress, port, vlan, hostname, page, pageSize]
  )

  return useQuery({
    queryKey: queryKeys.clients.data(queryFilters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (deviceName) params.set('device_name', deviceName)
      if (ipAddress) params.set('ip_address', ipAddress)
      if (macAddress) params.set('mac_address', macAddress)
      if (port) params.set('port', port)
      if (vlan) params.set('vlan', vlan)
      if (hostname) params.set('hostname', hostname)
      params.set('page', String(page))
      params.set('page_size', String(pageSize))

      const response = await apiCall<ClientDataResponse>(
        `/api/clients/data?${params.toString()}`,
        { method: 'GET' }
      )
      return response ?? { items: [], total: 0, page, page_size: pageSize }
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

export function useNautobotDevicesSearchQuery(params: {
  search: string
  page: number
  pageSize: number
}) {
  const { apiCall } = useApi()
  const { search, page, pageSize } = params
  const offset = (page - 1) * pageSize

  return useQuery({
    queryKey: ['nautobot', 'clients-device-search', { search, page, pageSize }],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (search) {
        p.set('filter_type', 'name__ic')
        p.set('filter_value', search)
      }
      p.set('limit', String(pageSize))
      p.set('offset', String(offset))
      const res = await apiCall<NautobotDevicesSearchResponse>(
        `nautobot/devices?${p.toString()}`,
        { method: 'GET' }
      )
      return res ?? EMPTY_NAUTOBOT_RESPONSE
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface IpHistoryEntry {
  ip_address: string
  mac_address: string | null
  port: string | null
  vlan: string | null
  device_name: string
  collected_at: string | null
}

export interface MacHistoryEntry {
  mac_address: string
  ip_address: string | null
  port: string | null
  vlan: string | null
  device_name: string
  collected_at: string | null
}

export interface HostnameHistoryEntry {
  hostname: string
  ip_address: string | null
  device_name: string
  collected_at: string | null
}

export interface ClientHistoryResponse {
  ip_history: IpHistoryEntry[]
  mac_history: MacHistoryEntry[]
  hostname_history: HostnameHistoryEntry[]
}

export interface ClientHistoryParams {
  ip_address?: string | null
  mac_address?: string | null
  hostname?: string | null
}

const EMPTY_HISTORY: ClientHistoryResponse = {
  ip_history: [],
  mac_history: [],
  hostname_history: [],
}

export interface DeviceFilter {
  role?: string
  status?: string
  device_type?: string
  location?: string
}

export interface FilteredDeviceItem {
  id: string
  name: string
  role?: { id: string; name: string }
  status?: { id: string; name: string }
  location?: { id: string; name: string }
  device_type?: { id: string; model: string; manufacturer?: { id: string; name: string } }
}

export interface FilteredDevicesResponse {
  devices: FilteredDeviceItem[]
  count: number
}

const EMPTY_FILTERED_RESPONSE: FilteredDevicesResponse = { devices: [], count: 0 }

export function useFilteredDevicesQuery(filter: DeviceFilter | null) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: ['nautobot', 'devices-filter', filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter?.role) params.set('role', filter.role)
      if (filter?.status) params.set('device_status', filter.status)
      if (filter?.device_type) params.set('device_type', filter.device_type)
      if (filter?.location) params.set('location', filter.location)
      const res = await apiCall<FilteredDevicesResponse>(
        `nautobot/devices/use-filter?${params.toString()}`,
        { method: 'GET' }
      )
      return res ?? EMPTY_FILTERED_RESPONSE
    },
    enabled: filter !== null,
    staleTime: 30 * 1000,
  })
}

export function useClientHistoryQuery(params: ClientHistoryParams, enabled: boolean) {
  const { apiCall } = useApi()
  const { ip_address, mac_address, hostname } = params

  return useQuery({
    queryKey: queryKeys.clients.history({
      ip_address: ip_address ?? undefined,
      mac_address: mac_address ?? undefined,
      hostname: hostname ?? undefined,
    }),
    queryFn: async () => {
      const p = new URLSearchParams()
      if (ip_address) p.set('ip_address', ip_address)
      if (mac_address) p.set('mac_address', mac_address)
      if (hostname) p.set('hostname', hostname)
      const res = await apiCall<ClientHistoryResponse>(
        `/api/clients/history?${p.toString()}`,
        { method: 'GET' }
      )
      return res ?? EMPTY_HISTORY
    },
    enabled,
    staleTime: 30 * 1000,
  })
}
