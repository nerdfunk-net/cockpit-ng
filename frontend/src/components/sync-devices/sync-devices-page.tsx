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
import { 
  Search, 
  Settings, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  CheckCircle, 
  AlertCircle, 
  Info, 
  X,
  RotateCcw
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

interface SyncProperties {
  prefix_status: string
  interface_status: string
  ip_address_status: string
  namespace: string
  sync_options: string[]
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

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500]

export function SyncDevicesPage() {
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
  const [devicesLoaded, setDevicesLoaded] = useState(false)

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 0,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0
  })

  // Filters state with URL parameter support
  const [filters, setFilters] = useState<TableFilters>(() => {
    // Don't set IP filter immediately - wait for devices to load first
    return {
      deviceName: '',
      role: 'all',
      location: 'all',
      ipAddress: '',
      status: 'all'
    }
  })

  // Sync properties state
  const [syncProperties, setSyncProperties] = useState<SyncProperties>({
    prefix_status: '',
    interface_status: '',
    ip_address_status: '',
    namespace: '',
    sync_options: []
  })

  // Dropdown options
  const [dropdownOptions, setDropdownOptions] = useState({
    namespaces: [] as DropdownOption[],
    prefixStatuses: [] as DropdownOption[],
    interfaceStatuses: [] as DropdownOption[],
    ipAddressStatuses: [] as DropdownOption[],
    roles: [] as DropdownOption[],
    locations: [] as DropdownOption[],
    statuses: [] as DropdownOption[]
  })

  // Location filter state (per LOCATION_FILTER.md)
  const [locationsList, setLocationsList] = useState<LocationItem[]>([])
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>([])
  const [locationSearch, setLocationSearch] = useState<string>('')
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const locationContainerRef = useRef<HTMLDivElement | null>(null)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, logout])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply initial IP filter after devices are loaded
  useEffect(() => {
    if (devicesLoaded) {
      const ipFilter = searchParams?.get('ip_filter')
      if (ipFilter && !filters.ipAddress) {
        setFilters(prev => ({
          ...prev,
          ipAddress: ipFilter
        }))
      }
    }
  }, [devicesLoaded, searchParams, filters.ipAddress])

  // Handle URL parameters
  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter && ipFilter !== filters.ipAddress) {
      // Force device reload when IP filter is present to ensure fresh data
      setDevicesLoaded(false)
      reloadDevices().then(() => {
        setFilters(prev => ({
          ...prev,
          ipAddress: ipFilter
        }))
      })
    }
  }, [searchParams, filters.ipAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters when they change (only after devices are loaded)
  useEffect(() => {
    if (devicesLoaded) {
      applyFilters()
    }
  }, [filters, devices, pagination.pageSize, devicesLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide success messages after 2 seconds
  useEffect(() => {
    if (statusMessage?.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  // Set default values when dropdown options are loaded
  useEffect(() => {
    setDefaultSyncProperties()
  }, [dropdownOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  const setDefaultSyncProperties = () => {
    setSyncProperties(prev => {
      const updates: Partial<SyncProperties> = {}
      
      // Set default namespace to "Global" if available
      if (dropdownOptions.namespaces.length > 0 && !prev.namespace) {
        const globalNamespace = dropdownOptions.namespaces.find(ns => 
          ns.name.toLowerCase().includes('global')
        )
        if (globalNamespace) {
          updates.namespace = globalNamespace.id
        }
      }
      
      // Set default prefix status to "Active" if available
      if (dropdownOptions.prefixStatuses.length > 0 && !prev.prefix_status) {
        const activeStatus = dropdownOptions.prefixStatuses.find(status => 
          status.name.toLowerCase().includes('active')
        )
        if (activeStatus) {
          updates.prefix_status = activeStatus.id
        }
      }
      
      // Set default interface status to "Active" if available
      if (dropdownOptions.interfaceStatuses.length > 0 && !prev.interface_status) {
        const activeStatus = dropdownOptions.interfaceStatuses.find(status => 
          status.name.toLowerCase().includes('active')
        )
        if (activeStatus) {
          updates.interface_status = activeStatus.id
        }
      }
      
      // Set default IP address status to "Active" if available
      if (dropdownOptions.ipAddressStatuses.length > 0 && !prev.ip_address_status) {
        const activeStatus = dropdownOptions.ipAddressStatuses.find(status => 
          status.name.toLowerCase().includes('active')
        )
        if (activeStatus) {
          updates.ip_address_status = activeStatus.id
        }
      }
      
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
    })
  }

  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      // Load all required data in parallel
      await Promise.all([
        loadDevices(),
        loadNamespaces(),
        loadPrefixStatuses(),
        loadInterfaceStatuses(),
        loadIPAddressStatuses(),
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
  }

  // Location filter helpers (from LOCATION_FILTER.md)
  const buildLocationPath = (location: LocationItem, locationMap: Map<string, LocationItem>) => {
    const names: string[] = []
    const visited = new Set<string>()
    let current: LocationItem | undefined = location

    while (current) {
      if (visited.has(current.id)) {
        // cycle detected
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

  const loadLocations = async () => {
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
  }

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

  const loadDevices = async () => {
    try {
      setStatusMessage({ type: 'info', message: 'Loading devices...' })

      const data = await apiCall<{ devices: Device[] }>('nautobot/devices')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        setDevicesLoaded(true)
        setStatusMessage({
          type: 'success',
          message: `Loaded ${data.devices.length} devices successfully`
        })
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
  }

  const reloadDevices = async () => {
    try {
      setStatusMessage({ type: 'info', message: 'Reloading devices from Nautobot...' })

      const data = await apiCall<{ devices: Device[] }>('nautobot/devices?reload=true')

      if (data?.devices) {
        setDevices(data.devices)
        extractFilterOptions(data.devices)
        setDevicesLoaded(true)
        setStatusMessage({
          type: 'success',
          message: `Reloaded ${data.devices.length} devices successfully from Nautobot`
        })
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
  }

  const loadNamespaces = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/namespaces')
      setDropdownOptions(prev => ({ ...prev, namespaces: data || [] }))
    } catch (error) {
      console.error('Error loading namespaces:', error)
    }
  }

  const loadPrefixStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/prefix')
      setDropdownOptions(prev => ({ ...prev, prefixStatuses: data || [] }))
    } catch (error) {
      console.error('Error loading prefix statuses:', error)
    }
  }

  const loadInterfaceStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/interface')
      setDropdownOptions(prev => ({ ...prev, interfaceStatuses: data || [] }))
    } catch (error) {
      console.error('Error loading interface statuses:', error)
    }
  }

  const loadIPAddressStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/ipaddress')
      setDropdownOptions(prev => ({ ...prev, ipAddressStatuses: data || [] }))
    } catch (error) {
      console.error('Error loading IP address statuses:', error)
    }
  }

  const extractFilterOptions = (deviceList: Device[]) => {
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
  }

  const applyFilters = useCallback(() => {
    let filtered = devices

    // Apply filters
    if (filters.deviceName) {
      filtered = filtered.filter(device =>
        device.name.toLowerCase().includes(filters.deviceName.toLowerCase())
      )
    }
    if (filters.role && filters.role !== 'all') {
      filtered = filtered.filter(device => device.role?.name === filters.role)
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

    setFilteredDevices(filtered)
    
    // Update pagination
    const totalPages = Math.ceil(filtered.length / pagination.pageSize)
    setPagination(prev => ({
      ...prev,
      currentPage: 0, // Reset to first page when filters change
      totalItems: filtered.length,
      totalPages
    }))
  }, [devices, filters, pagination.pageSize])

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

  const handleSyncOptionChange = (option: string, checked: boolean) => {
    setSyncProperties(prev => ({
      ...prev,
      sync_options: checked 
        ? [...prev.sync_options, option]
        : prev.sync_options.filter(o => o !== option)
    }))
  }

  const isFormValid = () => {
    return (
      syncProperties.prefix_status &&
      syncProperties.interface_status &&
      syncProperties.ip_address_status &&
      syncProperties.namespace &&
      selectedDevices.size > 0
    )
  }

  const handleSyncDevices = async () => {
    if (!isFormValid()) {
      setStatusMessage({
        type: 'error',
        message: 'Please select devices and complete required sync properties'
      })
      return
    }

    setIsSubmitting(true)
    try {
      const syncData = {
        data: {
          devices: Array.from(selectedDevices),
          default_prefix_status: syncProperties.prefix_status,
          interface_status: syncProperties.interface_status,
          ip_address_status: syncProperties.ip_address_status,
          namespace: syncProperties.namespace,
          sync_cables: syncProperties.sync_options.includes('cables'),
          sync_software_version: syncProperties.sync_options.includes('software'),
          sync_vlans: syncProperties.sync_options.includes('vlans'),
          sync_vrfs: syncProperties.sync_options.includes('vrfs')
        }
      }

      const result = await apiCall<{ success: boolean; message: string }>(
        'nautobot/sync-network-data',
        {
          method: 'POST',
          body: syncData
        }
      )

      if (result?.success) {
        setStatusMessage({
          type: 'success',
          message: `Successfully synchronized ${selectedDevices.size} devices`
        })
        setSelectedDevices(new Set())
        // Refresh devices after sync
        setTimeout(() => loadDevices(), 1000)
      } else {
        throw new Error(result?.message || 'Sync failed')
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setStatusMessage({
        type: 'error',
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
          <span>Loading sync devices...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sync Devices</h1>
          <p className="text-gray-600 mt-1">Synchronize device data with Nautobot</p>
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
        {/* Sync Properties Panel */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <div>
                  <h3 className="text-sm font-semibold">Sync Properties</h3>
                  <p className="text-blue-100 text-xs">Configure synchronization settings</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white space-y-3">
              {/* Namespace */}
              <div className="space-y-1">
                <Label htmlFor="namespace" className="text-xs font-medium">Namespace <span className="text-red-500">*</span></Label>
                <Select 
                  value={syncProperties.namespace} 
                  onValueChange={(value) => setSyncProperties(prev => ({ ...prev, namespace: value }))}
                >
                  <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue placeholder="Select namespace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownOptions.namespaces.map(namespace => (
                      <SelectItem key={namespace.id} value={namespace.id}>
                        {namespace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prefix Status */}
              <div className="space-y-1">
                <Label htmlFor="prefix-status" className="text-xs font-medium">Prefix Status <span className="text-red-500">*</span></Label>
                <Select 
                  value={syncProperties.prefix_status} 
                  onValueChange={(value) => setSyncProperties(prev => ({ ...prev, prefix_status: value }))}
                >
                  <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue placeholder="Select prefix status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownOptions.prefixStatuses.map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interface Status */}
              <div className="space-y-1">
                <Label htmlFor="interface-status" className="text-xs font-medium">Interface Status <span className="text-red-500">*</span></Label>
                <Select 
                  value={syncProperties.interface_status} 
                  onValueChange={(value) => setSyncProperties(prev => ({ ...prev, interface_status: value }))}
                >
                  <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue placeholder="Select interface status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownOptions.interfaceStatuses.map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IP Address Status */}
              <div className="space-y-1">
                <Label htmlFor="ip-address-status" className="text-xs font-medium">IP Address Status <span className="text-red-500">*</span></Label>
                <Select 
                  value={syncProperties.ip_address_status} 
                  onValueChange={(value) => setSyncProperties(prev => ({ ...prev, ip_address_status: value }))}
                >
                  <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue placeholder="Select IP address status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownOptions.ipAddressStatuses.map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sync Options */}
              <div className="space-y-3">
                <Label>Sync Options</Label>
                <div className="space-y-2">
                  {[
                    { id: 'cables', label: 'Sync Cables' },
                    { id: 'software', label: 'Sync Software' },
                    { id: 'vlans', label: 'Sync VLANs' },
                    { id: 'vrfs', label: 'Sync VRFs' }
                  ].map(option => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={syncProperties.sync_options.includes(option.id)}
                        onCheckedChange={(checked) => handleSyncOptionChange(option.id, checked as boolean)}
                      />
                      <Label htmlFor={option.id} className="text-sm font-medium cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync Button */}
              <div className="pt-4">
                <Button
                  onClick={handleSyncDevices}
                  disabled={!isFormValid() || isSubmitting}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync {selectedDevices.size > 0 ? `${selectedDevices.size} ` : ''}Device{selectedDevices.size !== 1 ? 's' : ''}
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
                    <p className="text-blue-100 text-xs">Select devices to synchronize with Nautobot</p>
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

                        {/* Role Filter */}
                        <td className="pl-8 pr-4 py-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-600">Role</Label>
                            <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value)}>
                              <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                                <SelectValue placeholder="All Roles" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {dropdownOptions.roles.map(role => (
                                  <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>

                        {/* Location Filter - hierarchical searchable dropdown (LOCATION_FILTER.md) */}
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
                                          // Apply filter by location name to existing filters model
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
    </div>
  )
}
