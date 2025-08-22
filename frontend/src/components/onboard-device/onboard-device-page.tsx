'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, CheckCircle, AlertCircle, Info, X, Settings } from 'lucide-react'

// Type definitions based on the original implementation
interface DropdownOption {
  id: string
  name: string
  display?: string
  value?: string
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

interface OnboardFormData {
  ip_address: string
  location_id: string
  namespace_id: string
  role_id: string
  status_id: string
  platform_id: string
  secret_groups_id: string
  interface_status_id: string
  ip_address_status_id: string
  port: number
  timeout: number
}

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export function OnboardDevicePage() {
  const { isAuthenticated } = useAuthStore()
  const { apiCall } = useApi()

  // Form state
  const [formData, setFormData] = useState<OnboardFormData>({
    ip_address: '',
    location_id: '',
    namespace_id: '',
    role_id: '',
    status_id: '',
    platform_id: 'detect',
    secret_groups_id: '',
    interface_status_id: '',
    ip_address_status_id: '',
    port: 22,
    timeout: 30
  })

  // Dropdown data
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [namespaces, setNamespaces] = useState<DropdownOption[]>([])
  const [deviceRoles, setDeviceRoles] = useState<DropdownOption[]>([])
  const [platforms, setPlatforms] = useState<DropdownOption[]>([])
  const [deviceStatuses, setDeviceStatuses] = useState<DropdownOption[]>([])
  const [interfaceStatuses, setInterfaceStatuses] = useState<DropdownOption[]>([])
  const [ipAddressStatuses, setIpAddressStatuses] = useState<DropdownOption[]>([])
  const [secretGroups, setSecretGroups] = useState<DropdownOption[]>([])

  // Location selector state
  const [locationSearch, setLocationSearch] = useState('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [filteredLocations, setFilteredLocations] = useState<LocationItem[]>([])

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidatingIP, setIsValidatingIP] = useState(false)
  const [isSearchingDevice, setIsSearchingDevice] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')

  // Validation state
  const [ipValidation, setIpValidation] = useState<{
    isValid: boolean
    message: string
  }>({ isValid: false, message: '' })

  // Authentication effect
  useEffect(() => {
    if (!isAuthenticated) {
      return
    }
    loadDropdownData()
  }, [isAuthenticated])

  // Location filtering effect
  useEffect(() => {
    if (!locationSearch.trim()) {
      setFilteredLocations(locations)
    } else {
      const searchLower = locationSearch.toLowerCase()
      const filtered = locations.filter(location => 
        location.hierarchicalPath?.toLowerCase().includes(searchLower)
      )
      setFilteredLocations(filtered)
    }
  }, [locationSearch, locations])

  const loadDropdownData = async () => {
    try {
      setIsLoading(true)
      setStatusMessage({ type: 'info', message: 'Loading configuration options...' })

      // Load all dropdown data in parallel
      const [
        locationsData,
        namespacesData,
        rolesData,
        platformsData,
        deviceStatusesData,
        interfaceStatusesData,
        ipAddressStatusesData,
        secretGroupsData
      ] = await Promise.all([
        apiCall<LocationItem[]>('nautobot/locations'),
        apiCall<DropdownOption[]>('nautobot/namespaces'),
        apiCall<DropdownOption[]>('nautobot/roles/devices'),
        apiCall<DropdownOption[]>('nautobot/platforms'),
        apiCall<DropdownOption[]>('nautobot/statuses/device'),
        apiCall<DropdownOption[]>('nautobot/statuses/interface'),
        apiCall<DropdownOption[]>('nautobot/statuses/ipaddress'),
        apiCall<DropdownOption[]>('nautobot/secret-groups')
      ])

      // Build location hierarchy
      const processedLocations = buildLocationHierarchy(locationsData)
      setLocations(processedLocations)
      setFilteredLocations(processedLocations)

      setNamespaces(namespacesData)
      setDeviceRoles(rolesData)
      setPlatforms(platformsData)
      setDeviceStatuses(deviceStatusesData)
      setInterfaceStatuses(interfaceStatusesData)
      setIpAddressStatuses(ipAddressStatusesData)
      setSecretGroups(secretGroupsData)

      // Set default values
      setFormData(prev => ({
        ...prev,
        namespace_id: findDefaultOption(namespacesData, 'Global')?.id || '',
        role_id: findDefaultOption(rolesData, 'network')?.id || '',
        status_id: findDefaultOption(deviceStatusesData, 'Active')?.id || '',
        interface_status_id: findDefaultOption(interfaceStatusesData, 'Active')?.id || '',
        ip_address_status_id: findDefaultOption(ipAddressStatusesData, 'Active')?.id || ''
      }))

      setStatusMessage(null)
    } catch (error) {
      console.error('Error loading dropdown data:', error)
      setStatusMessage({
        type: 'error',
        message: 'Failed to load configuration options. Please refresh the page and try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const buildLocationHierarchy = (locations: LocationItem[]): LocationItem[] => {
    // Create a map for quick location lookup by ID
    const locationMap = new Map()
    locations.forEach(location => {
      locationMap.set(location.id, location)
    })

    // Build hierarchical path for each location
    const processedLocations = locations.map(location => {
      const hierarchicalPath = buildLocationPath(location, locationMap)
      return {
        ...location,
        hierarchicalPath
      }
    })

    // Sort locations by their hierarchical path
    return processedLocations.sort((a, b) => 
      (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
    )
  }

  const buildLocationPath = (location: LocationItem, locationMap: Map<string, LocationItem>): string => {
    const path: string[] = []
    let current = location

    // Traverse up the hierarchy to build the full path
    while (current) {
      path.unshift(current.name) // Add to beginning of array

      // Move to parent if it exists
      if (current.parent?.id) {
        const parent = locationMap.get(current.parent.id)
        if (parent && !path.includes(parent.name)) { // Prevent circular references
          current = parent
        } else {
          break
        }
      } else {
        break // No parent, we've reached the root
      }
    }

    // Join path with arrows, or return just the name if it's a root location
    return path.length > 1 ? path.join(' → ') : path[0]
  }

  const findDefaultOption = (options: DropdownOption[], name: string): DropdownOption | undefined => {
    return options.find(option => option.name === name || option.display === name)
  }

  const validateIPAddress = (ip: string): boolean => {
    if (!ip.trim()) return false

    const ipAddresses = ip.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

    return ipAddresses.length > 0 && ipAddresses.every(addr => ipRegex.test(addr))
  }

  const handleIPChange = (value: string) => {
    setFormData(prev => ({ ...prev, ip_address: value }))
    
    const isValid = validateIPAddress(value)
    setIpValidation({
      isValid,
      message: isValid ? 'Valid IP address(es)' : 'Please enter valid IP address(es)'
    })
  }

  const handleLocationSelect = (location: LocationItem) => {
    setLocationSearch(location.hierarchicalPath || location.name)
    setFormData(prev => ({ ...prev, location_id: location.id }))
    setShowLocationDropdown(false)
  }

  const handleCheckIPInNautobot = async () => {
    if (!ipValidation.isValid) {
      setStatusMessage({ type: 'error', message: 'Please enter valid IP address(es) first.' })
      return
    }

    const ipAddresses = formData.ip_address.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    const firstIP = ipAddresses[0]

    setIsValidatingIP(true)
    try {
      const data = await apiCall<{
        exists: boolean
        is_assigned_to_device?: boolean
        assigned_devices?: Array<{ name: string }>
      }>('nautobot/check-ip', {
        method: 'POST',
        body: { ip_address: firstIP }
      })

      let message = ''
      if (ipAddresses.length > 1) {
        message += `Note: Checking only first IP (${firstIP}) of ${ipAddresses.length} addresses. `
      }

      if (data.exists) {
        if (data.is_assigned_to_device && data.assigned_devices?.length) {
          const deviceNames = data.assigned_devices.map(device => device.name).join(', ')
          setStatusMessage({
            type: 'error',
            message: `❌ ${message}IP address '${firstIP}' found in Nautobot and assigned to device(s): ${deviceNames}`
          })
        } else {
          setStatusMessage({
            type: 'warning',
            message: `⚠️ ${message}IP address '${firstIP}' found in Nautobot but not assigned to any device.`
          })
        }
      } else {
        setStatusMessage({
          type: 'success',
          message: `✅ ${message}IP address '${firstIP}' not found in Nautobot. Ready for onboarding.`
        })
      }
    } catch (error) {
      console.error('Error checking IP:', error)
      setStatusMessage({
        type: 'error',
        message: `❌ Error checking IP address: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsValidatingIP(false)
    }
  }

  const handleSearchDevice = async () => {
    if (!deviceSearchQuery.trim()) {
      setStatusMessage({ type: 'error', message: 'Please enter a device name to search.' })
      return
    }

    setIsSearchingDevice(true)
    try {
      const data = await apiCall<{
        devices: Array<{
          name: string
          location?: { name: string }
          role?: { name: string }
          primary_ip4?: { address: string }
          status?: { name: string }
        }>
      }>(`nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(deviceSearchQuery)}&limit=10`)

      if (data.devices?.length > 0) {
        if (data.devices.length === 1) {
          const device = data.devices[0]
          const location = device.location ? ` (${device.location.name})` : ''
          const role = device.role ? ` [${device.role.name}]` : ''
          const ip = device.primary_ip4 ? ` - ${device.primary_ip4.address}` : ''
          const status = device.status ? ` (${device.status.name})` : ''
          
          setStatusMessage({
            type: 'success',
            message: `✅ Device found in Nautobot: ${device.name}${role}${location}${ip}${status}`
          })
        } else {
          const deviceList = data.devices.map(device => {
            const location = device.location ? ` (${device.location.name})` : ''
            const role = device.role ? ` [${device.role.name}]` : ''
            const ip = device.primary_ip4 ? ` - ${device.primary_ip4.address}` : ''
            const status = device.status ? ` (${device.status.name})` : ''
            return `${device.name}${role}${location}${ip}${status}`
          }).join(', ')
          
          setStatusMessage({
            type: 'success',
            message: `✅ Found ${data.devices.length} device(s) matching "${deviceSearchQuery}": ${deviceList}`
          })
        }
      } else {
        setStatusMessage({
          type: 'info',
          message: `ℹ️ No devices found in Nautobot with name containing "${deviceSearchQuery}". This name is available for onboarding.`
        })
      }
    } catch (error) {
      console.error('Error searching device:', error)
      setStatusMessage({
        type: 'error',
        message: `❌ Error searching for device: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSearchingDevice(false)
    }
  }

  const validateForm = (): boolean => {
    if (!ipValidation.isValid) {
      setStatusMessage({ type: 'error', message: 'Please enter valid IP address(es).' })
      return false
    }

    const requiredFields = [
      { field: 'location_id', name: 'Location' },
      { field: 'namespace_id', name: 'Namespace' },
      { field: 'role_id', name: 'Device Role' },
      { field: 'status_id', name: 'Device Status' },
      { field: 'secret_groups_id', name: 'Secret Group' },
      { field: 'interface_status_id', name: 'Interface Status' },
      { field: 'ip_address_status_id', name: 'IP Address Status' }
    ]

    const missingFields = requiredFields.filter(({ field }) => !formData[field as keyof OnboardFormData])
    
    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(({ name }) => name).join(', ')
      setStatusMessage({ 
        type: 'error', 
        message: `Please fill in all required fields: ${fieldNames}` 
      })
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const data = await apiCall<{
        job_id: string
        message: string
      }>('nautobot/devices/onboard', {
        method: 'POST',
        body: formData
      })

      setStatusMessage({
        type: 'success',
        message: `✅ Device onboarding initiated successfully! Job ID: ${data.job_id} - ${data.message}`
      })

      // Reset form
      setFormData({
        ip_address: '',
        location_id: '',
        namespace_id: findDefaultOption(namespaces, 'Global')?.id || '',
        role_id: findDefaultOption(deviceRoles, 'network')?.id || '',
        status_id: findDefaultOption(deviceStatuses, 'Active')?.id || '',
        platform_id: 'detect',
        secret_groups_id: '',
        interface_status_id: findDefaultOption(interfaceStatuses, 'Active')?.id || '',
        ip_address_status_id: findDefaultOption(ipAddressStatuses, 'Active')?.id || '',
        port: 22,
        timeout: 30
      })
      setLocationSearch('')
      setIpValidation({ isValid: false, message: '' })
    } catch (error) {
      console.error('Error during onboarding:', error)
      setStatusMessage({
        type: 'error',
        message: `❌ Error during device onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = ipValidation.isValid && 
    formData.location_id && 
    formData.namespace_id && 
    formData.role_id && 
    formData.status_id && 
    formData.secret_groups_id && 
    formData.interface_status_id && 
    formData.ip_address_status_id

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboard Device</h1>
          <p className="text-gray-600 mt-1">Add new devices to your network inventory</p>
        </div>
        
        {/* Device Search */}
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search for devices..."
            value={deviceSearchQuery}
            onChange={(e) => setDeviceSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchDevice()}
            className="w-64"
          />
          <Button 
            onClick={handleSearchDevice}
            disabled={isSearchingDevice}
            variant="outline"
          >
            {isSearchingDevice ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
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

      {/* Main Form */}
      <div className="space-y-6">
        {/* Device Information Panel */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-gray-50 to-white overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 p-6">
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Device Information</span>
            </CardTitle>
            <CardDescription className="text-blue-50">
              Enter the IP address and verify availability in Nautobot
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* IP Address Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="ip_address">
                  IP Address(es) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ip_address"
                  placeholder="192.168.1.1 or 192.168.1.1, 192.168.1.2"
                  value={formData.ip_address}
                  onChange={(e) => handleIPChange(e.target.value)}
                  className={`${
                    ipValidation.isValid ? 'border-green-500' : 
                    formData.ip_address && !ipValidation.isValid ? 'border-red-500' : ''
                  }`}
                />
                {formData.ip_address && (
                  <p className={`text-sm ${ipValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {ipValidation.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  onClick={handleCheckIPInNautobot}
                  disabled={!ipValidation.isValid || isValidatingIP}
                  variant="outline"
                  className="w-full"
                >
                  {isValidatingIP ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Check IP in Nautobot
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Properties Panel */}
        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 p-6">
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Device Properties</span>
            </CardTitle>
            <CardDescription className="text-blue-50">
              Configure device settings and network properties
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
            {/* Device Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Location - Special hierarchical selector */}
            <div className="space-y-2 relative">
              <Label htmlFor="location_search">
                Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="location_search"
                  placeholder="Search locations..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  onFocus={() => setShowLocationDropdown(true)}
                  className={formData.location_id ? 'bg-blue-50 border-blue-300' : ''}
                />
                {showLocationDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map(location => (
                        <div
                          key={location.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          onClick={() => handleLocationSelect(location)}
                        >
                          {location.hierarchicalPath}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 italic">
                        No locations found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Namespace */}
            <div className="space-y-2">
              <Label htmlFor="namespace">
                Namespace <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.namespace_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, namespace_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select namespace..." />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(namespace => (
                    <SelectItem key={namespace.id} value={namespace.id}>
                      {namespace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device Role */}
            <div className="space-y-2">
              <Label htmlFor="device_role">
                Device Role <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.role_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, role_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select device role..." />
                </SelectTrigger>
                <SelectContent>
                  {deviceRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={formData.platform_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, platform_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detect">Auto-Detect Platform</SelectItem>
                  {platforms.map(platform => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device Status */}
            <div className="space-y-2">
              <Label htmlFor="device_status">
                Device Status <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.status_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, status_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select device status..." />
                </SelectTrigger>
                <SelectContent>
                  {deviceStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secret Group */}
            <div className="space-y-2">
              <Label htmlFor="secret_group">
                Secret Group <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.secret_groups_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, secret_groups_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select secret group..." />
                </SelectTrigger>
                <SelectContent>
                  {secretGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interface Status */}
            <div className="space-y-2">
              <Label htmlFor="interface_status">
                Interface Status <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.interface_status_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, interface_status_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select interface status..." />
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

            {/* IP Address Status */}
            <div className="space-y-2">
              <Label htmlFor="ip_address_status">
                IP Address Status <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.ip_address_status_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, ip_address_status_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select IP address status..." />
                </SelectTrigger>
                <SelectContent>
                  {ipAddressStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Port */}
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="22"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  port: parseInt(e.target.value) || 22 
                }))}
              />
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                placeholder="30"
                value={formData.timeout}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  timeout: parseInt(e.target.value) || 30 
                }))}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="px-8"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Onboarding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Onboard Device
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Click outside to close location dropdown */}
      {showLocationDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowLocationDropdown(false)}
        />
      )}
    </div>
  )
}
