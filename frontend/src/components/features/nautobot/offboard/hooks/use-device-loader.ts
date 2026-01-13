import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Device, DropdownOption } from '@/types/features/nautobot/offboard'

export function useDeviceLoader() {
  const { apiCall } = useApi()
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOptions, setDropdownOptions] = useState({
    roles: [] as DropdownOption[],
    locations: [] as DropdownOption[],
    statuses: [] as DropdownOption[]
  })

  const extractFilterOptions = useCallback((deviceList: Device[]) => {
    const roles = new Set<string>()
    const locations = new Set<string>()
    const statuses = new Set<string>()

    deviceList.forEach(device => {
      if (device.role?.name) roles.add(device.role.name)
      if (device.location?.name) locations.add(device.location.name)
      if (device.status?.name) statuses.add(device.status.name)
    })

    setDropdownOptions({
      roles: Array.from(roles).map(name => ({ id: name, name })),
      locations: Array.from(locations).map(name => ({ id: name, name })),
      statuses: Array.from(statuses).map(name => ({ id: name, name }))
    })

    return {
      roles: Array.from(roles),
      locations: Array.from(locations),
      statuses: Array.from(statuses)
    }
  }, [])

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await apiCall<{ devices: Device[] }>('nautobot/devices')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        return data.devices
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, extractFilterOptions])

  const reloadDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await apiCall<{ devices: Device[] }>('nautobot/devices?reload=true')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        return data.devices
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error reloading devices:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, extractFilterOptions])

  return {
    devices,
    isLoading,
    dropdownOptions,
    loadDevices,
    reloadDevices
  }
}
