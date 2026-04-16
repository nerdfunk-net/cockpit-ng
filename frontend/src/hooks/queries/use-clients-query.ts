import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface NautobotDevice {
  id: string
  name: string
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
