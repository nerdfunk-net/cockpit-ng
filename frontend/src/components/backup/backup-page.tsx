'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Download, History, Filter, X, ChevronLeft, ChevronRight, RotateCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
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
  cf_last_backup?: string
}

interface BackupHistoryEntry {
  id: string
  date: string
  size: string
  status: 'success' | 'failed' | 'in_progress'
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
  deviceTypes: Set<string>
  statuses: Set<string>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

export default function BackupPage() {
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
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [dateComparison, setDateComparison] = useState('')

  // Sorting state
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    roles: new Set(),
    locations: new Set(),
    deviceTypes: new Set(),
    statuses: new Set(),
  })

  // Modal state
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([])
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [backupInProgress, setBackupInProgress] = useState<Set<string>>(new Set())

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
      const response = await apiCall(endpoint)

      if (response?.devices) {
        const newDevices = response.devices
        setDevices(newDevices)

        // Update pagination state
        setPaginationState({
          isBackendPaginated: response.is_paginated || false,
          hasMore: response.has_more || false,
          totalCount: response.count || 0,
          currentLimit: response.current_limit,
          currentOffset: response.current_offset || 0,
          filterType: deviceNameFilter ? 'name' : null,
          filterValue: deviceNameFilter || null,
        })

        // Extract filter options if not using backend pagination
        if (!useBackendPagination) {
          const newFilterOptions: FilterOptions = {
            roles: new Set(),
            locations: new Set(),
            deviceTypes: new Set(),
            statuses: new Set(),
          }

          newDevices.forEach((device: Device) => {
            if (device.role?.name) newFilterOptions.roles.add(device.role.name)
            if (device.location?.name) newFilterOptions.locations.add(device.location.name)
            if (device.device_type?.model) newFilterOptions.deviceTypes.add(device.device_type.model)
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
      if (deviceTypeFilter && device.device_type?.model !== deviceTypeFilter) return false
      if (statusFilter && device.status?.name !== statusFilter) return false

      // Date filter
      if (dateFilter && dateComparison && device.cf_last_backup) {
        const deviceDate = new Date(device.cf_last_backup)
        const filterDate = new Date(dateFilter)
        
        if (dateComparison === 'lte' && deviceDate > filterDate) return false
        if (dateComparison === 'lt' && deviceDate >= filterDate) return false
      }

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: any, bVal: any

        switch (sortColumn) {
          case 'last_backup':
            aVal = a.cf_last_backup === 'Never' || !a.cf_last_backup ? '1970-01-01' : a.cf_last_backup
            bVal = b.cf_last_backup === 'Never' || !b.cf_last_backup ? '1970-01-01' : b.cf_last_backup
            aVal = new Date(aVal)
            bVal = new Date(bVal)
            break
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
  }, [devices, deviceNameFilter, roleFilter, locationFilter, deviceTypeFilter, statusFilter, dateFilter, dateComparison, sortColumn, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setRoleFilter('')
    setLocationFilter('')
    setDeviceTypeFilter('')
    setStatusFilter('')
    setDateFilter('')
    setDateComparison('')
    setSortColumn('')
    setSortOrder('none')
    setCurrentPage(0)
    setFilteredDevices(devices)
  }, [devices])

  // Backup operations
  const performBackup = useCallback(async (device: Device) => {
    try {
      setBackupInProgress(prev => new Set(prev.add(device.id)))
      
      showMessage(`Starting backup for ${device.name}`, 'info')

      // Simulate backup API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      showMessage(`Backup completed for ${device.name}`, 'success')

      // Refresh devices to update last backup time
      setTimeout(() => loadDevices(), 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup failed'
      showMessage(`Backup failed for ${device.name}: ${message}`, 'error')
    } finally {
      setBackupInProgress(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }, [loadDevices, showMessage])

  const showBackupHistory = useCallback(async (device: Device) => {
    try {
      setSelectedDevice(device)
      
      // Load backup history - replace with actual API call
      const mockHistory: BackupHistoryEntry[] = [
        {
          id: '1',
          date: '2024-01-15 10:30:00',
          size: '2.3 MB',
          status: 'success'
        }
      ]
      
      setBackupHistory(mockHistory)
      setIsHistoryModalOpen(true)
    } catch (err) {
      showMessage('Failed to load backup history', 'error')
    }
  }, [showMessage])

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
      console.log('Backup: Authentication ready, loading devices')
      setAuthReady(true)
      loadDevices()
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    applyFilters()
  }, [devices, deviceNameFilter, roleFilter, locationFilter, deviceTypeFilter, statusFilter, dateFilter, dateComparison, sortColumn, sortOrder]) // Run when filter/sort dependencies change

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
    deviceTypeFilter,
    statusFilter,
    dateFilter
  ].filter(Boolean).length

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration Backup</h1>
          <p className="text-muted-foreground">Manage device configuration backups</p>
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

      {/* Date Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="backup-date-filter">Last Backup Date</Label>
              <Input
                id="backup-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="min-w-[150px]"
              />
            </div>
            <div>
              <Label htmlFor="date-comparison">Date Comparison</Label>
              <Select value={dateComparison || "none"} onValueChange={(value) => setDateComparison(value === "none" ? "" : value)}>
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue placeholder="No Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Date Filter</SelectItem>
                  <SelectItem value="lte">≤ (Less/Equal)</SelectItem>
                  <SelectItem value="lt">&lt; (Less Than)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary">
                  {activeFiltersCount} active
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Devices
              {activeFiltersCount > 0 || sortColumn ? (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  Showing {filteredDevices.length} of {devices.length} devices
                  {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                  {sortColumn && ` - Sorted by ${sortColumn.replace('_', ' ')} (${sortOrder})`}
                </span>
              ) : (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  Showing all {devices.length} devices
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
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
                          className="h-8 text-xs"
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
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {Array.from(filterOptions.roles).sort().map(role => (
                              <SelectItem key={`backup-role-${role}`} value={role}>{role}</SelectItem>
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
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All Locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {Array.from(filterOptions.locations).sort().map(location => (
                              <SelectItem key={`backup-location-${location}`} value={location}>{location}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Device Type</div>
                      <div>
                        <Select value={deviceTypeFilter || "all"} onValueChange={(value) => setDeviceTypeFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Array.from(filterOptions.deviceTypes).sort().map(deviceType => (
                              <SelectItem key={`backup-devicetype-${deviceType}`} value={deviceType}>{deviceType}</SelectItem>
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
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {Array.from(filterOptions.statuses).sort().map(status => (
                              <SelectItem key={`backup-status-${status}`} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('last_backup')}
                  >
                    <div className="flex items-center gap-1">
                      Last Backup
                      {sortColumn === 'last_backup' && (
                        <span className="text-xs">
                          {sortOrder === 'asc' ? '↑' : sortOrder === 'desc' ? '↓' : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map((device, index) => {
                    const isOffline = isDeviceOffline(device.status?.name || '')
                    const isBackingUp = backupInProgress.has(device.id)
                    
                    return (
                      <tr key={`backup-device-${device.id}`} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{device.name}</td>
                        <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
                        <td className="p-2">{device.role?.name || 'Unknown'}</td>
                        <td className="p-2">{device.location?.name || 'Unknown'}</td>
                        <td className="p-2">{device.device_type?.model || 'Unknown'}</td>
                        <td className="p-2">
                          <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                            {device.status?.name || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="p-2">{device.cf_last_backup || 'Never'}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => performBackup(device)}
                              disabled={isOffline || isBackingUp}
                              title="Backup Device"
                            >
                              {isBackingUp ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => showBackupHistory(device)}
                              title="View Backup History"
                            >
                              <History className="h-3 w-3" />
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
                        key={`backup-page-${pageNum}`}
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
                  <SelectTrigger className="w-20 h-8">
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
        </CardContent>
      </Card>

      {/* Backup History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Backup History - {selectedDevice?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Size</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-muted-foreground">
                      No backup history found
                    </td>
                  </tr>
                ) : (
                  backupHistory.map((entry) => (
                    <tr key={`backup-history-${entry.id}`} className="border-b">
                      <td className="p-2">{entry.date}</td>
                      <td className="p-2">{entry.size}</td>
                      <td className="p-2">
                        <Badge 
                          variant={
                            entry.status === 'success' ? 'default' : 
                            entry.status === 'failed' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            Restore
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
