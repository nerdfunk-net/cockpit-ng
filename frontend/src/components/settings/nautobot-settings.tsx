'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, Server, Settings, RotateCcw, Database } from 'lucide-react'

interface NautobotSettings {
  url: string
  token: string
  timeout: number
  verify_ssl: boolean
}

interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  ip_prefix_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
}

interface NautobotOption {
  id: string
  name: string
  color?: string
  description?: string
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

interface CustomField {
  id: string
  name?: string
  key?: string
  type: {
    value: string
  }
  description?: string
  required?: boolean
  default?: string
}

interface CustomFieldChoice {
  id: string
  value: string
  display: string
  weight: number
  custom_field: {
    id: string
    object_type: string
    url: string
  }
}

interface DeviceOffboardingSettings {
  remove_all_custom_fields: boolean
  clear_device_name: boolean
  keep_serial: boolean
  location_id: string
  status_id: string
  role_id: string
  custom_field_settings: { [key: string]: string }
}

interface ApiResponse {
  success: boolean
  data?: NautobotSettings | NautobotDefaults | DeviceOffboardingSettings
  message?: string
}

type StatusType = 'idle' | 'testing' | 'success' | 'error' | 'saving'

export default function NautobotSettingsForm() {
  const { apiCall } = useApi()
  const [settings, setSettings] = useState<NautobotSettings>({
    url: '',
    token: '',
    timeout: 30,
    verify_ssl: true
  })

  const [defaults, setDefaults] = useState<NautobotDefaults>({
    location: '',
    platform: '',
    interface_status: '',
    device_status: '',
    ip_address_status: '',
    ip_prefix_status: '',
    namespace: '',
    device_role: '',
    secret_group: '',
    csv_delimiter: ','
  })

  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [defaultsLoading, setDefaultsLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(true)

  // Nautobot options
  const [deviceStatuses, setDeviceStatuses] = useState<NautobotOption[]>([])
  const [interfaceStatuses, setInterfaceStatuses] = useState<NautobotOption[]>([])
  const [ipAddressStatuses, setIpAddressStatuses] = useState<NautobotOption[]>([])
  const [ipPrefixStatuses, setIpPrefixStatuses] = useState<NautobotOption[]>([])
  const [namespaces, setNamespaces] = useState<NautobotOption[]>([])
  const [deviceRoles, setDeviceRoles] = useState<NautobotOption[]>([])
  const [platforms, setPlatforms] = useState<NautobotOption[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [secretGroups, setSecretGroups] = useState<NautobotOption[]>([])

  // Device offboarding settings
  const [offboardingSettings, setOffboardingSettings] = useState<DeviceOffboardingSettings>({
    remove_all_custom_fields: false,
    clear_device_name: false,
    keep_serial: false,
    location_id: '',
    status_id: '',
    role_id: '',
    custom_field_settings: {}
  })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldChoices, setCustomFieldChoices] = useState<{ [key: string]: CustomFieldChoice[] }>({})
  const [offboardingLoading, setOffboardingLoading] = useState(true)

  // Location search functionality for offboarding
  const [offboardLocationSearch, setOffboardLocationSearch] = useState('')
  const [showOffboardLocationDropdown, setShowOffboardLocationDropdown] = useState(false)
  const [filteredOffboardLocations, setFilteredOffboardLocations] = useState<LocationItem[]>([])

  // Location search functionality for defaults
  const [defaultLocationSearch, setDefaultLocationSearch] = useState('')
  const [showDefaultLocationDropdown, setShowDefaultLocationDropdown] = useState(false)
  const [filteredDefaultLocations, setFilteredDefaultLocations] = useState<LocationItem[]>([])

  // Refs for dropdown positioning
  const defaultLocationContainerRef = useRef<HTMLDivElement>(null)

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
    loadDefaults()
    loadNautobotOptions()
    loadOffboardingSettings()
    loadCustomFields()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Location filtering effect for offboarding
  useEffect(() => {
    if (!offboardLocationSearch.trim()) {
      setFilteredOffboardLocations(locations)
    } else {
      const searchLower = offboardLocationSearch.toLowerCase()
      const filtered = locations.filter(location =>
        location.hierarchicalPath?.toLowerCase().includes(searchLower)
      )
      setFilteredOffboardLocations(filtered)
    }
  }, [offboardLocationSearch, locations])

  // Location filtering effect for defaults
  useEffect(() => {
    if (!defaultLocationSearch.trim()) {
      setFilteredDefaultLocations(locations)
    } else {
      const searchLower = defaultLocationSearch.toLowerCase()
      const filtered = locations.filter(location =>
        location.hierarchicalPath?.toLowerCase().includes(searchLower)
      )
      setFilteredDefaultLocations(filtered)
    }
  }, [defaultLocationSearch, locations])

  // Update location search display when locations are loaded and we have a location_id
  useEffect(() => {
    if (offboardingSettings.location_id && locations.length > 0) {
      const selectedLocation = locations.find(loc => loc.id === offboardingSettings.location_id)
      if (selectedLocation) {
        setOffboardLocationSearch(selectedLocation.hierarchicalPath || selectedLocation.name)
      }
    }
  }, [locations, offboardingSettings.location_id])

  // Update default location search display when locations are loaded and we have a default location
  useEffect(() => {
    if (defaults.location && locations.length > 0) {
      const selectedLocation = locations.find(loc => loc.id === defaults.location)
      if (selectedLocation) {
        setDefaultLocationSearch(selectedLocation.hierarchicalPath || selectedLocation.name)
      }
    }
  }, [locations, defaults.location])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.location-dropdown-container')) {
        setShowOffboardLocationDropdown(false)
        setShowDefaultLocationDropdown(false)
      }
    }

    if (showOffboardLocationDropdown || showDefaultLocationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showOffboardLocationDropdown, showDefaultLocationDropdown])


  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data: ApiResponse = await apiCall('settings/nautobot')
      if (data.success && data.data) {
        setSettings(data.data as NautobotSettings)
      }
    } catch (error) {
      console.error('Error loading Nautobot settings:', error)
      showMessage('Failed to load settings', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDefaults = async () => {
    try {
      setDefaultsLoading(true)
      const data: ApiResponse = await apiCall('settings/nautobot/defaults')
      if (data.success && data.data) {
        setDefaults(data.data as NautobotDefaults)
      }
    } catch (error) {
      console.error('Error loading Nautobot defaults:', error)
    } finally {
      setDefaultsLoading(false)
    }
  }

  const testConnection = async () => {
    setStatus('testing')
    setMessage('')

    try {
      const data: ApiResponse = await apiCall('settings/test/nautobot', {
        method: 'POST',
        body: settings
      })

      if (data.success) {
        setStatus('success')
        setMessage('Connection successful!')
      } else {
        setStatus('error')
        setMessage(data.message || 'Connection failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Connection failed')
      console.error('Error testing connection:', error)
    }

    // Reset status after 5 seconds
    setTimeout(() => {
      setStatus('idle')
      setMessage('')
    }, 5000)
  }

  const saveSettings = async () => {
    setStatus('saving')
    setMessage('')

    try {
      const data: ApiResponse = await apiCall('settings/nautobot', {
        method: 'POST',
        body: settings
      })

      if (data.success) {
        showMessage('Nautobot settings saved successfully!', 'success')
      } else {
        showMessage(data.message || 'Failed to save settings', 'error')
      }
    } catch (error) {
      showMessage('Error saving settings', 'error')
      console.error('Error saving settings:', error)
    } finally {
      setStatus('idle')
    }
  }

  const resetSettings = () => {
    setSettings({
      url: '',
      token: '',
      timeout: 30,
      verify_ssl: true
    })
    showMessage('Settings reset to defaults', 'success')
  }

  const saveDefaults = async () => {
    setStatus('saving')
    setMessage('')

    try {
      const data: ApiResponse = await apiCall('settings/nautobot/defaults', {
        method: 'POST',
        body: defaults
      })

      if (data.success) {
        showMessage('Nautobot defaults saved successfully!', 'success')
      } else {
        showMessage(data.message || 'Failed to save defaults', 'error')
      }
    } catch (error) {
      showMessage('Error saving defaults', 'error')
      console.error('Error saving defaults:', error)
    } finally {
      setStatus('idle')
    }
  }

  const resetDefaults = () => {
    setDefaults({
      location: '',
      platform: '',
      interface_status: '',
      device_status: '',
      ip_address_status: '',
      ip_prefix_status: '',
      namespace: '',
      device_role: '',
      secret_group: '',
      csv_delimiter: ','
    })
    showMessage('Defaults reset', 'success')
  }

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setStatus(type === 'success' ? 'success' : 'error')

    setTimeout(() => {
      setMessage('')
      setStatus('idle')
    }, 5000)
  }

  const updateSetting = (key: keyof NautobotSettings, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateDefault = (key: keyof NautobotDefaults, value: string) => {
    setDefaults(prev => ({ ...prev, [key]: value }))
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
    return path.length > 1 ? path.join(' → ') : (path[0] || '')
  }

  const handleOffboardLocationSelect = (location: LocationItem) => {
    setOffboardLocationSearch(location.hierarchicalPath || location.name)
    setOffboardingSettings(prev => ({ ...prev, location_id: location.id }))
    setShowOffboardLocationDropdown(false)
  }

  const handleDefaultLocationSelect = (location: LocationItem) => {
    setDefaultLocationSearch(location.hierarchicalPath || location.name)
    setDefaults(prev => ({ ...prev, location: location.id }))
    setShowDefaultLocationDropdown(false)
  }

  const saveOffboardingSettings = async () => {
    setStatus('saving')
    setMessage('')

    try {
      const data: ApiResponse = await apiCall('settings/offboarding', {
        method: 'POST',
        body: offboardingSettings
      })

      if (data.success) {
        showMessage('Device offboarding settings saved successfully!', 'success')
      } else {
        showMessage(data.message || 'Failed to save offboarding settings', 'error')
      }
    } catch (error) {
      showMessage('Error saving offboarding settings', 'error')
      console.error('Error saving offboarding settings:', error)
    } finally {
      setStatus('idle')
    }
  }

  const loadNautobotOptions = async () => {
    try {
      setOptionsLoading(true)

      // Load all options in parallel
      const [deviceStatusesRes, interfaceStatusesRes, ipAddressStatusesRes, ipPrefixStatusesRes, namespacesRes, deviceRolesRes, platformsRes, locationsRes, secretGroupsRes] = await Promise.all([
        apiCall('nautobot/statuses/device'),
        apiCall('nautobot/statuses/interface'),
        apiCall('nautobot/statuses/ipaddress'),
        apiCall('nautobot/statuses/prefix'),
        apiCall('nautobot/namespaces'),
        apiCall('nautobot/roles/devices'),
        apiCall('nautobot/platforms'),
        apiCall('nautobot/locations'),
        apiCall('nautobot/secret-groups')
      ])

      setDeviceStatuses(Array.isArray(deviceStatusesRes) ? deviceStatusesRes : [])
      setInterfaceStatuses(Array.isArray(interfaceStatusesRes) ? interfaceStatusesRes : [])
      setIpAddressStatuses(Array.isArray(ipAddressStatusesRes) ? ipAddressStatusesRes : [])
      setIpPrefixStatuses(Array.isArray(ipPrefixStatusesRes) ? ipPrefixStatusesRes : [])
      setNamespaces(Array.isArray(namespacesRes) ? namespacesRes : [])
      setDeviceRoles(Array.isArray(deviceRolesRes) ? deviceRolesRes : [])
      setPlatforms(Array.isArray(platformsRes) ? platformsRes : [])

      // Build location hierarchy like in onboard-device page
      const processedLocations = buildLocationHierarchy(Array.isArray(locationsRes) ? locationsRes : [])
      setLocations(processedLocations)
      setFilteredOffboardLocations(processedLocations)

      setSecretGroups(Array.isArray(secretGroupsRes) ? secretGroupsRes : [])
    } catch (error) {
      console.error('Error loading Nautobot options:', error)
    } finally {
      setOptionsLoading(false)
    }
  }

  const loadOffboardingSettings = async () => {
    try {
      setOffboardingLoading(true)
      const data: ApiResponse = await apiCall('settings/offboarding')
      if (data.success && data.data) {
        const settings = data.data as DeviceOffboardingSettings
        setOffboardingSettings(settings)

        // If there's a location_id, find the location and set the search display
        if (settings.location_id && locations.length > 0) {
          const selectedLocation = locations.find(loc => loc.id === settings.location_id)
          if (selectedLocation) {
            setOffboardLocationSearch(selectedLocation.hierarchicalPath || selectedLocation.name)
          }
        } else {
          setOffboardLocationSearch('')
        }
      }
    } catch (error) {
      console.error('Error loading device offboarding settings:', error)
    } finally {
      setOffboardingLoading(false)
    }
  }

  const loadCustomFields = async () => {
    try {
      const customFieldsRes = await apiCall('nautobot/custom-fields/devices')
      if (Array.isArray(customFieldsRes)) {
        console.log('Custom fields response:', customFieldsRes) // Debug log
        setCustomFields(customFieldsRes)

        // Load choices for select fields
        const choicesMap: { [key: string]: CustomFieldChoice[] } = {}
        for (const field of customFieldsRes) {
          // Check if field has a valid name
          const fieldName = field.name || field.key || field.id
          if (!fieldName) {
            console.warn('Custom field missing name property:', field)
            continue
          }

          if (field.type?.value === 'select') {
            try {
              console.log(`Loading choices for field: ${fieldName}`)
              const choices = await apiCall(`nautobot/custom-field-choices/${fieldName}`)
              console.log(`Choices for ${fieldName}:`, choices)
              if (Array.isArray(choices)) {
                choicesMap[fieldName] = choices
              }
            } catch (error) {
              console.error(`Error loading choices for ${fieldName}:`, error)
            }
          }
        }
        setCustomFieldChoices(choicesMap)
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
    }
  }

  if (isLoading || defaultsLoading || optionsLoading || offboardingLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nautobot Settings</h1>
            <p className="text-gray-600">Configure your Nautobot server connection and default values</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={cn(
          "p-4 rounded-lg border flex items-center space-x-2",
          status === 'success' && "bg-green-50 border-green-200 text-green-800",
          status === 'error' && "bg-red-50 border-red-200 text-red-800"
        )}>
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value="defaults" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="offboarding" className="flex items-center space-x-2">
            <RotateCcw className="h-4 w-4" />
            <span>Offboarding</span>
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                <span>Nautobot Connection Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nautobot URL */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-url" className="text-sm font-medium text-gray-700">
                    Nautobot Server URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nautobot-url"
                    type="url"
                    placeholder="https://nautobot.example.com"
                    value={settings.url}
                    onChange={(e) => updateSetting('url', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    The base URL of your Nautobot instance
                  </p>
                </div>

                {/* API Token */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-token" className="text-sm font-medium text-gray-700">
                    API Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nautobot-token"
                    type="password"
                    placeholder="Enter your Nautobot API token"
                    value={settings.token}
                    onChange={(e) => updateSetting('token', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Get your API token from Nautobot: Admin → Users → [Your User] → API Tokens.{' '}
                    <strong>Required permissions:</strong> At minimum &apos;read&apos; access to dcim models (devices, sites, etc.)
                  </p>
                </div>

                {/* Connection Timeout */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-timeout" className="text-sm font-medium text-gray-700">
                    Connection Timeout (seconds)
                  </Label>
                  <Input
                    id="nautobot-timeout"
                    type="number"
                    min="5"
                    max="300"
                    value={settings.timeout}
                    onChange={(e) => updateSetting('timeout', parseInt(e.target.value) || 30)}
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Request timeout in seconds (default: 30)
                  </p>
                </div>

                {/* SSL Verification */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-ssl" className="text-sm font-medium text-gray-700">
                    SSL Verification
                  </Label>
                  <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                    <Checkbox
                      id="nautobot-ssl"
                      checked={settings.verify_ssl}
                      onCheckedChange={(checked) => updateSetting('verify_ssl', !!checked)}
                      className="border-gray-300"
                    />
                    <Label htmlFor="nautobot-ssl" className="text-sm text-gray-700">
                      Verify SSL certificates
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Uncheck only for development environments
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testConnection}
                        disabled={status === 'testing' || !settings.url || !settings.token}
                        className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {status === 'testing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                        <span>{status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
                      </Button>

                      {/* Connection Status */}
                      {status === 'success' && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Connection successful!</span>
                        </div>
                      )}

                      {status === 'error' && message && (
                        <div className="flex items-center space-x-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">{message}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      Test your connection before saving
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connection Action Buttons */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={resetSettings}
                className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset to Defaults</span>
              </Button>

              <Button
                type="button"
                onClick={saveSettings}
                disabled={status === 'saving' || !settings.url || !settings.token}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
              >
                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{status === 'saving' ? 'Saving...' : 'Save Settings'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Defaults Tab */}
        <TabsContent value="defaults" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                <span>Nautobot Default Values</span>
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">
                Configure default values used when creating devices in Nautobot
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="default-location" className="text-sm font-medium text-gray-700">
                    Location
                  </Label>
                  <div className="relative location-dropdown-container" ref={defaultLocationContainerRef}>
                    <Input
                      placeholder="Search location..."
                      value={defaultLocationSearch}
                      onChange={(e) => {
                        const query = e.target.value
                        setDefaultLocationSearch(query)
                        setShowDefaultLocationDropdown(true)
                      }}
                      onFocus={() => setShowDefaultLocationDropdown(true)}
                      className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    {showDefaultLocationDropdown && (
                      <div
                        className="fixed z-[9999] mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[300px]"
                        style={{
                          top: defaultLocationContainerRef.current?.getBoundingClientRect().bottom ?? 0,
                          left: defaultLocationContainerRef.current?.getBoundingClientRect().left ?? 0,
                          width: defaultLocationContainerRef.current?.getBoundingClientRect().width ?? 'auto'
                        }}
                      >
                        {filteredDefaultLocations.length > 0 ? (
                          filteredDefaultLocations.map((location) => (
                            <div
                              key={location.id}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                              onClick={() => handleDefaultLocationSelect(location)}
                            >
                              {location.hierarchicalPath}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Default location for new devices
                  </p>
                </div>

                {/* Platform */}
                <div className="space-y-2">
                  <Label htmlFor="default-platform" className="text-sm font-medium text-gray-700">
                    Platform
                  </Label>
                  <Select value={defaults.platform} onValueChange={(value) => updateDefault('platform', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detect">
                        Auto-Detect Platform
                      </SelectItem>
                      {platforms.map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default platform for new devices
                  </p>
                </div>

                {/* Interface Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-interface-status" className="text-sm font-medium text-gray-700">
                    Interface Status
                  </Label>
                  <Select value={defaults.interface_status} onValueChange={(value) => updateDefault('interface_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select interface status" />
                    </SelectTrigger>
                    <SelectContent>
                      {interfaceStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new interfaces
                  </p>
                </div>

                {/* Device Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-device-status" className="text-sm font-medium text-gray-700">
                    Device Status
                  </Label>
                  <Select value={defaults.device_status} onValueChange={(value) => updateDefault('device_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select device status" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new devices
                  </p>
                </div>

                {/* IP Address Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-ip-status" className="text-sm font-medium text-gray-700">
                    IP Address Status
                  </Label>
                  <Select value={defaults.ip_address_status} onValueChange={(value) => updateDefault('ip_address_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select IP address status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ipAddressStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new IP addresses
                  </p>
                </div>

                {/* IP Prefix Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-ip-prefix-status" className="text-sm font-medium text-gray-700">
                    IP Prefix Status
                  </Label>
                  <Select value={defaults.ip_prefix_status} onValueChange={(value) => updateDefault('ip_prefix_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select IP prefix status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ipPrefixStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new IP prefixes
                  </p>
                </div>

                {/* Namespace */}
                <div className="space-y-2">
                  <Label htmlFor="default-namespace" className="text-sm font-medium text-gray-700">
                    Namespace
                  </Label>
                  <Select value={defaults.namespace} onValueChange={(value) => updateDefault('namespace', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a namespace" />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map((namespace) => (
                        <SelectItem key={namespace.id} value={namespace.id}>
                          {namespace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default namespace for new IP addresses
                  </p>
                </div>

                {/* Device Role */}
                <div className="space-y-2">
                  <Label htmlFor="default-device-role" className="text-sm font-medium text-gray-700">
                    Device Role
                  </Label>
                  <Select value={defaults.device_role} onValueChange={(value) => updateDefault('device_role', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a device role" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center space-x-2">
                            {role.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${role.color}` }} />
                            )}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default role for new devices
                  </p>
                </div>

                {/* Secret Group */}
                <div className="space-y-2">
                  <Label htmlFor="default-secret-group" className="text-sm font-medium text-gray-700">
                    Secret Group
                  </Label>
                  <Select value={defaults.secret_group} onValueChange={(value) => updateDefault('secret_group', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a secret group" />
                    </SelectTrigger>
                    <SelectContent>
                      {secretGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default secret group for device credentials
                  </p>
                </div>

                {/* CSV Delimiter */}
                <div className="space-y-2">
                  <Label htmlFor="default-csv-delimiter" className="text-sm font-medium text-gray-700">
                    CSV Delimiter
                  </Label>
                  <Input
                    id="default-csv-delimiter"
                    type="text"
                    maxLength={1}
                    placeholder=","
                    value={defaults.csv_delimiter}
                    onChange={(e) => updateDefault('csv_delimiter', e.target.value)}
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Default delimiter for CSV file uploads (default: comma)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Defaults Action Buttons */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={resetDefaults}
                className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Defaults</span>
              </Button>

              <Button
                type="button"
                onClick={saveDefaults}
                disabled={status === 'saving'}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-base font-medium"
              >
                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{status === 'saving' ? 'Saving...' : 'Save Defaults'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Offboarding Tab */}
        <TabsContent value="offboarding" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="text-sm font-medium">Device Offboarding Settings</CardTitle>
              <CardDescription className="text-blue-100 text-xs">
                Configure settings for device offboarding operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Location, Status and Role Selection */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Location Filter */}
                  <div className="space-y-1 relative location-dropdown-container">
                    <Label htmlFor="offboard_location_search" className="text-xs font-medium text-blue-800">
                      Location
                    </Label>
                    <div className="relative">
                      <Input
                        id="offboard_location_search"
                        placeholder="Search locations..."
                        value={offboardLocationSearch}
                        onChange={(e) => setOffboardLocationSearch(e.target.value)}
                        onFocus={() => setShowOffboardLocationDropdown(true)}
                        className={`text-xs h-8 ${offboardingSettings.location_id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500'}`}
                      />
                      {showOffboardLocationDropdown && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {filteredOffboardLocations.length > 0 ? (
                            filteredOffboardLocations.map(location => (
                              <div
                                key={location.id}
                                className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs border-b border-gray-100 last:border-b-0"
                                onClick={() => handleOffboardLocationSelect(location)}
                              >
                                {location.hierarchicalPath}
                              </div>
                            ))
                          ) : (
                            <div className="px-2 py-1 text-xs text-gray-500 italic">
                              No locations found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1">
                    <Label htmlFor="offboard_status" className="text-xs font-medium text-blue-800">
                      Status
                    </Label>
                    <Select value={offboardingSettings.status_id} onValueChange={(value) =>
                      setOffboardingSettings(prev => ({ ...prev, status_id: value }))
                    }>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center space-x-2">
                              {status.color && (
                                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                              )}
                              <span className="text-xs">{status.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Filter */}
                  <div className="space-y-1">
                    <Label htmlFor="offboard_role" className="text-xs font-medium text-blue-800">
                      Role
                    </Label>
                    <Select value={offboardingSettings.role_id} onValueChange={(value) =>
                      setOffboardingSettings(prev => ({ ...prev, role_id: value }))
                    }>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center space-x-2">
                              {role.color && (
                                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: `#${role.color}` }} />
                              )}
                              <span className="text-xs">{role.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Settings Panel */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <h3 className="text-sm font-medium text-gray-900">General Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="remove-all-custom-fields"
                      checked={offboardingSettings.remove_all_custom_fields}
                      onCheckedChange={(checked) =>
                        setOffboardingSettings(prev => ({
                          ...prev,
                          remove_all_custom_fields: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="remove-all-custom-fields" className="text-xs font-medium">
                      Remove all custom fields
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="clear-device-name"
                      checked={offboardingSettings.clear_device_name}
                      onCheckedChange={(checked) =>
                        setOffboardingSettings(prev => ({
                          ...prev,
                          clear_device_name: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="clear-device-name" className="text-xs font-medium">
                      Clear device name
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="keep-serial"
                      checked={offboardingSettings.keep_serial}
                      onCheckedChange={(checked) =>
                        setOffboardingSettings(prev => ({
                          ...prev,
                          keep_serial: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="keep-serial" className="text-xs font-medium">
                      Keep serial
                    </Label>
                  </div>
                </div>
              </div>

              {/* Custom Fields Table */}
              {!offboardingSettings.remove_all_custom_fields && (
                <div className="rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1 px-3">
                    <div className="flex items-center space-x-2">
                      <Settings className="h-3 w-3" />
                      <div>
                        <h3 className="text-xs font-semibold">Custom Fields</h3>
                        <p className="text-blue-100 text-xs">Configure custom field settings for device offboarding</p>
                      </div>
                    </div>
                  </div>
                  {customFields.length > 0 ? (
                    <div className="bg-white">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">Custom Field</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">Value</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-900">Clear Custom Field</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {customFields.map((field) => {
                            const fieldName = field.name || field.key || field.id
                            if (!fieldName) return null

                            const isClearSelected = offboardingSettings.custom_field_settings[fieldName] === 'clear'

                            return (
                              <tr key={field.id} className="hover:bg-gray-50">
                                <td className="px-2 py-2">
                                  <div>
                                    <div className="text-xs font-medium text-gray-900">
                                      {fieldName}
                                      {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </div>
                                    {field.description && (
                                      <div className="text-xs text-gray-500">{field.description}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  {field.type?.value === 'select' ? (
                                    <Select
                                      value={isClearSelected ? '' : (offboardingSettings.custom_field_settings[fieldName] || '')}
                                      onValueChange={(value) =>
                                        setOffboardingSettings(prev => ({
                                          ...prev,
                                          custom_field_settings: {
                                            ...prev.custom_field_settings,
                                            [fieldName]: value
                                          }
                                        }))
                                      }
                                      disabled={isClearSelected}
                                    >
                                      <SelectTrigger className="h-6 text-xs">
                                        <SelectValue placeholder="Select a value" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {customFieldChoices[fieldName]?.map((choice) => (
                                          <SelectItem key={choice.id} value={choice.value}>
                                            {choice.display}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="text"
                                      placeholder={field.default || 'Enter value'}
                                      value={isClearSelected ? '' : (offboardingSettings.custom_field_settings[fieldName] || '')}
                                      onChange={(e) =>
                                        setOffboardingSettings(prev => ({
                                          ...prev,
                                          custom_field_settings: {
                                            ...prev.custom_field_settings,
                                            [fieldName]: e.target.value
                                          }
                                        }))
                                      }
                                      disabled={isClearSelected}
                                      className="h-6 text-xs"
                                    />
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <Checkbox
                                    checked={isClearSelected}
                                    onCheckedChange={(checked) =>
                                      setOffboardingSettings(prev => ({
                                        ...prev,
                                        custom_field_settings: {
                                          ...prev.custom_field_settings,
                                          [fieldName]: checked ? 'clear' : ''
                                        }
                                      }))
                                    }
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-4 bg-white">
                      No custom fields available
                    </div>
                  )}
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={saveOffboardingSettings}
                  disabled={status === 'saving'}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 text-sm font-medium"
                >
                  {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{status === 'saving' ? 'Saving...' : 'Save Offboarding Settings'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}