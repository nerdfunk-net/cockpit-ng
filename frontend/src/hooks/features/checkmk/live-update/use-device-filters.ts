import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Device, FilterOptions } from '@/types/features/checkmk/live-update'

export function useDeviceFilters(devices: Device[]) {
  const [deviceNameFilter, setDeviceNameFilter] = useState('')
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')
  const prevDevicesLengthRef = useRef(0)

  // Extract filter options from devices using useMemo
  const filterOptions = useMemo(() => {
    const newFilterOptions: FilterOptions = {
      roles: new Set(),
      locations: new Set(),
      statuses: new Set(),
    }

    devices.forEach((device: Device) => {
      if (device.role?.name) newFilterOptions.roles.add(device.role.name)
      if (device.location?.name) newFilterOptions.locations.add(device.location.name)
      if (device.status?.name) newFilterOptions.statuses.add(device.status.name)
    })

    return newFilterOptions
  }, [devices])

  // Initialize role filters when devices change - run only on mount and when devices change
  useEffect(() => {
    // Only initialize if devices list changed (different length)
    if (devices.length !== prevDevicesLengthRef.current && devices.length > 0) {
      prevDevicesLengthRef.current = devices.length

      const initialRoleFilters: Record<string, boolean> = {}
      filterOptions.roles.forEach(role => {
        initialRoleFilters[role] = true
      })
      // eslint-disable-next-line react-compiler/react-compiler
      setRoleFilters(initialRoleFilters)
    }
  }, [devices.length, filterOptions.roles])

  // Apply filters and sorting
  const filteredDevices = useMemo(() => {
    let filtered = devices.filter(device => {
      // Device name filter
      if (deviceNameFilter) {
        const deviceName = (device.name || '').toLowerCase()
        if (!deviceName.includes(deviceNameFilter.toLowerCase())) {
          return false
        }
      }

      // Multi-select role filter (checkbox-based)
      if (Object.keys(roleFilters).length > 0) {
        const deviceRole = device.role?.name || ''
        // If the device's role isn't in our filter list, show it (backward compatibility)
        if (!(deviceRole in roleFilters)) return true
        // Otherwise, check if this role is selected
        if (!roleFilters[deviceRole]) return false
      }

      // Location search filter (text-based searchable dropdown)
      if (selectedLocation) {
        const deviceLocation = device.location?.name || ''
        if (deviceLocation !== selectedLocation) return false
      }

      // Status filter (keeping status filter as simple select)
      if (statusFilter && device.status?.name !== statusFilter) return false

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: string, bVal: string

        switch (sortColumn) {
          case 'name':
            aVal = a.name || ''
            bVal = b.name || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [devices, deviceNameFilter, roleFilters, selectedLocation, statusFilter, sortColumn, sortOrder])

  const handleSort = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortOrder(prev => {
        if (prev === 'none') return 'asc'
        if (prev === 'asc') return 'desc'
        return 'none'
      })
    } else {
      setSortColumn(column)
      setSortOrder('asc')
    }
  }, [sortColumn])

  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setStatusFilter('')
    setSortColumn('')
    setSortOrder('none')

    // Reset role filters to all selected
    const resetRoleFilters: Record<string, boolean> = {}
    filterOptions.roles.forEach(role => {
      resetRoleFilters[role] = true
    })
    setRoleFilters(resetRoleFilters)

    // Reset location search
    setSelectedLocation('')
  }, [filterOptions.roles])

  const activeFiltersCount = useMemo(() => {
    return [
      deviceNameFilter,
      statusFilter,
      selectedLocation
    ].filter(Boolean).length +
    // Add count for role filters (if any are deselected)
    (Object.keys(roleFilters).length > 0 && Object.values(roleFilters).filter(Boolean).length < filterOptions.roles.size ? 1 : 0)
  }, [deviceNameFilter, statusFilter, selectedLocation, roleFilters, filterOptions.roles.size])

  return {
    filteredDevices,
    deviceNameFilter,
    roleFilters,
    selectedLocation,
    statusFilter,
    sortColumn,
    sortOrder,
    filterOptions,
    activeFiltersCount,
    setDeviceNameFilter,
    setRoleFilters,
    setSelectedLocation,
    setStatusFilter,
    handleSort,
    resetFilters
  }
}
