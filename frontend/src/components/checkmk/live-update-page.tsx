'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Filter, X, ChevronLeft, ChevronRight, RotateCcw, GitCompare, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

// Types
interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
}

interface PaginationState {
  isBackendPaginated: boolean
  hasMore: boolean
  totalCount: number
  currentLimit: number | null
  currentOffset: number
  filterType: string | null
  filterValue: string | null
}

interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

interface DiffResult {
  device_id: string
  device_name: string
  differences: {
    result: 'equal' | 'diff' | 'host_not_found'
    diff: string
    normalized_config: {
      folder: string
      attributes: Record<string, any>
    }
    checkmk_config: {
      folder: string
      attributes: Record<string, any>
      effective_attributes: Record<string, any> | null
      is_cluster: boolean
      is_offline: boolean
      cluster_nodes: any[] | null
    } | null
  }
  timestamp: string
}

// Helper function to render config comparison
const renderConfigComparison = (nautobot: any, checkmk: any) => {
  const allKeys = new Set([
    ...Object.keys(nautobot?.attributes || {}),
    ...Object.keys(checkmk?.attributes || {})
  ])

  return Array.from(allKeys).map(key => {
    const nautobotValue = nautobot?.attributes?.[key]
    const checkmkValue = checkmk?.attributes?.[key]
    const isDifferent = JSON.stringify(nautobotValue) !== JSON.stringify(checkmkValue)
    const nautobotMissing = nautobotValue === undefined
    const checkmkMissing = checkmkValue === undefined

    return {
      key,
      nautobotValue,
      checkmkValue,
      isDifferent,
      nautobotMissing,
      checkmkMissing
    }
  })
}

// Helper to format value for display
const formatValue = (value: any): string => {
  if (value === undefined) return '(missing)'
  if (value === null) return '(null)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export default function LiveUpdatePage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  // Authentication state
  const [authReady, setAuthReady] = useState(false)
  
  // State
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  
  // Activation state
  const [hasDevicesSynced, setHasDevicesSynced] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  
  // Add device confirmation modal state
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [paginationState, setPaginationState] = useState<PaginationState>({
    isBackendPaginated: false,
    hasMore: false,
    totalCount: 0,
    currentLimit: null,
    currentOffset: 0,
    filterType: null,
    filterValue: null,
  })

  // Filter state
  const [deviceNameFilter, setDeviceNameFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Sorting state
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    roles: new Set(),
    locations: new Set(),
    statuses: new Set(),
  })

  // Modal state
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  // Track diff results for each device
  const [deviceDiffResults, setDeviceDiffResults] = useState<Record<string, 'equal' | 'diff' | 'host_not_found'>>({})

  // Show status message
  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ type, text })
    // Auto-hide after 3 seconds for success and info
    if (type === 'success' || type === 'info') {
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }, [])

  // Load devices from API
  const loadDevices = useCallback(async (
    deviceNameFilter = '',
    useBackendPagination = false,
    limit: number | null = null,
    offset = 0
  ) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (useBackendPagination && limit) {
        params.append('limit', limit.toString())
        params.append('offset', offset.toString())
      }
      if (deviceNameFilter) {
        params.append('filter_type', 'name')
        params.append('filter_value', deviceNameFilter)
      }

      const endpoint = `nautobot/devices${params.toString() ? '?' + params.toString() : ''}`
      const response = await apiCall<{
        devices?: Device[];
        is_paginated?: boolean;
        has_more?: boolean;
        count?: number;
        current_limit?: number;
        current_offset?: number;
        sites?: string[];
        locations?: string[];
        device_types?: string[];
      }>(endpoint)

      if (response?.devices) {
        const newDevices = response.devices
        setDevices(newDevices)

        // Update pagination state
        setPaginationState({
          isBackendPaginated: response.is_paginated || false,
          hasMore: response.has_more || false,
          totalCount: response.count || 0,
          currentLimit: response.current_limit || null,
          currentOffset: response.current_offset || 0,
          filterType: deviceNameFilter ? 'name' : null,
          filterValue: deviceNameFilter || null,
        })

        // Extract filter options if not using backend pagination
        if (!useBackendPagination) {
          const newFilterOptions: FilterOptions = {
            roles: new Set(),
            locations: new Set(),
            statuses: new Set(),
          }

          newDevices.forEach((device: Device) => {
            if (device.role?.name) newFilterOptions.roles.add(device.role.name)
            if (device.location?.name) newFilterOptions.locations.add(device.location.name)
            if (device.status?.name) newFilterOptions.statuses.add(device.status.name)
          })

          setFilterOptions(newFilterOptions)
        }

        showMessage(`Loaded ${newDevices.length} devices`, 'success')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices'
      setError(message)
      showMessage(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  // Apply filters and sorting
  const applyFilters = useCallback(() => {
    let filtered = devices.filter(device => {
      // Device name filter is handled separately via backend pagination or client-side by deviceNameFilter
      // For client-side filtering, apply device name filter here
      if (deviceNameFilter) {
        const deviceName = (device.name || '').toLowerCase()
        if (!deviceName.includes(deviceNameFilter.toLowerCase())) {
          return false
        }
      }

      // Header filters
      if (roleFilter && device.role?.name !== roleFilter) return false
      if (locationFilter && device.location?.name !== locationFilter) return false
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

    setFilteredDevices(filtered)
    setCurrentPage(0) // Reset to first page when filters change
  }, [devices, deviceNameFilter, roleFilter, locationFilter, statusFilter, sortColumn, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setRoleFilter('')
    setLocationFilter('')
    setStatusFilter('')
    setSortColumn('')
    setSortOrder('none')
    setCurrentPage(0)
    setFilteredDevices(devices)
  }, [devices])

  // Actions
  const handleGetDiff = useCallback(async (device: Device) => {
    try {
      setLoadingDiff(true)
      setSelectedDevice(device)
      setIsDiffModalOpen(true)
      showMessage(`Getting diff for ${device.name}...`, 'info')

      const response = await apiCall<any>(`nb2cmk/device/${device.id}/compare`)
      
      
      if (response) {
        const diffData = {
          device_id: device.id,
          device_name: device.name,
          differences: response,
          timestamp: new Date().toISOString()
        }
        setDiffResult(diffData)
        
        // Store the result for table row coloring
        setDeviceDiffResults(prev => ({
          ...prev,
          [device.id]: response.result
        }))
        
        showMessage(`Diff retrieved for ${device.name}`, 'success')
      } else {
        showMessage(`No diff data available for ${device.name}`, 'info')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get diff'
      showMessage(`Failed to get diff for ${device.name}: ${message}`, 'error')
    } finally {
      setLoadingDiff(false)
    }
  }, [apiCall, showMessage])

  const handleAddDeviceConfirmation = useCallback((device: Device) => {
    setDeviceToAdd(device)
    setShowAddDeviceModal(true)
  }, [])

  const handleAddDeviceCancel = useCallback(() => {
    setShowAddDeviceModal(false)
    setDeviceToAdd(null)
  }, [])

  const handleSync = useCallback(async (device: Device) => {
    try {
      showMessage(`Syncing ${device.name}...`, 'info')
      
      const response = await apiCall(`nb2cmk/device/${device.id}/update`, {
        method: 'POST'
      })
      
      if (response) {
        showMessage(`Successfully synced ${device.name} in CheckMK`, 'success')
        setHasDevicesSynced(true) // Enable the Activate button
      } else {
        showMessage(`Failed to sync ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync device'
      
      // Check if it's a 404 error (device not found in CheckMK)
      if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
        // Ask user if they want to add the device to CheckMK
        handleAddDeviceConfirmation(device)
      } else {
        showMessage(`Failed to sync ${device.name}: ${message}`, 'error')
      }
    }
  }, [apiCall, showMessage, handleAddDeviceConfirmation])

  const handleActivate = useCallback(async () => {
    try {
      setIsActivating(true)
      showMessage('Activating changes in CheckMK...', 'info')
      
      const response = await apiCall('checkmk/changes/activate', {
        method: 'POST'
      })
      
      if (response) {
        showMessage('Successfully activated pending changes in CheckMK', 'success')
        setHasDevicesSynced(false) // Reset the state after activation
      } else {
        showMessage('Failed to activate changes in CheckMK', 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate changes'
      showMessage(`Failed to activate changes: ${message}`, 'error')
    } finally {
      setIsActivating(false)
    }
  }, [apiCall, showMessage])

  const handleAddDevice = useCallback(async (device: Device) => {
    try {
      setIsAddingDevice(true)
      showMessage(`Adding ${device.name} to CheckMK...`, 'info')
      
      const response = await apiCall(`nb2cmk/device/${device.id}/add`, {
        method: 'POST'
      })
      
      if (response) {
        showMessage(`Successfully added ${device.name} to CheckMK`, 'success')
        setHasDevicesSynced(true) // Enable the Activate button
        setShowAddDeviceModal(false) // Close the modal
        setDeviceToAdd(null)
      } else {
        showMessage(`Failed to add ${device.name} to CheckMK`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add device'
      showMessage(`Failed to add ${device.name}: ${message}`, 'error')
    } finally {
      setIsAddingDevice(false)
    }
  }, [apiCall, showMessage])

  // Pagination
  const totalPages = Math.ceil(filteredDevices.length / pageSize)
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredDevices.slice(start, end)
  }, [filteredDevices, currentPage, pageSize])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }, [totalPages])

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

  // Effects
  // Authentication effect - wait for auth before loading data
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('LiveUpdate: Authentication ready, loading devices')
      setAuthReady(true)
      loadDevices()
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    applyFilters()
  }, [devices, deviceNameFilter, roleFilter, locationFilter, statusFilter, sortColumn, sortOrder])

  // Helper functions
  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) {
      return 'default' // Green
    } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
      return 'destructive' // Red
    } else if (statusLower.includes('maintenance')) {
      return 'secondary' // Yellow
    }
    return 'outline' // Gray
  }

  const isDeviceOffline = (status: string) => {
    const statusLower = status.toLowerCase()
    return statusLower.includes('offline') || statusLower.includes('failed')
  }

  const activeFiltersCount = [
    deviceNameFilter,
    roleFilter,
    locationFilter,
    statusFilter
  ].filter(Boolean).length

  // Helper function to get row color based on diff results
  const getRowColorClass = (deviceId: string) => {
    const result = deviceDiffResults[deviceId]
    if (!result) return '' // No test performed yet
    
    switch (result) {
      case 'equal':
        return 'bg-green-50 hover:bg-green-100 border-green-200'
      case 'diff':
      case 'host_not_found':
        return 'bg-red-50 hover:bg-red-100 border-red-200'
      default:
        return ''
    }
  }

  if (!authReady || (loading && devices.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {!authReady ? 'Establishing authentication...' : 'Loading devices...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Update</h1>
          <p className="text-gray-600 mt-1">Monitor and sync device configurations in real-time</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => loadDevices()}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <Card className={
          statusMessage.type === 'success' ? 'border-green-200 bg-green-50' :
          statusMessage.type === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }>
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'text-green-800' :
              statusMessage.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {statusMessage.type === 'success' && <span>✓</span>}
              {statusMessage.type === 'error' && <X className="h-4 w-4" />}
              {statusMessage.type === 'info' && <span>ℹ</span>}
              <span>{statusMessage.text}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusMessage(null)}
                className="ml-auto h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Devices table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Live Update Management</h3>
                {activeFiltersCount > 0 || sortColumn ? (
                  <p className="text-blue-100 text-xs">
                    Showing {filteredDevices.length} of {devices.length} devices
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                    {sortColumn && ` - Sorted by ${sortColumn.replace('_', ' ')} (${sortOrder})`}
                  </p>
                ) : (
                  <p className="text-blue-100 text-xs">
                    Showing all {devices.length} devices
                  </p>
                )}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {activeFiltersCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  title="Clear All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Device Name</div>
                      <div>
                        <Input
                          placeholder="Type 3+ chars for backend search..."
                          value={deviceNameFilter}
                          onChange={(e) => setDeviceNameFilter(e.target.value)}
                          className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">IP Address</th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Role</div>
                      <div>
                        <Select value={roleFilter || "all"} onValueChange={(value) => setRoleFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {Array.from(filterOptions.roles).sort().map(role => (
                              <SelectItem key={`live-update-role-${role}`} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Location</div>
                      <div>
                        <Select value={locationFilter || "all"} onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {Array.from(filterOptions.locations).sort().map(location => (
                              <SelectItem key={`live-update-location-${location}`} value={location}>{location}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Status</div>
                      <div>
                        <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {Array.from(filterOptions.statuses).sort().map(status => (
                              <SelectItem key={`live-update-status-${status}`} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map((device, index) => {
                    const isOffline = isDeviceOffline(device.status?.name || '')
                    
                    return (
                      <tr 
                        key={`live-update-device-${device.id}`} 
                        className={`border-b transition-colors ${getRowColorClass(device.id) || 'hover:bg-muted/50'}`}
                      >
                        <td className="p-2 font-medium">{device.name}</td>
                        <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
                        <td className="p-2">{device.role?.name || 'Unknown'}</td>
                        <td className="p-2">{device.location?.name || 'Unknown'}</td>
                        <td className="p-2">
                          <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                            {device.status?.name || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGetDiff(device)}
                              disabled={isOffline}
                              title="Get Diff"
                            >
                              <GitCompare className="h-3 w-3" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSync(device)}
                              disabled={isOffline}
                              title="Sync Device"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredDevices.length)} of {filteredDevices.length} entries
            </div>
            
            <div className="flex items-center gap-1">
              {/* Navigation buttons - only show when there are multiple pages */}
              {totalPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(0)}
                    disabled={currentPage === 0}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + i
                    if (pageNum >= totalPages) return null
                    
                    return (
                      <Button
                        key={`live-update-page-${pageNum}`}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum + 1}
                      </Button>
                    )
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Last
                  </Button>
                </>
              )}
              
              {/* Page Size Selector - always visible */}
              <div className="flex items-center gap-1 ml-2">
                <Label htmlFor="page-size" className="text-xs text-muted-foreground">Show:</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger className="w-20 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Activate Button */}
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {hasDevicesSynced ? (
                <span className="text-green-600">✓ Devices have been synced. Activate changes to apply them in CheckMK.</span>
              ) : (
                <span>Sync one or more devices to enable activation.</span>
              )}
            </div>
            <Button
              onClick={handleActivate}
              disabled={!hasDevicesSynced || isActivating}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
            >
              {isActivating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Activate Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      <Dialog open={isDiffModalOpen} onOpenChange={setIsDiffModalOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ resize: 'both', minWidth: '800px', minHeight: '500px' }}>
          <DialogHeader>
            <DialogTitle>
              Device Comparison - {selectedDevice?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {loadingDiff ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading diff...</p>
                </div>
              </div>
            ) : diffResult ? (
              <div className="space-y-4">
                {/* Header with status */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Generated: {new Date(diffResult.timestamp).toLocaleString()}
                  </div>
                  <Badge 
                    variant={diffResult.differences.result === 'equal' ? 'default' : 'secondary'}
                    className={
                      diffResult.differences.result === 'equal' ? 'bg-green-100 text-green-800' : 
                      diffResult.differences.result === 'host_not_found' ? 'bg-red-100 text-red-800' :
                      'bg-orange-100 text-orange-800'
                    }
                  >
                    {diffResult.differences.result === 'equal' ? '✓ Configs Match' : 
                     diffResult.differences.result === 'host_not_found' ? '❌ Host Not Found in CheckMK' :
                     '⚠ Differences Found'}
                  </Badge>
                </div>

{/* Handle host not found case */}
                {diffResult.differences.result === 'host_not_found' ? (
                  <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                    <div className="text-center">
                      <div className="text-red-600 text-lg mb-3">🚫 Host Not Found</div>
                      <p className="text-red-800 mb-4">{diffResult.differences.diff}</p>
                      
                      <div className="bg-white rounded-lg p-4 border border-red-200 text-left">
                        <h4 className="font-semibold mb-2 text-red-800">Expected Configuration (Nautobot)</h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Folder:</strong> <code className="bg-red-100 px-2 py-1 rounded">{diffResult.differences.normalized_config.folder}</code></div>
                          <div><strong>Attributes:</strong></div>
                          <pre className="bg-red-100 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                            {JSON.stringify(diffResult.differences.normalized_config.attributes, null, 2)}
                          </pre>
                        </div>
                      </div>
                      
                      <p className="text-red-700 text-sm mt-4">
                        This device exists in Nautobot but has not been synchronized to CheckMK yet.
                        Use the Sync button to create this host in CheckMK.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Folder Comparison */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Folder Configuration</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-blue-600 mb-1">Nautobot (Expected)</div>
                          <div className="bg-blue-50 p-2 rounded text-sm font-mono">
                            {diffResult.differences.normalized_config.folder}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-purple-600 mb-1">CheckMK (Actual)</div>
                          <div className="bg-purple-50 p-2 rounded text-sm font-mono">
                            {diffResult.differences.checkmk_config?.folder || '(not found)'}
                          </div>
                        </div>
                      </div>
                      {diffResult.differences.normalized_config.folder !== diffResult.differences.checkmk_config?.folder && (
                        <div className="mt-2 text-xs text-orange-600">⚠ Folder paths differ</div>
                      )}
                    </div>

                {/* Attributes Comparison */}
                <div className="bg-white border rounded-lg">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="font-semibold">Attributes Comparison</h4>
                    <div className="text-xs text-gray-600 mt-1">Side-by-side comparison of device attributes</div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-25">
                          <th className="text-left p-3 font-medium text-gray-700 w-48">Attribute</th>
                          <th className="text-left p-3 font-medium text-blue-600 w-1/3">Nautobot (Expected)</th>
                          <th className="text-left p-3 font-medium text-purple-600 w-1/3">CheckMK (Actual)</th>
                          <th className="text-left p-3 font-medium text-gray-700 w-32">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderConfigComparison(
                          diffResult.differences.normalized_config,
                          diffResult.differences.checkmk_config
                        ).map(({ key, nautobotValue, checkmkValue, isDifferent, nautobotMissing, checkmkMissing }) => (
                          <tr 
                            key={key} 
                            className={`border-b transition-colors ${
                              nautobotMissing || checkmkMissing || isDifferent 
                                ? 'bg-red-50 hover:bg-red-100 border-red-200' 
                                : 'bg-green-50 hover:bg-green-100 border-green-200'
                            }`}
                          >
                            <td className="p-3 font-mono text-sm font-medium w-48">{key}</td>
                            <td className={`p-3 text-sm w-1/3 ${nautobotMissing ? 'text-gray-400 italic' : ''}`}>
                              <div className="bg-blue-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                <pre className="whitespace-pre-wrap break-words">
                                  {formatValue(nautobotValue)}
                                </pre>
                              </div>
                            </td>
                            <td className={`p-3 text-sm w-1/3 ${checkmkMissing ? 'text-gray-400 italic' : ''}`}>
                              <div className="bg-purple-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                <pre className="whitespace-pre-wrap break-words">
                                  {formatValue(checkmkValue)}
                                </pre>
                              </div>
                            </td>
                            <td className="p-3 text-xs">
                              {nautobotMissing ? (
                                <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Only in CheckMK</Badge>
                              ) : checkmkMissing ? (
                                <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Missing in CheckMK</Badge>
                              ) : isDifferent ? (
                                <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Different</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-700 border-green-400 bg-green-100">Match</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                    {/* CheckMK Additional Info */}
                    {diffResult.differences.checkmk_config && (
                      diffResult.differences.checkmk_config.is_cluster || 
                      diffResult.differences.checkmk_config.is_offline || 
                      diffResult.differences.checkmk_config.cluster_nodes
                    ) && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-purple-800">CheckMK Additional Information</h4>
                        <div className="space-y-1 text-sm">
                          <div>Is Cluster: {diffResult.differences.checkmk_config.is_cluster ? 'Yes' : 'No'}</div>
                          <div>Is Offline: {diffResult.differences.checkmk_config.is_offline ? 'Yes' : 'No'}</div>
                          {diffResult.differences.checkmk_config.cluster_nodes && (
                            <div>Cluster Nodes: {JSON.stringify(diffResult.differences.checkmk_config.cluster_nodes)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No diff data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Device Confirmation Modal */}
      <Dialog open={showAddDeviceModal} onOpenChange={(open) => !open && handleAddDeviceCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Device Not Found in CheckMK</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The device <strong>{deviceToAdd?.name}</strong> was not found in CheckMK. 
              Would you like to add it to CheckMK?
            </p>
            <div className="flex items-center justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={handleAddDeviceCancel}
                disabled={isAddingDevice}
              >
                No
              </Button>
              <Button 
                onClick={() => deviceToAdd && handleAddDevice(deviceToAdd)}
                disabled={isAddingDevice}
                className="bg-green-600 hover:bg-green-700"
              >
                {isAddingDevice ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Yes, Add Device'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}