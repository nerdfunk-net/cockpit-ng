import { useState, useMemo, useCallback } from 'react'
import type { DiffDevice, SystemFilter } from '@/types/features/checkmk/diff-viewer'

interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
}

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  roles: new Set<string>(),
  locations: new Set<string>(),
  statuses: new Set<string>(),
}

const EMPTY_ROLE_FILTERS: Record<string, boolean> = {}

export function useDiffFilters(devices: DiffDevice[]) {
  const [deviceNameFilter, setDeviceNameFilter] = useState('')
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>(EMPTY_ROLE_FILTERS)
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [systemFilter, setSystemFilter] = useState<SystemFilter>('all')

  // Build filter options from device data
  const filterOptions = useMemo((): FilterOptions => {
    if (devices.length === 0) return EMPTY_FILTER_OPTIONS

    const roles = new Set<string>()
    const locations = new Set<string>()
    const statuses = new Set<string>()

    for (const device of devices) {
      if (device.role) roles.add(device.role)
      if (device.location) locations.add(device.location)
      if (device.status) statuses.add(device.status)
    }

    return { roles, locations, statuses }
  }, [devices])

  // Filter devices
  const filteredDevices = useMemo(() => {
    let result = devices

    // System filter
    if (systemFilter !== 'all') {
      result = result.filter(d => d.source === systemFilter)
    }

    // Name filter
    if (deviceNameFilter) {
      const lower = deviceNameFilter.toLowerCase()
      result = result.filter(d => d.name.toLowerCase().includes(lower))
    }

    // Role filter (multi-select: empty = all selected)
    const activeRoleFilters = Object.entries(roleFilters).filter(([, v]) => v)
    if (activeRoleFilters.length > 0) {
      const selectedRoles = new Set(activeRoleFilters.map(([k]) => k))
      result = result.filter(d => d.role && selectedRoles.has(d.role))
    }

    // Location filter
    if (selectedLocation !== 'all') {
      result = result.filter(d => d.location === selectedLocation)
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter)
    }

    return result
  }, [devices, systemFilter, deviceNameFilter, roleFilters, selectedLocation, statusFilter])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (deviceNameFilter) count++
    if (Object.values(roleFilters).some(v => v)) count++
    if (selectedLocation !== 'all') count++
    if (statusFilter !== 'all') count++
    if (systemFilter !== 'all') count++
    return count
  }, [deviceNameFilter, roleFilters, selectedLocation, statusFilter, systemFilter])

  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setRoleFilters(EMPTY_ROLE_FILTERS)
    setSelectedLocation('all')
    setStatusFilter('all')
    setSystemFilter('all')
  }, [])

  return useMemo(() => ({
    deviceNameFilter,
    setDeviceNameFilter,
    roleFilters,
    setRoleFilters,
    selectedLocation,
    setSelectedLocation,
    statusFilter,
    setStatusFilter,
    systemFilter,
    setSystemFilter,
    filterOptions,
    filteredDevices,
    activeFiltersCount,
    resetFilters,
  }), [
    deviceNameFilter,
    roleFilters,
    selectedLocation,
    statusFilter,
    systemFilter,
    filterOptions,
    filteredDevices,
    activeFiltersCount,
    resetFilters,
  ])
}
