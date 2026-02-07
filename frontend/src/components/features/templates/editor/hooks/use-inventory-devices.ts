import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useMemo } from 'react'

interface InventoryDevicesResponse {
  device_ids: string[]
  device_count: number
  inventory_id: number
  inventory_name: string
}

interface DeviceDetail {
  id: string
  name: string
  serial?: string
  asset_tag?: string
  device_type?: {
    model: string
    manufacturer: { name: string }
  }
  role?: { name: string }
  platform?: { name: string }
  location?: { name: string }
  status?: { name: string }
  primary_ip4?: {
    address: string
    host: string
  }
  tags?: Array<{ name: string; color: string }>
  custom_fields?: Record<string, unknown>
}

export function useInventoryDevices(inventoryId: number | null, enabled: boolean = true) {
  const { apiCall } = useApi()

  // Step 1: Get device IDs from inventory
  const {
    data: inventoryData,
    isLoading: isLoadingInventory,
    error: inventoryError,
  } = useQuery({
    queryKey: ['inventory-devices', inventoryId],
    queryFn: async () => {
      if (!inventoryId) return null
      return apiCall<InventoryDevicesResponse>(
        `inventory/resolve-devices?inventory_id=${inventoryId}`,
        { method: 'POST' }
      )
    },
    enabled: enabled && inventoryId !== null,
    staleTime: 30 * 1000,
  })

  const deviceIds = inventoryData?.device_ids || []

  // Step 2: Fetch details for each device
  const {
    data: devicesDetails,
    isLoading: isLoadingDevices,
    error: devicesError,
  } = useQuery({
    queryKey: ['inventory-device-details', deviceIds],
    queryFn: async () => {
      if (deviceIds.length === 0) return []

      const results = await Promise.allSettled(
        deviceIds.map((deviceId) =>
          apiCall<DeviceDetail>(`nautobot/devices/${deviceId}`, { method: 'GET' })
        )
      )

      return results
        .filter((result): result is PromiseFulfilledResult<DeviceDetail> => result.status === 'fulfilled')
        .map((result) => result.value)
    },
    enabled: enabled && deviceIds.length > 0,
    staleTime: 30 * 1000,
  })

  // Format data for template variables
  const formattedData = useMemo(() => {
    if (!devicesDetails || devicesDetails.length === 0) {
      return {
        devices: [],
        device_details: {},
        deviceCount: 0,
      }
    }

    // Format for "devices" variable (simple list)
    const devices = devicesDetails.map((device) => ({
      id: device.id,
      name: device.name,
    }))

    // Format for "device_details" variable (detailed info per device)
    const device_details: Record<string, DeviceDetail> = {}
    devicesDetails.forEach((device) => {
      device_details[device.id] = device
    })

    return {
      devices,
      device_details,
      deviceCount: devicesDetails.length,
    }
  }, [devicesDetails])

  return {
    ...formattedData,
    isLoading: isLoadingInventory || isLoadingDevices,
    error: inventoryError || devicesError,
    inventoryName: inventoryData?.inventory_name || '',
  }
}
