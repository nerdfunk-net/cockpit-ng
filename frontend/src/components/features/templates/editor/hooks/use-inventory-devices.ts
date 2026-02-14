import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useMemo } from 'react'

interface SimpleDevice {
  id: string
  name: string
}

interface DeviceDetail {
  id: string
  name: string
  hostname?: string
  serial?: string
  asset_tag?: string | null
  position?: number | null
  face?: string | null
  config_context?: Record<string, unknown>
  local_config_context_data?: Record<string, unknown> | null
  _custom_field_data?: Record<string, unknown>
  device_type?: {
    id: string
    model: string
    manufacturer: { id: string; name: string }
  }
  role?: { id: string; name: string }
  platform?: { 
    id: string
    name: string
    network_driver?: string
    manufacturer?: { id: string; name: string } | null
  }
  location?: { 
    id: string
    name: string
    description?: string
    parent?: { id: string; name: string }
  }
  status?: { id: string; name: string }
  primary_ip4?: {
    id: string
    address: string
    host: string
    ip_version?: number
    mask_length?: number
    description?: string
    dns_name?: string
    status?: { id: string; name: string }
    parent?: { id: string; prefix: string }
  }
  interfaces?: Array<{
    id: string
    name: string
    type: string
    enabled: boolean
    mtu?: number
    mac_address?: string
    description?: string
    status?: { id: string; name: string }
    ip_addresses?: Array<{
      id: string
      address: string
      ip_version: number
      status?: { id: string; name: string }
    }>
    connected_interface?: {
      id: string
      name: string
      device?: { id: string; name: string }
    } | null
    cable?: {
      id: string
      status?: { id: string; name: string }
    } | null
    tagged_vlans?: Array<unknown>
    untagged_vlan?: unknown | null
  }>
  console_ports?: Array<unknown>
  console_server_ports?: Array<unknown>
  power_ports?: Array<unknown>
  power_outlets?: Array<unknown>
  secrets_group?: { id: string; name: string }
  tags?: Array<{ id: string; name: string; color: string }>
}

interface InventoryDevicesResponse {
  devices: SimpleDevice[]
  device_details: DeviceDetail[]
  device_count: number
  inventory_id: number
  inventory_name: string
}

export function useInventoryDevices(inventoryId: number | null, enabled: boolean = true) {
  const { apiCall } = useApi()

  // Fetch inventory devices with full details in one call
  const {
    data: inventoryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['inventory-devices-detailed', inventoryId],
    queryFn: async () => {
      if (!inventoryId) return null
      return apiCall<InventoryDevicesResponse>(
        `inventory/resolve-devices/detailed/${inventoryId}`,
        { method: 'GET' }
      )
    },
    enabled: enabled && inventoryId !== null,
    staleTime: 30 * 1000,
  })

  // Format data for template variables
  const formattedData = useMemo(() => {
    if (!inventoryData || !inventoryData.device_details || inventoryData.device_details.length === 0) {
      return {
        devices: [],
        device_details: {},
        deviceCount: 0,
      }
    }

    // Use devices array directly from response
    const devices = inventoryData.devices

    // Convert device_details array to keyed object for easy access
    // Use device name (hostname) as key for user-friendly Jinja2 templates
    const device_details: Record<string, DeviceDetail> = {}
    inventoryData.device_details.forEach((device) => {
      device_details[device.name] = device
    })

    return {
      devices,
      device_details,
      deviceCount: inventoryData.device_count,
    }
  }, [inventoryData])

  return {
    ...formattedData,
    isLoading,
    error,
    inventoryName: inventoryData?.inventory_name || '',
  }
}
