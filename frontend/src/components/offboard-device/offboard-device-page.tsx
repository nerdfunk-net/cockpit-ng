'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  RotateCcw,
  ChevronDown
} from 'lucide-react'

// Type definitions
interface Device {
  id: string
  name: string
  primary_ip4?: {
    address: string
  }
  role?: {
    name: string
  }
  location?: {
    name: string
  }
  device_type?: {
    model: string
  }
  status?: {
    name: string
  }
}

interface OffboardProperties {
  removePrimaryIp: boolean
  removeInterfaceIps: boolean
  removeFromCheckMK: boolean
}

interface DropdownOption {
  id: string
  name: string
}

// LocationItem shape used by the location filter
interface LocationItem {
  id: string
  name: string
  parent?: { id: string }
  hierarchicalPath?: string
}

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}

interface TableFilters {
  deviceName: string
  role: string
  location: string
  ipAddress: string
  status: string
}

interface OffboardResult {
  success: boolean
  device_id: string
  device_name?: string
  removed_items: string[]
  skipped_items: string[]
  errors: string[]
  summary: string
}

interface OffboardSummary {
  totalDevices: number
  successfulDevices: number
  failedDevices: number
  results: OffboardResult[]
}

type NautobotIntegrationMode = 'remove' | 'set-offboarding'

const buildLocationPath = (location: LocationItem, locationMap: Map<string, LocationItem>) => {
  const names: string[] = []
  const visited = new Set<string>()
  let current: LocationItem | undefined = location

  while (current) {
    if (visited.has(current.id)) {
      names.unshift(`${current.name} (cycle)`)
      break
    }
    visited.add(current.id)
    names.unshift(current.name)

    const parentId = current.parent?.id
    if (!parentId) break
    current = locationMap.get(parentId)
    if (!current) break
  }

  return names.join(' → ')
}

const buildLocationHierarchy = (locations: LocationItem[]) => {
  const map = new Map<string, LocationItem>()
  locations.forEach(l => map.set(l.id, { ...l }))

  const processed = locations.map(loc => {
    const copy = { ...loc }
    copy.hierarchicalPath = buildLocationPath(copy, map)
    return copy
  })

  processed.sort((a, b) => (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || ''))
  return processed
}

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500]

export function OffboardDevicePage() {
  // Auth and API
  const { isAuthenticated, logout } = useAuthStore()
  const { apiCall } = useApi()
  const searchParams = useSearchParams()

  // State management
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 0,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0
  })

  // Filters state with URL parameter support
  const [filters, setFilters] = useState<TableFilters>(() => {
    const ipFilter = searchParams?.get('ip_filter') || ''
    return {
      deviceName: '',
      role: 'all',
      location: 'all',
      ipAddress: ipFilter,
      status: 'all'
    }
  })

  // Offboard properties state
  const [offboardProperties, setOffboardProperties] = useState<OffboardProperties>({
    removePrimaryIp: true,
    removeInterfaceIps: true,
    removeFromCheckMK: true
  })
  const [nautobotIntegrationMode, setNautobotIntegrationMode] = useState<NautobotIntegrationMode>('remove')

  // Dropdown options
  const [dropdownOptions, setDropdownOptions] = useState({
    roles: [] as DropdownOption[],
    locations: [] as DropdownOption[],
    statuses: [] as DropdownOption[]
  })

  // Location filter state
  const [locationsList, setLocationsList] = useState<LocationItem[]>([])
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>([])
  const [locationSearch, setLocationSearch] = useState<string>('')
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const locationContainerRef = useRef<HTMLDivElement | null>(null)

  // Multi-select role filter state (checkbox-based)
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})

  // Modal state for results
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [offboardSummary, setOffboardSummary] = useState<OffboardSummary | null>(null)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, logout])

  // Handle URL parameters
  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter && ipFilter !== filters.ipAddress) {
      setFilters(prev => ({
        ...prev,
        ipAddress: ipFilter
      }))
    }
  }, [searchParams, filters.ipAddress])

  // Auto-hide success messages after 2 seconds
  useEffect(() => {
    if (statusMessage?.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 2000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [statusMessage])

  const extractFilterOptions = useCallback((deviceList: Device[]) => {
    const roles = new Set<string>()
    const locations = new Set<string>()
    const statuses = new Set<string>()

    deviceList.forEach(device => {
      if (device.role?.name) roles.add(device.role.name)
      if (device.location?.name) locations.add(device.location.name)
      if (device.status?.name) statuses.add(device.status.name)
    })

    setDropdownOptions(prev => ({
      ...prev,
      roles: Array.from(roles).map(name => ({ id: name, name })),
      locations: Array.from(locations).map(name => ({ id: name, name })),
      statuses: Array.from(statuses).map(name => ({ id: name, name }))
    }))

    // Initialize role filters (all selected by default)
    const initialRoleFilters: Record<string, boolean> = {}
    roles.forEach(role => {
      initialRoleFilters[role] = true
    })
    setRoleFilters(initialRoleFilters)
  }, [])

  const loadLocations = useCallback(async () => {
    try {
      const data = await apiCall<LocationItem[]>('nautobot/locations')
      const arr = Array.isArray(data) ? data : (data || [])
      const processed = buildLocationHierarchy(arr)
      setLocationsList(processed)
      setLocationFiltered(processed)
    } catch (error) {
      console.error('Error loading locations:', error)
      setLocationsList([])
      setLocationFiltered([])
    }
  }, [apiCall])

  // Click outside handler to close dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!locationContainerRef.current) return
      if (!locationContainerRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const loadDevices = useCallback(async () => {
    try {
      setStatusMessage({ type: 'info', message: 'Loading devices...' })

      const data = await apiCall<{ devices: Device[] }>('nautobot/devices')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        setStatusMessage(null)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to load devices: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }, [apiCall, extractFilterOptions])

  const reloadDevices = useCallback(async () => {
    try {
      setStatusMessage({ type: 'info', message: 'Reloading devices from Nautobot...' })

      const data = await apiCall<{ devices: Device[] }>('nautobot/devices?reload=true')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        setStatusMessage(null)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error reloading devices:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to reload devices: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }, [apiCall, extractFilterOptions])

  const applyFilters = useCallback(() => {
    let filtered = devices

    if (filters.deviceName) {
      filtered = filtered.filter(device =>
        device.name.toLowerCase().includes(filters.deviceName.toLowerCase())
      )
    }

    // Multi-select role filter (checkbox-based)
    const roleMatch = (device: Device) => {
      // If no role filters are set up yet, show all devices
      if (Object.keys(roleFilters).length === 0) return true

      // If device has no role, check if we're filtering by roles
      const deviceRole = device.role?.name || ''

      // If the device's role isn't in our filter list, show it (backward compatibility)
      if (!(deviceRole in roleFilters)) return true

      // Otherwise, check if this role is selected
      return roleFilters[deviceRole] === true
    }
    filtered = filtered.filter(roleMatch)

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

    setFilteredDevices(filtered)

    const totalPages = Math.ceil(filtered.length / pagination.pageSize)
    setPagination(prev => ({
      ...prev,
      currentPage: 0,
      totalItems: filtered.length,
      totalPages
    }))
  }, [devices, filters, roleFilters, pagination.pageSize])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadDevices(),
        loadLocations()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to load initial data: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsLoading(false)
    }
  }, [loadDevices, loadLocations])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const clearAllFilters = () => {
    setFilters({
      deviceName: '',
      role: 'all',
      location: 'all',
      ipAddress: '',
      status: 'all'
    })

    // Reset role filters to all selected
    const resetRoleFilters: Record<string, boolean> = {}
    dropdownOptions.roles.forEach(role => {
      resetRoleFilters[role.name] = true
    })
    setRoleFilters(resetRoleFilters)
  }

  const handleDeviceSelection = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices)
    if (checked) {
      newSelected.add(deviceId)
    } else {
      newSelected.delete(deviceId)
    }
    setSelectedDevices(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageDevices = getCurrentPageDevices()
      const newSelected = new Set(selectedDevices)
      currentPageDevices.forEach(device => newSelected.add(device.id))
      setSelectedDevices(newSelected)
    } else {
      setSelectedDevices(new Set())
    }
  }

  const getCurrentPageDevices = () => {
    const startIndex = pagination.currentPage * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    return filteredDevices.slice(startIndex, endIndex)
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: newPageSize,
      currentPage: 0,
      totalPages: Math.ceil(prev.totalItems / newPageSize)
    }))
  }

  const isFormValid = () => {
    return selectedDevices.size > 0
  }

  const handleOffboardDevices = async () => {
    if (!isFormValid()) {
      setStatusMessage({
        type: 'error',
        message: 'Please select at least one device to offboard'
      })
      return
    }

    setIsSubmitting(true)
    const deviceIds = Array.from(selectedDevices)
    const results: OffboardResult[] = []
    let successCount = 0
    let failedCount = 0

    try {
      setStatusMessage({
        type: 'info',
        message: `Starting offboard process for ${deviceIds.length} device${deviceIds.length > 1 ? 's' : ''}...`
      })

      // Process each device individually
      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i]
        const deviceName = devices.find(d => d.id === deviceId)?.name || deviceId

        try {
          setStatusMessage({
            type: 'info',
            message: `Offboarding device ${i + 1} of ${deviceIds.length}: ${deviceName}...`
          })

          const response = await apiCall<OffboardResult>(
            `nautobot/offboard/${deviceId}`,
            {
              method: 'POST',
              body: {
                remove_primary_ip: offboardProperties.removePrimaryIp,
                remove_interface_ips: offboardProperties.removeInterfaceIps,
                remove_from_checkmk: offboardProperties.removeFromCheckMK,
                nautobot_integration_mode: nautobotIntegrationMode
              }
            }
          )

          if (response) {
            results.push(response)
            if (response.success) {
              successCount++
            } else {
              failedCount++
            }
          } else {
            failedCount++
            results.push({
              success: false,
              device_id: deviceId || 'unknown',
              device_name: deviceName || 'Unknown Device',
              removed_items: [],
              skipped_items: [],
              errors: ['No response received from server'],
              summary: 'Offboarding failed: No response from server'
            })
          }
        } catch (error) {
          failedCount++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.push({
            success: false,
            device_id: deviceId || 'unknown',
            device_name: deviceName || 'Unknown Device',
            removed_items: [],
            skipped_items: [],
            errors: [errorMessage],
            summary: `Offboarding failed: ${errorMessage}`
          })
        }
      }

      // Create summary
      const summary: OffboardSummary = {
        totalDevices: deviceIds.length,
        successfulDevices: successCount,
        failedDevices: failedCount,
        results
      }

      setOffboardSummary(summary)
      setShowResultsModal(true)

      // Clear selected devices after processing
      setSelectedDevices(new Set())

      // Set final status message
      if (failedCount === 0) {
        setStatusMessage({
          type: 'success',
          message: `Successfully offboarded all ${successCount} device${successCount > 1 ? 's' : ''}`
        })
      } else if (successCount === 0) {
        setStatusMessage({
          type: 'error',
          message: `Failed to offboard all ${failedCount} device${failedCount > 1 ? 's' : ''}`
        })
      } else {
        setStatusMessage({
          type: 'warning',
          message: `Offboarding completed: ${successCount} successful, ${failedCount} failed`
        })
      }

      // Refresh device list after offboarding
      setTimeout(() => loadDevices(), 1000)

    } catch (error) {
      console.error('Offboard process failed:', error)
      setStatusMessage({
        type: 'error',
        message: `Offboard process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) return 'bg-blue-500'
    if (statusLower.includes('failed') || statusLower.includes('offline')) return 'bg-red-500'
    if (statusLower.includes('maintenance')) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  const currentPageDevices = getCurrentPageDevices()

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          <span>Loading devices...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <Minus className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Offboard Devices</h1>
            <p className="text-gray-600 mt-1">Remove devices and corresponding IP addresses from Nautobot and Checkmk</p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <Alert className={`${
          statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
          statusMessage.type === 'success' ? 'border-green-500 bg-green-50' :
          statusMessage.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
          'border-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
              {statusMessage.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
              {statusMessage.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
              {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
              <AlertDescription className="text-sm">
                {statusMessage.message}
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusMessage(null)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Offboarding Panel */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-red-400/80 to-red-500/80 text-white py-2 px-4">
              <div className="flex items-center space-x-2">
                <Minus className="h-4 w-4" />
                <div>
                  <h3 className="text-sm font-semibold">Offboarding</h3>
                  <p className="text-red-100 text-xs">Configure removal settings</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white space-y-3">
              {/* IP Removal Options */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">Nautobot Integration</Label>
                <Select value={nautobotIntegrationMode} onValueChange={(value) => setNautobotIntegrationMode(value as NautobotIntegrationMode)}>
                  <SelectTrigger className="h-9 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remove">Remove from Nautobot</SelectItem>
                    <SelectItem value="set-offboarding">Set Offboarding Values</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IP Removal Options */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">IP Address Removal</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remove-primary-ip"
                      checked={offboardProperties.removePrimaryIp}
                      onCheckedChange={(checked) =>
                        setOffboardProperties(prev => ({ ...prev, removePrimaryIp: checked as boolean }))
                      }
                    />
                    <Label htmlFor="remove-primary-ip" className="text-sm font-medium cursor-pointer">
                      Remove Primary IP
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remove-interface-ips"
                      checked={offboardProperties.removeInterfaceIps}
                      onCheckedChange={(checked) =>
                        setOffboardProperties(prev => ({ ...prev, removeInterfaceIps: checked as boolean }))
                      }
                    />
                    <Label htmlFor="remove-interface-ips" className="text-sm font-medium cursor-pointer">
                      Remove Interface IPs
                    </Label>
                  </div>
                </div>
              </div>

              {/* CheckMK Removal Option */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">CheckMK Integration</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remove-from-checkmk"
                      checked={offboardProperties.removeFromCheckMK}
                      onCheckedChange={(checked) =>
                        setOffboardProperties(prev => ({ ...prev, removeFromCheckMK: checked as boolean }))
                      }
                    />
                    <Label htmlFor="remove-from-checkmk" className="text-sm font-medium cursor-pointer">
                      Remove from CheckMK
                    </Label>
                  </div>
                </div>
              </div>

              {/* Offboard Button */}
              <div className="pt-4">
                <Button
                  onClick={handleOffboardDevices}
                  disabled={!isFormValid() || isSubmitting}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Offboarding...
                    </>
                  ) : (
                    <>
                      <Minus className="h-4 w-4 mr-2" />
                      Offboard {selectedDevices.size > 0 ? `${selectedDevices.size} ` : ''}Device{selectedDevices.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Devices Table */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <div>
                    <h3 className="text-sm font-semibold">Devices</h3>
                    <p className="text-blue-100 text-xs">Select devices to offboard from Nautobot</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-white hover:bg-white/20 text-xs h-6"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear Filters
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reloadDevices}
                    className="text-white hover:bg-white/20 text-xs h-6"
                    disabled={isLoading}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    Load Devices
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-0">
              {/* Filters Row */}
              <div className="bg-gray-50 border-b">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        {/* Empty cell for checkbox column */}
                        <td className="pl-4 pr-2 py-3 w-8 text-left"></td>

                        {/* Device Name Filter */}
                        <td className="pl-4 pr-2 py-3 w-48">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-600">Device Name</Label>
                            <Input
                              placeholder="Filter by name..."
                              value={filters.deviceName}
                              onChange={(e) => handleFilterChange('deviceName', e.target.value)}
                              className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                            />
                          </div>
                        </td>

                        {/* IP Address Filter */}
                        <td className="px-4 py-3 w-32">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-600">IP Address</Label>
                            <Input
                              placeholder="Filter by IP..."
                              value={filters.ipAddress}
                              onChange={(e) => handleFilterChange('ipAddress', e.target.value)}
                              className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                            />
                          </div>
                        </td>

                        {/* Role Filter - Multi-select with checkboxes */}
                        <td className="pl-8 pr-4 py-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-600">Role</Label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                                  Role Filter
                                  {Object.values(roleFilters).filter(Boolean).length < dropdownOptions.roles.length && (
                                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                      {Object.values(roleFilters).filter(Boolean).length}
                                    </Badge>
                                  )}
                                  <ChevronDown className="h-4 w-4 ml-auto" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-40">
                                <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-600 hover:bg-red-50"
                                  onSelect={() => {
                                    const resetRoleFilters: Record<string, boolean> = {}
                                    dropdownOptions.roles.forEach(role => {
                                      resetRoleFilters[role.name] = false
                                    })
                                    setRoleFilters(resetRoleFilters)
                                    setPagination(prev => ({ ...prev, currentPage: 0 }))
                                  }}
                                >
                                  Deselect all
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {dropdownOptions.roles.map((role) => (
                                  <DropdownMenuCheckboxItem
                                    key={role.id}
                                    checked={roleFilters[role.name] || false}
                                    onCheckedChange={(checked) =>
                                      setRoleFilters(prev => ({ ...prev, [role.name]: !!checked }))
                                    }
                                  >
                                    {role.name}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>

                        {/* Location Filter - hierarchical searchable dropdown */}
                        <td className="pl-4 pr-2 py-3 w-40">
                          <div className="space-y-1 relative" ref={locationContainerRef}>
                            <Label className="text-xs font-medium text-gray-600">Location</Label>
                            <div>
                              <Input
                                placeholder="Filter by location..."
                                value={locationSearch || (selectedLocationId ? locationsList.find(l => l.id === selectedLocationId)?.hierarchicalPath || '' : '')}
                                onChange={(e) => {
                                  const q = e.target.value
                                  setLocationSearch(q)
                                  if (!q.trim()) setLocationFiltered(locationsList)
                                  else setLocationFiltered(locationsList.filter(l => (l.hierarchicalPath || '').toLowerCase().includes(q.toLowerCase())))
                                  setShowLocationDropdown(true)
                                }}
                                onFocus={() => setShowLocationDropdown(true)}
                                className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                              />
                              {showLocationDropdown && (
                                <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  {locationFiltered.length > 0 ? (
                                    locationFiltered.map(loc => (
                                      <div
                                        key={loc.id}
                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                        onClick={() => {
                                          setSelectedLocationId(loc.id)
                                          setLocationSearch(loc.hierarchicalPath || loc.name)
                                          setShowLocationDropdown(false)
                                          handleFilterChange('location', loc.name)
                                        }}
                                      >
                                        {loc.hierarchicalPath}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Filter */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-600">Status</Label>
                            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                              <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                                <SelectValue placeholder="All Statuses" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {dropdownOptions.statuses.map(status => (
                                  <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="pl-4 pr-2 py-3 w-8 text-left">
                        <Checkbox
                          checked={currentPageDevices.length > 0 && currentPageDevices.every(device => selectedDevices.has(device.id))}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
                      <th className="px-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">IP Address</th>
                      <th className="pl-8 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                      <th className="pl-4 pr-2 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentPageDevices.map((device, index) => (
                      <tr key={device.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="pl-4 pr-2 py-3 w-8 text-left">
                          <Checkbox
                            checked={selectedDevices.has(device.id)}
                            onCheckedChange={(checked) => handleDeviceSelection(device.id, checked as boolean)}
                          />
                        </td>
                        <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-gray-900">
                          {device.name}
                        </td>
                        <td className="px-4 py-3 w-32 text-sm text-gray-600">
                          {device.primary_ip4?.address || 'N/A'}
                        </td>
                        <td className="pl-8 pr-4 py-3 text-sm text-gray-600">
                          {device.role?.name || 'Unknown'}
                        </td>
                        <td className="pl-4 pr-2 py-3 w-40 text-sm text-gray-600">
                          {device.location?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-white ${getStatusBadgeClass(device.status?.name || 'unknown')}`}>
                            {device.status?.name || 'Unknown'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Showing {pagination.currentPage * pagination.pageSize + 1} to{' '}
                    {Math.min((pagination.currentPage + 1) * pagination.pageSize, pagination.totalItems)} of{' '}
                    {pagination.totalItems} devices
                  </span>
                  <Select
                    value={pagination.pageSize.toString()}
                    onValueChange={(value) => handlePageSizeChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(0)}
                    disabled={pagination.currentPage === 0}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(0, pagination.currentPage - 2)
                    const pageNum = startPage + i
                    if (pageNum >= pagination.totalPages) return null

                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8"
                      >
                        {pageNum + 1}
                      </Button>
                    )
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage >= pagination.totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.totalPages - 1)}
                    disabled={pagination.currentPage >= pagination.totalPages - 1}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Minus className="h-5 w-5 text-red-500" />
              <span>Offboarding Results</span>
            </DialogTitle>
          </DialogHeader>

          {offboardSummary && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {offboardSummary.totalDevices}
                  </div>
                  <div className="text-sm text-blue-600">Total Devices</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {offboardSummary.successfulDevices}
                  </div>
                  <div className="text-sm text-green-600">Successful</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {offboardSummary.failedDevices}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Detailed Results</h3>

                {offboardSummary.results.map(result => (
                  <div
                    key={result.device_id}
                    className={`border rounded-lg p-4 ${
                      result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {result.device_name || result.device_id}
                        </span>
                      </div>
                      <Badge
                        className={`${
                          result.success
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-red-500 hover:bg-red-600'
                        } text-white`}
                      >
                        {result.success ? 'Success' : 'Failed'}
                      </Badge>
                    </div>

                    <div className="text-sm mb-3">
                      <strong>Summary:</strong> {result.summary}
                    </div>

                    {result.removed_items.length > 0 && (
                      <div className="mb-3">
                        <strong className="text-sm text-green-700">Items Removed:</strong>
                        <ul className="list-disc list-inside mt-1 text-sm text-green-600">
                          {result.removed_items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.skipped_items.length > 0 && (
                      <div className="mb-3">
                        <strong className="text-sm text-yellow-700">Items Skipped:</strong>
                        <ul className="list-disc list-inside mt-1 text-sm text-yellow-600">
                          {result.skipped_items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.errors.length > 0 && (
                      <div className="mb-3">
                        <strong className="text-sm text-red-700">Errors:</strong>
                        <ul className="list-disc list-inside mt-1 text-sm text-red-600">
                          {result.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => setShowResultsModal(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}