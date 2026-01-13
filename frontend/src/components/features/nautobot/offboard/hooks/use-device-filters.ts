import { useState, useCallback, useMemo } from 'react'
import type { Device, TableFilters, DropdownOption } from '@/types/features/nautobot/offboard'

export function useDeviceFilters(
  devices: Device[],
  dropdownOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
) {
  const [filters, setFilters] = useState<TableFilters>({
    deviceName: '',
    role: 'all',
    location: 'all',
    ipAddress: '',
    status: 'all'
  })

  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})

  // Derive effective role filters during render (no setState in effect)
  const effectiveRoleFilters = useMemo(() => {
    // If user has set filters, use them
    if (Object.keys(roleFilters).length > 0) return roleFilters
    
    // Otherwise, default to all roles selected
    const defaultFilters: Record<string, boolean> = {}
    dropdownOptions.roles.forEach(role => {
      defaultFilters[role.name] = true
    })
    return defaultFilters
  }, [roleFilters, dropdownOptions.roles])

  const filteredDevices = useMemo(() => {
    let filtered = devices

    if (filters.deviceName) {
      filtered = filtered.filter(device =>
        device.name && device.name.toLowerCase().includes(filters.deviceName.toLowerCase())
      )
    }

    // Multi-select role filter
    if (Object.keys(effectiveRoleFilters).length > 0) {
      filtered = filtered.filter(device => {
        const deviceRole = device.role?.name || ''
        if (!(deviceRole in effectiveRoleFilters)) return true
        return effectiveRoleFilters[deviceRole] === true
      })
    }

    if (filters.location && filters.location !== 'all') {
      filtered = filtered.filter(device => device.location?.name === filters.location)
    }

    if (filters.ipAddress) {
      filtered = filtered.filter(device =>
        device.primary_ip4?.address?.toLowerCase().includes(filters.ipAddress.toLowerCase())
      )
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(device => device.status?.name === filters.status)
    }

    return filtered
  }, [devices, filters, effectiveRoleFilters])

  const handleFilterChange = useCallback((field: keyof TableFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({
      deviceName: '',
      role: 'all',
      location: 'all',
      ipAddress: '',
      status: 'all'
    })

    const resetRoleFilters: Record<string, boolean> = {}
    dropdownOptions.roles.forEach(role => {
      resetRoleFilters[role.name] = true
    })
    setRoleFilters(resetRoleFilters)
  }, [dropdownOptions.roles])

  return {
    filteredDevices,
    filters,
    roleFilters: effectiveRoleFilters,
    setFilters,
    setRoleFilters,
    handleFilterChange,
    clearAllFilters
  }
}
