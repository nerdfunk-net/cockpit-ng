'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Cookies from 'js-cookie'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Server, Network, AlertCircle, CheckCircle2, Info, Settings } from 'lucide-react'

// Type definitions
interface DropdownOption {
  id: string
  name: string
  display?: string
  value?: string
}

interface DeviceType {
  id: string
  model: string
  manufacturer: {
    id: string
    name: string
  }
  display?: string
}

interface LocationItem {
  id: string
  name: string
  display?: string
  parent?: {
    id: string
    name: string
  }
  hierarchicalPath?: string
}

interface InterfaceData {
  id: string
  name: string
  type: string
  status: string
  ip_address: string
  namespace?: string
  is_primary_ipv4?: boolean
  // Optional properties
  enabled?: boolean
  mgmt_only?: boolean
  description?: string
  mac_address?: string
  mtu?: number
  mode?: string
  untagged_vlan?: string
  tagged_vlans?: string[]
  parent_interface?: string
  bridge?: string
  lag?: string
  tags?: string[]
}

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
const EMPTY_DEVICE_TYPES: DeviceType[] = []
const EMPTY_LOCATIONS: LocationItem[] = []

export function AddDevicePage() {
  const { isAuthenticated } = useAuthStore()
  const { apiCall } = useApi()

  // Device fields
  const [deviceName, setDeviceName] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedDeviceType, setSelectedDeviceType] = useState('')

  // Interface management
  const [interfaces, setInterfaces] = useState<InterfaceData[]>([
    { id: '1', name: '', type: '', status: '', ip_address: '' }
  ])

  // Dropdown data
  const [roles, setRoles] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [statuses, setStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [locations, setLocations] = useState<LocationItem[]>(EMPTY_LOCATIONS)
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>(EMPTY_DEVICE_TYPES)
  const [interfaceTypes, setInterfaceTypes] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [interfaceStatuses, setInterfaceStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [namespaces, setNamespaces] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Location search state
  const [locationSearch, setLocationSearch] = useState('')
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>([])
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const locationContainerRef = useRef<HTMLDivElement | null>(null)

  // Properties modal state
  const [showPropertiesModal, setShowPropertiesModal] = useState(false)
  const [currentInterfaceId, setCurrentInterfaceId] = useState<string | null>(null)

  // Load all dropdown data on mount
  const loadDropdownData = useCallback(async () => {
    if (!isAuthenticated) return

    setIsLoadingData(true)
    try {
      // Load roles
      const rolesData = await apiCall<DropdownOption[]>('nautobot/roles/devices', {
        method: 'GET'
      })
      if (rolesData && Array.isArray(rolesData)) {
        setRoles(rolesData)
      }

      // Load statuses
      const statusesData = await apiCall<DropdownOption[]>('nautobot/statuses/device', {
        method: 'GET'
      })
      if (statusesData && Array.isArray(statusesData)) {
        setStatuses(statusesData)
      }

      // Load locations
      const locationsData = await apiCall<LocationItem[]>('nautobot/locations', {
        method: 'GET'
      })
      if (locationsData && Array.isArray(locationsData)) {
        // Build hierarchical paths for locations
        const locationsWithPaths = locationsData.map(loc => ({
          ...loc,
          hierarchicalPath: buildLocationPath(loc, locationsData)
        }))
        setLocations(locationsWithPaths)
      }

      // Load device types
      const deviceTypesData = await apiCall<DeviceType[]>('nautobot/device-types', {
        method: 'GET'
      })
      if (deviceTypesData && Array.isArray(deviceTypesData)) {
        setDeviceTypes(deviceTypesData)
      }

      // Load interface statuses
      const interfaceStatusesData = await apiCall<DropdownOption[]>('nautobot/statuses/interface', {
        method: 'GET'
      })
      if (interfaceStatusesData && Array.isArray(interfaceStatusesData)) {
        setInterfaceStatuses(interfaceStatusesData)
      }

      // Set interface types (hardcoded common types)
      setInterfaceTypes([
        { id: '1000base-t', name: '1000BASE-T (1GE)' },
        { id: '10gbase-x-sfpp', name: '10GBASE-X SFP+' },
        { id: '25gbase-x-sfp28', name: '25GBASE-X SFP28' },
        { id: '40gbase-x-qsfpp', name: '40GBASE-X QSFP+' },
        { id: '100gbase-x-qsfp28', name: '100GBASE-X QSFP28' },
        { id: 'virtual', name: 'Virtual' },
        { id: 'lag', name: 'Link Aggregation Group (LAG)' },
        { id: 'other', name: 'Other' }
      ])

      // Load namespaces
      const namespacesData = await apiCall<DropdownOption[]>('nautobot/namespaces', {
        method: 'GET'
      })
      if (namespacesData && Array.isArray(namespacesData)) {
        setNamespaces(namespacesData)
      }

    } catch (error) {
      console.error('Error loading dropdown data:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to load form data: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsLoadingData(false)
    }
  }, [isAuthenticated, apiCall])

  useEffect(() => {
    loadDropdownData()
  }, [loadDropdownData])

  // Filter locations based on search
  useEffect(() => {
    if (locationSearch.trim()) {
      setLocationFiltered(
        locations.filter(loc =>
          (loc.hierarchicalPath || loc.name).toLowerCase().includes(locationSearch.toLowerCase())
        )
      )
    } else {
      setLocationFiltered(locations)
    }
  }, [locationSearch, locations])

  // Click outside handler to close location dropdown
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

  // Build hierarchical location path
  const buildLocationPath = (location: LocationItem, allLocations: LocationItem[]): string => {
    const path: string[] = [location.name]
    let current = location

    while (current.parent) {
      const parent = allLocations.find(loc => loc.id === current.parent?.id)
      if (!parent) break
      path.unshift(parent.name)
      current = parent
    }

    return path.join(' > ')
  }

  // Grouped device types by manufacturer
  const groupedDeviceTypes = useMemo(() => {
    const groups: Record<string, DeviceType[]> = {}
    deviceTypes.forEach(dt => {
      const manufacturer = dt.manufacturer.name
      if (!groups[manufacturer]) {
        groups[manufacturer] = []
      }
      groups[manufacturer].push(dt)
    })
    return groups
  }, [deviceTypes])

  // Add new interface
  const handleAddInterface = useCallback(() => {
    const newId = (Math.max(0, ...interfaces.map(i => parseInt(i.id))) + 1).toString()
    setInterfaces(prev => [
      ...prev,
      { id: newId, name: '', type: '', status: '', ip_address: '' }
    ])
  }, [interfaces])

  // Remove interface
  const handleRemoveInterface = useCallback((id: string) => {
    if (interfaces.length > 1) {
      setInterfaces(prev => prev.filter(iface => iface.id !== id))
    }
  }, [interfaces.length])

  // Update interface field
  const handleUpdateInterface = useCallback((id: string, field: keyof InterfaceData, value: string | boolean | number | string[] | undefined) => {
    setInterfaces(prev =>
      prev.map(iface =>
        iface.id === id ? { ...iface, [field]: value } : iface
      )
    )
  }, [])

  // Open properties modal
  const handleOpenProperties = useCallback((interfaceId: string) => {
    setCurrentInterfaceId(interfaceId)
    setShowPropertiesModal(true)
  }, [])

  // Close properties modal
  const handleCloseProperties = useCallback(() => {
    setShowPropertiesModal(false)
    setCurrentInterfaceId(null)
  }, [])

  // Get current interface for properties modal
  const currentInterface = useMemo(() => {
    if (!currentInterfaceId) return null
    return interfaces.find(iface => iface.id === currentInterfaceId) || null
  }, [currentInterfaceId, interfaces])

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!deviceName.trim()) return 'Device name is required'
    if (!selectedRole) return 'Device role is required'
    if (!selectedStatus) return 'Device status is required'
    if (!selectedLocation) return 'Location is required'
    if (!selectedDeviceType) return 'Device type is required'

    // Validate interfaces
    for (let i = 0; i < interfaces.length; i++) {
      const iface = interfaces[i]
      if (!iface) continue // Skip if undefined
      if (!iface.name.trim()) return `Interface ${i + 1}: Name is required`
      if (!iface.type) return `Interface ${i + 1}: Type is required`
      if (!iface.status) return `Interface ${i + 1}: Status is required`
      if (!iface.ip_address.trim()) return `Interface ${i + 1}: IP Address is required`
      if (!iface.namespace) return `Interface ${i + 1}: Namespace is required`
      
      // Validate IP address format (basic check)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
      if (!ipPattern.test(iface.ip_address.trim())) {
        return `Interface ${i + 1}: Invalid IP address format (use x.x.x.x or x.x.x.x/mask)`
      }
    }

    return null
  }, [deviceName, selectedRole, selectedStatus, selectedLocation, selectedDeviceType, interfaces])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setStatusMessage({ type: 'error', message: validationError })
      return
    }

    setIsLoading(true)
    setStatusMessage({ type: 'info', message: 'Starting device addition workflow...' })

    try {
      const token = Cookies.get('cockpit_auth_token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      // Prepare device data for backend
      const deviceData = {
        name: deviceName,
        role: selectedRole,
        status: selectedStatus,
        location: selectedLocation,
        device_type: selectedDeviceType,
        interfaces: interfaces.filter(iface => iface.name && iface.type && iface.status)
      }

      const response = await fetch('/api/proxy/nautobot/add-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deviceData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to add device')
      }

      const result = await response.json()

      // Build detailed status message based on workflow results
      const workflowStatus = result.workflow_status
      const summary = result.summary
      
      let statusMessages: string[] = []
      let hasErrors = false
      let hasWarnings = false

      // Step 1: Device creation
      if (workflowStatus.step1_device.status === 'success') {
        statusMessages.push(`✓ Device "${deviceName}" created successfully`)
      } else if (workflowStatus.step1_device.status === 'failed') {
        statusMessages.push(`✗ Device creation failed: ${workflowStatus.step1_device.message}`)
        hasErrors = true
      }

      // Step 2: IP addresses
      if (workflowStatus.step2_ip_addresses.status === 'success') {
        statusMessages.push(`✓ Created ${summary.ip_addresses_created} IP address(es)`)
      } else if (workflowStatus.step2_ip_addresses.status === 'partial') {
        statusMessages.push(`⚠ ${workflowStatus.step2_ip_addresses.message}`)
        hasWarnings = true
        // Show which IPs failed
        workflowStatus.step2_ip_addresses.errors.forEach((err: any) => {
          statusMessages.push(`  - Failed: ${err.ip_address} (${err.interface}): ${err.error}`)
        })
      } else if (workflowStatus.step2_ip_addresses.status === 'failed') {
        statusMessages.push(`✗ ${workflowStatus.step2_ip_addresses.message}`)
        hasErrors = true
      } else if (workflowStatus.step2_ip_addresses.status === 'skipped') {
        statusMessages.push(`○ No IP addresses to create`)
      }

      // Step 3: Interfaces
      if (workflowStatus.step3_interfaces.status === 'success') {
        statusMessages.push(`✓ Created ${summary.interfaces_created} interface(s)`)
        // Show IP assignment details
        const ipAssignments = workflowStatus.step3_interfaces.data.filter((iface: any) => iface.ip_assigned)
        if (ipAssignments.length > 0) {
          statusMessages.push(`  - Assigned ${ipAssignments.length} IP address(es) to interfaces`)
        }
      } else if (workflowStatus.step3_interfaces.status === 'partial') {
        statusMessages.push(`⚠ ${workflowStatus.step3_interfaces.message}`)
        hasWarnings = true
        // Show which interfaces failed
        workflowStatus.step3_interfaces.errors.forEach((err: any) => {
          statusMessages.push(`  - Failed: ${err.interface}: ${err.error}`)
        })
      } else if (workflowStatus.step3_interfaces.status === 'failed') {
        statusMessages.push(`✗ ${workflowStatus.step3_interfaces.message}`)
        hasErrors = true
      }

      // Step 4: Primary IP
      if (workflowStatus.step4_primary_ip.status === 'success') {
        statusMessages.push(`✓ Primary IPv4 prepared (skeleton)`)
      } else if (workflowStatus.step4_primary_ip.status === 'skipped') {
        statusMessages.push(`○ No primary IPv4 to assign`)
      } else if (workflowStatus.step4_primary_ip.status === 'failed') {
        statusMessages.push(`✗ Primary IPv4 assignment failed`)
        hasWarnings = true
      }

      // Determine overall message type
      let messageType: 'success' | 'error' | 'warning' = 'success'
      if (hasErrors) {
        messageType = 'error'
      } else if (hasWarnings) {
        messageType = 'warning'
      }

      setStatusMessage({
        type: messageType,
        message: statusMessages.join('\n')
      })

      // Only reset form if completely successful
      if (result.success && !hasErrors && !hasWarnings) {
        setTimeout(() => {
          setDeviceName('')
          setSelectedRole('')
          setSelectedStatus('')
          setSelectedLocation('')
          setSelectedDeviceType('')
          setInterfaces([{ id: '1', name: '', type: '', status: '', ip_address: '' }])
          setStatusMessage(null)
        }, 5000)
      }

    } catch (error) {
      console.error('Error adding device:', error)
      setStatusMessage({
        type: 'error',
        message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsLoading(false)
    }
  }, [validateForm, deviceName, selectedRole, selectedStatus, selectedLocation, selectedDeviceType, interfaces])

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Server className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Device to Nautobot</h1>
          <p className="text-muted-foreground">Add a new network device or bare metal server</p>
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
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {statusMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
              {statusMessage.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
              {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
            </div>
            <AlertDescription className="whitespace-pre-line font-mono text-xs leading-relaxed">
              {statusMessage.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Device Information Card */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Device Information</h3>
              <p className="text-blue-100 text-xs">Enter the basic information for the device. All fields are required.</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device Name */}
            <div className="space-y-1">
              <Label htmlFor="device-name" className="text-xs font-medium">
                Device Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="device-name"
                placeholder="e.g., switch-01, server-web-01"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label htmlFor="role" className="text-xs font-medium">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isLoading}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select device role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs font-medium">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus} disabled={isLoading}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <Label htmlFor="location" className="text-xs font-medium">
                Location <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={locationContainerRef}>
                <Input
                  id="location"
                  placeholder="Search for location..."
                  value={locationSearch || (selectedLocation ? locations.find(l => l.id === selectedLocation)?.hierarchicalPath || '' : '')}
                  onChange={(e) => {
                    const q = e.target.value
                    setLocationSearch(q)
                    setShowLocationDropdown(true)
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                  disabled={isLoading}
                />
                {showLocationDropdown && locationFiltered.length > 0 && (
                  <div
                    className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {locationFiltered.map(loc => (
                      <div
                        key={loc.id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          setSelectedLocation(loc.id)
                          setLocationSearch(loc.hierarchicalPath || loc.name)
                          setShowLocationDropdown(false)
                        }}
                      >
                        {loc.hierarchicalPath || loc.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Device Type */}
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="device-type" className="text-xs font-medium">
                Device Type <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType} disabled={isLoading}>
                <SelectTrigger id="device-type">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedDeviceTypes).map(([manufacturer, types]) => (
                    <div key={manufacturer}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {manufacturer}
                      </div>
                      {types.map(dt => (
                        <SelectItem key={dt.id} value={dt.id}>
                          {dt.model}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Network Interfaces Card */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Network Interfaces</h3>
                <p className="text-blue-100 text-xs">Add one or more network interfaces with IP addresses. All fields are required for each interface.</p>
              </div>
            </div>
            <Button
              onClick={handleAddInterface}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Interface
            </Button>
          </div>
        </div>
        <div className="p-4 bg-white space-y-3">
          {interfaces.map((iface, index) => (
            <div key={iface.id} className="p-3 border rounded-lg space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Interface {index + 1}</Badge>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleOpenProperties(iface.id)}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    className="h-8 px-3"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Properties
                  </Button>
                  {interfaces.length > 1 && (
                    <Button
                      onClick={() => handleRemoveInterface(iface.id)}
                      disabled={isLoading}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Row 1: Interface Name, Type, Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Interface Name */}
                <div className="space-y-1">
                  <Label htmlFor={`interface-name-${iface.id}`} className="text-xs font-medium">
                    Interface Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`interface-name-${iface.id}`}
                    placeholder="e.g., eth0, Ethernet0/0, mgmt0"
                    value={iface.name}
                    onChange={(e) => handleUpdateInterface(iface.id, 'name', e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {/* Interface Type */}
                <div className="space-y-1">
                  <Label htmlFor={`interface-type-${iface.id}`} className="text-xs font-medium">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={iface.type}
                    onValueChange={(value) => handleUpdateInterface(iface.id, 'type', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id={`interface-type-${iface.id}`}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {interfaceTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Interface Status */}
                <div className="space-y-1">
                  <Label htmlFor={`interface-status-${iface.id}`} className="text-xs font-medium">
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={iface.status}
                    onValueChange={(value) => handleUpdateInterface(iface.id, 'status', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id={`interface-status-${iface.id}`}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {interfaceStatuses.map(status => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: IP Address, Namespace, and Primary IPv4 Checkbox */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* IP Address */}
                <div className="space-y-1">
                  <Label htmlFor={`interface-ip-${iface.id}`} className="text-xs font-medium">
                    IP Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`interface-ip-${iface.id}`}
                    placeholder="e.g., 192.168.1.10/24"
                    value={iface.ip_address}
                    onChange={(e) => handleUpdateInterface(iface.id, 'ip_address', e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {/* Namespace */}
                <div className="space-y-1">
                  <Label htmlFor={`interface-namespace-${iface.id}`} className="text-xs font-medium">
                    Namespace <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={iface.namespace || ''}
                    onValueChange={(value) => handleUpdateInterface(iface.id, 'namespace', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id={`interface-namespace-${iface.id}`}>
                      <SelectValue placeholder="Select namespace" />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map(ns => (
                        <SelectItem key={ns.id} value={ns.id}>
                          {ns.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Primary IPv4 Checkbox */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Primary IP
                  </Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background">
                    <Checkbox
                      id={`interface-primary-${iface.id}`}
                      checked={iface.is_primary_ipv4 || false}
                      onCheckedChange={(checked) => handleUpdateInterface(iface.id, 'is_primary_ipv4', checked)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={`interface-primary-${iface.id}`}
                      className="ml-2 text-xs font-normal cursor-pointer"
                    >
                      Set as Primary IPv4
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          size="lg"
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Adding Device...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </>
          )}
        </Button>
      </div>

      {/* Properties Modal */}
      {currentInterface && (
        <Dialog open={showPropertiesModal} onOpenChange={setShowPropertiesModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Interface Properties - {currentInterface.name || 'Unnamed Interface'}
              </DialogTitle>
              <DialogDescription>
                Configure additional properties for this interface. All fields are optional.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Enabled and Management-Only Checkboxes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`enabled-${currentInterface.id}`}
                    checked={currentInterface.enabled ?? true}
                    onCheckedChange={(checked) =>
                      handleUpdateInterface(currentInterface.id, 'enabled', checked === true)
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor={`enabled-${currentInterface.id}`} className="cursor-pointer">
                    Enabled
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`mgmt-only-${currentInterface.id}`}
                    checked={currentInterface.mgmt_only ?? false}
                    onCheckedChange={(checked) =>
                      handleUpdateInterface(currentInterface.id, 'mgmt_only', checked === true)
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor={`mgmt-only-${currentInterface.id}`} className="cursor-pointer">
                    Management Only
                  </Label>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor={`description-${currentInterface.id}`}>Description</Label>
                <Textarea
                  id={`description-${currentInterface.id}`}
                  placeholder="Enter interface description..."
                  value={currentInterface.description ?? ''}
                  onChange={(e) =>
                    handleUpdateInterface(currentInterface.id, 'description', e.target.value)
                  }
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* MAC Address and MTU */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`mac-address-${currentInterface.id}`}>MAC Address</Label>
                  <Input
                    id={`mac-address-${currentInterface.id}`}
                    placeholder="e.g., 00:1A:2B:3C:4D:5E"
                    value={currentInterface.mac_address ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(currentInterface.id, 'mac_address', e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`mtu-${currentInterface.id}`}>MTU</Label>
                  <Input
                    id={`mtu-${currentInterface.id}`}
                    type="number"
                    placeholder="e.g., 1500"
                    value={currentInterface.mtu ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(
                        currentInterface.id,
                        'mtu',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Mode */}
              <div className="space-y-1.5">
                <Label htmlFor={`mode-${currentInterface.id}`}>Mode</Label>
                <Select
                  value={currentInterface.mode ?? ''}
                  onValueChange={(value) =>
                    handleUpdateInterface(currentInterface.id, 'mode', value)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id={`mode-${currentInterface.id}`}>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access">Access</SelectItem>
                    <SelectItem value="tagged">Tagged</SelectItem>
                    <SelectItem value="tagged-all">Tagged All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* VLAN Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`untagged-vlan-${currentInterface.id}`}>Untagged VLAN ID</Label>
                  <Input
                    id={`untagged-vlan-${currentInterface.id}`}
                    placeholder="e.g., 100"
                    value={currentInterface.untagged_vlan ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(currentInterface.id, 'untagged_vlan', e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`tagged-vlans-${currentInterface.id}`}>
                    Tagged VLAN IDs (comma-separated)
                  </Label>
                  <Input
                    id={`tagged-vlans-${currentInterface.id}`}
                    placeholder="e.g., 10,20,30"
                    value={currentInterface.tagged_vlans?.join(',') ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(
                        currentInterface.id,
                        'tagged_vlans',
                        e.target.value ? e.target.value.split(',').map(v => v.trim()).filter(Boolean) : []
                      )
                    }
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Parent Interface, Bridge, and LAG */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`parent-interface-${currentInterface.id}`}>
                    Parent Interface ID
                  </Label>
                  <Input
                    id={`parent-interface-${currentInterface.id}`}
                    placeholder="e.g., interface-uuid-123"
                    value={currentInterface.parent_interface ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(currentInterface.id, 'parent_interface', e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`bridge-${currentInterface.id}`}>Bridge Interface ID</Label>
                    <Input
                      id={`bridge-${currentInterface.id}`}
                      placeholder="e.g., bridge-uuid-123"
                      value={currentInterface.bridge ?? ''}
                      onChange={(e) =>
                        handleUpdateInterface(currentInterface.id, 'bridge', e.target.value)
                      }
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`lag-${currentInterface.id}`}>LAG Interface ID</Label>
                    <Input
                      id={`lag-${currentInterface.id}`}
                      placeholder="e.g., lag-uuid-123"
                      value={currentInterface.lag ?? ''}
                      onChange={(e) =>
                        handleUpdateInterface(currentInterface.id, 'lag', e.target.value)
                      }
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label htmlFor={`tags-${currentInterface.id}`}>
                  Tags (comma-separated)
                </Label>
                <Input
                  id={`tags-${currentInterface.id}`}
                  placeholder="e.g., production, critical, monitored"
                  value={currentInterface.tags?.join(',') ?? ''}
                  onChange={(e) =>
                    handleUpdateInterface(
                      currentInterface.id,
                      'tags',
                      e.target.value ? e.target.value.split(',').map(v => v.trim()).filter(Boolean) : []
                    )
                  }
                  disabled={isLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCloseProperties}
                variant="outline"
                disabled={isLoading}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
