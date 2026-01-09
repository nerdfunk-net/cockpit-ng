import { useState, useMemo, useCallback } from 'react'
import type { Device, FilterState, CheckmkStatusFilters } from '../types/sync-devices.types'
import { getSiteFromDevice } from '../utils/sync-devices.utils'

/**
 * Hook for managing all device filtering logic
 */
export function useDeviceFilters(devices: Device[], defaultSite: string) {
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    name: '',
    role: '',
    status: '',
    location: '',
    site: '',
    checkmk_status: ''
  })
  
  const [checkmkStatusFilters, setCheckmkStatusFilters] = useState<CheckmkStatusFilters>({
    equal: true,
    diff: true,
    missing: true
  })
  
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({})
  const [siteFilters, setSiteFilters] = useState<Record<string, boolean>>({})
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  // Extract unique values from devices
  const availableRoles = useMemo(() => {
    const roles = new Set(devices.map(device => device.role).filter(Boolean))
    return Array.from(roles).sort()
  }, [devices])

  const availableStatuses = useMemo(() => {
    const statuses = new Set(devices.map(device => device.status).filter(Boolean))
    return Array.from(statuses).sort()
  }, [devices])

  const availableLocations = useMemo(() => {
    const locations = new Set(devices.map(device => device.location).filter(Boolean))
    return Array.from(locations).sort()
  }, [devices])

  const availableSites = useMemo(() => {
    const sites = new Set(devices.map(device => getSiteFromDevice(device, defaultSite)).filter(Boolean))
    return Array.from(sites).sort()
  }, [devices, defaultSite])

  // Compute merged role filters (keep user selections, add new roles as selected)
  const mergedRoleFilters = useMemo(() => {
    const merged = { ...roleFilters }
    let hasChanges = false
    availableRoles.forEach(role => {
      if (!(role in merged)) {
        merged[role] = true // Default new roles to selected
        hasChanges = true
      }
    })
    // Return existing object if no changes to preserve reference stability
    return hasChanges ? merged : roleFilters
  }, [availableRoles, roleFilters])

  // Compute merged status filters (keep user selections, add new statuses as selected)
  const mergedStatusFilters = useMemo(() => {
    const merged = { ...statusFilters }
    let hasChanges = false
    availableStatuses.forEach(status => {
      if (!(status in merged)) {
        merged[status] = true // Default new statuses to selected
        hasChanges = true
      }
    })
    // Return existing object if no changes to preserve reference stability
    return hasChanges ? merged : statusFilters
  }, [availableStatuses, statusFilters])

  // Compute merged site filters (keep user selections, add new sites as selected)
  const mergedSiteFilters = useMemo(() => {
    const merged = { ...siteFilters }
    let hasChanges = false
    availableSites.forEach(site => {
      if (!(site in merged)) {
        merged[site] = true // Default new sites to selected
        hasChanges = true
      }
    })
    // Return existing object if no changes to preserve reference stability
    return hasChanges ? merged : siteFilters
  }, [availableSites, siteFilters])

  // Filter devices based on all filter criteria
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Check CheckMK status checkbox filters
      const hasAnyCheckmkStatusFilter = checkmkStatusFilters.equal || checkmkStatusFilters.diff || checkmkStatusFilters.missing
      const checkmkStatusMatch = hasAnyCheckmkStatusFilter && (
        (checkmkStatusFilters.equal && device.checkmk_status === 'equal') ||
        (checkmkStatusFilters.diff && device.checkmk_status === 'diff') ||
        (checkmkStatusFilters.missing && (device.checkmk_status === 'missing' || device.checkmk_status === 'host_not_found'))
      )
      
      // Check role checkbox filters
      const roleMatch = Object.keys(mergedRoleFilters).length === 0 || mergedRoleFilters[device.role] === true
      
      // Check status checkbox filters
      const statusMatch = Object.keys(mergedStatusFilters).length === 0 || mergedStatusFilters[device.status] === true

      // Check location search filter
      const locationMatch = !selectedLocation || device.location === selectedLocation

      // Check site checkbox filters
      const deviceSite = getSiteFromDevice(device, defaultSite)
      const siteMatch = Object.keys(mergedSiteFilters).length === 0 || mergedSiteFilters[deviceSite] === true
      
      return (
        device.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        roleMatch &&
        statusMatch &&
        locationMatch &&
        siteMatch &&
        checkmkStatusMatch
      )
    })
  }, [devices, filters, checkmkStatusFilters, mergedRoleFilters, mergedStatusFilters, selectedLocation, mergedSiteFilters, defaultSite])

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({
      name: '',
      role: '',
      status: '',
      location: '',
      site: '',
      checkmk_status: ''
    })
    setCheckmkStatusFilters({
      equal: true,
      diff: true,
      missing: true
    })
    
    // Reset role filters to all true
    const resetRoleFilters = availableRoles.reduce((acc: Record<string, boolean>, role: string) => {
      acc[role] = true
      return acc
    }, {})
    setRoleFilters(resetRoleFilters)
    
    // Reset status filters to all true
    const resetStatusFilters = availableStatuses.reduce((acc: Record<string, boolean>, status: string) => {
      acc[status] = true
      return acc
    }, {})
    setStatusFilters(resetStatusFilters)
    
    // Reset location search
    setSelectedLocation('')
    
    // Reset site filters to all true
    const resetSiteFilters = availableSites.reduce((acc: Record<string, boolean>, site: string) => {
      acc[site] = true
      return acc
    }, {})
    setSiteFilters(resetSiteFilters)
  }, [availableRoles, availableStatuses, availableSites])

  const handleFilterChange = useCallback((column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }))
  }, [])

  return {
    filters,
    setFilters,
    checkmkStatusFilters,
    setCheckmkStatusFilters,
    roleFilters: mergedRoleFilters,
    setRoleFilters,
    statusFilters: mergedStatusFilters,
    setStatusFilters,
    siteFilters: mergedSiteFilters,
    setSiteFilters,
    selectedLocation,
    setSelectedLocation,
    filteredDevices,
    availableRoles,
    availableStatuses,
    availableLocations,
    availableSites,
    clearAllFilters,
    handleFilterChange
  }
}
