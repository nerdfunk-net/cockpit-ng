'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, CheckCircle, AlertCircle, Info, X, Settings, Eye, RefreshCw, FileUp, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  namespace: string
  device_role: string
  secret_group: string
}

interface CSVRow {
  ipaddress: string
  location?: string
  interface_status?: string
  device_status?: string
  ipaddress_status?: string
  namespace?: string
  device_role?: string
  secret_group?: string
  platform?: string
}

interface ParsedCSVRow extends CSVRow {
  rowNumber: number
  isValid: boolean
  validationErrors: string[]
  mappedData: {
    location_id?: string
    location_display?: string
    namespace_id?: string
    namespace_display?: string
    role_id?: string
    role_display?: string
    status_id?: string
    status_display?: string
    platform_id?: string
    platform_display?: string
    secret_groups_id?: string
    secret_groups_display?: string
    interface_status_id?: string
    interface_status_display?: string
    ip_address_status_id?: string
    ip_address_status_display?: string
  }
}

export function OnboardDevicePage() {
  const { isAuthenticated } = useAuthStore()
  const { apiCall } = useApi()
  const router = useRouter()

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

  // Default values from settings
  const [nautobotDefaults, setNautobotDefaults] = useState<NautobotDefaults | null>(null)

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

  // Job tracking state
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [isCheckingJob, setIsCheckingJob] = useState(false)
  const [onboardedIPAddress, setOnboardedIPAddress] = useState<string>('')

  // CSV upload state
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [parsedCSVData, setParsedCSVData] = useState<ParsedCSVRow[]>([])
  const [isParsingCSV, setIsParsingCSV] = useState(false)
  const [isOnboardingBulk, setIsOnboardingBulk] = useState(false)
  const [bulkOnboardingResults, setBulkOnboardingResults] = useState<{
    rowNumber: number
    ipaddress: string
    success: boolean
    message: string
    jobId?: string
  }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Load all dropdown data and defaults in parallel
      const [
        locationsData,
        namespacesData,
        rolesData,
        platformsData,
        deviceStatusesData,
        interfaceStatusesData,
        ipAddressStatusesData,
        secretGroupsData,
        defaultsResponse
      ] = await Promise.all([
        apiCall<LocationItem[]>('nautobot/locations'),
        apiCall<DropdownOption[]>('nautobot/namespaces'),
        apiCall<DropdownOption[]>('nautobot/roles/devices'),
        apiCall<DropdownOption[]>('nautobot/platforms'),
        apiCall<DropdownOption[]>('nautobot/statuses/device'),
        apiCall<DropdownOption[]>('nautobot/statuses/interface'),
        apiCall<DropdownOption[]>('nautobot/statuses/ipaddress'),
        apiCall<DropdownOption[]>('nautobot/secret-groups'),
        apiCall<{success: boolean, data: NautobotDefaults}>('settings/nautobot/defaults')
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

      // Store defaults for future use
      const defaults = defaultsResponse?.success ? defaultsResponse.data : null
      setNautobotDefaults(defaults)

      // Apply default values to form
      applyDefaultsToForm(defaults, processedLocations)

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

  const applyDefaultsToForm = (defaults: NautobotDefaults | null, locations: LocationItem[]) => {
    if (!defaults) {
      // Fallback to hardcoded defaults if no settings defaults available
      setFormData(prev => ({
        ...prev,
        namespace_id: findDefaultOption(namespaces, 'Global')?.id || '',
        role_id: findDefaultOption(deviceRoles, 'network')?.id || '',
        status_id: findDefaultOption(deviceStatuses, 'Active')?.id || '',
        interface_status_id: findDefaultOption(interfaceStatuses, 'Active')?.id || '',
        ip_address_status_id: findDefaultOption(ipAddressStatuses, 'Active')?.id || ''
      }))
      return
    }

    // Find location for setting location search
    const defaultLocation = locations.find(loc => loc.id === defaults.location)
    if (defaultLocation) {
      setLocationSearch(defaultLocation.hierarchicalPath || defaultLocation.name)
    }

    // Apply defaults from settings
    setFormData(prev => ({
      ...prev,
      location_id: defaults.location || '',
      platform_id: defaults.platform || 'detect',
      namespace_id: defaults.namespace || '',
      role_id: defaults.device_role || '',
      status_id: defaults.device_status || '',
      interface_status_id: defaults.interface_status || '',
      ip_address_status_id: defaults.ip_address_status || '',
      secret_groups_id: defaults.secret_group || ''
    }))
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

      // Save job information for tracking
      setJobId(data.job_id)
      setOnboardedIPAddress(formData.ip_address)
      setJobStatus(null) // Reset job status

      setStatusMessage({
        type: 'success',
        message: `✅ Device onboarding initiated successfully! Job ID: ${data.job_id} - ${data.message}`
      })

      // Reset form with defaults
      setFormData({
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
      setLocationSearch('')
      setIpValidation({ isValid: false, message: '' })

      // Reapply defaults
      applyDefaultsToForm(nautobotDefaults, locations)
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

  const handleCheckJob = async () => {
    if (!jobId) return

    setIsCheckingJob(true)
    try {
      const data = await apiCall<{
        status: string
      }>(`nautobot/jobs/${jobId}/results`)

      setJobStatus(data.status)

      if (data.status === 'SUCCESS') {
        setStatusMessage({
          type: 'success',
          message: `✅ Job completed successfully! The device has been onboarded.`
        })
      } else if (data.status === 'FAILURE') {
        setStatusMessage({
          type: 'error',
          message: `❌ Job failed. Please check the job details in Nautobot.`
        })
      } else {
        setStatusMessage({
          type: 'info',
          message: `ℹ️ Job status: ${data.status}. The job is still running or queued.`
        })
      }
    } catch (error) {
      console.error('Error checking job:', error)
      setStatusMessage({
        type: 'error',
        message: `❌ Error checking job status: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsCheckingJob(false)
    }
  }

  const handleGoToSyncDevices = () => {
    // Navigate to sync devices page with the IP address filter
    const ipAddresses = onboardedIPAddress.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    const firstIP = ipAddresses[0]

    // Navigate with query parameters to pre-fill the filter
    router.push(`/sync-devices?ip_filter=${encodeURIComponent(firstIP)}`)
  }

  // CSV Upload Handlers
  const handleCSVUpload = () => {
    setShowCSVModal(true)
    setParsedCSVData([])
    setBulkOnboardingResults([])
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      parseCSVFile(file)
    }
  }

  const parseCSVFile = async (file: File) => {
    setIsParsingCSV(true)
    setParsedCSVData([])
    
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setStatusMessage({
          type: 'error',
          message: 'CSV file must contain at least a header row and one data row.'
        })
        return
      }

      // Parse header row (case-insensitive)
      const headerLine = lines[0]
      const headers = headerLine.split(',').map(h => h.trim().toLowerCase())
      
      // Check for mandatory ipaddress column
      const ipIndex = headers.indexOf('ipaddress')
      if (ipIndex === -1) {
        setStatusMessage({
          type: 'error',
          message: 'CSV file must contain an "ipaddress" column.'
        })
        return
      }

      // Map optional column indices
      const columnMap = {
        ipaddress: ipIndex,
        location: headers.indexOf('location'),
        interface_status: headers.indexOf('interface_status'),
        device_status: headers.indexOf('device_status'),
        ipaddress_status: headers.indexOf('ipaddress_status'),
        namespace: headers.indexOf('namespace'),
        device_role: headers.indexOf('device_role'),
        secret_group: headers.indexOf('secret_group'),
        platform: headers.indexOf('platform')
      }

      // Parse data rows
      const parsedRows: ParsedCSVRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim())
        
        const row: CSVRow = {
          ipaddress: values[columnMap.ipaddress] || ''
        }

        // Add optional fields if present in CSV
        if (columnMap.location >= 0 && values[columnMap.location]) {
          row.location = values[columnMap.location]
        }
        if (columnMap.interface_status >= 0 && values[columnMap.interface_status]) {
          row.interface_status = values[columnMap.interface_status]
        }
        if (columnMap.device_status >= 0 && values[columnMap.device_status]) {
          row.device_status = values[columnMap.device_status]
        }
        if (columnMap.ipaddress_status >= 0 && values[columnMap.ipaddress_status]) {
          row.ipaddress_status = values[columnMap.ipaddress_status]
        }
        if (columnMap.namespace >= 0 && values[columnMap.namespace]) {
          row.namespace = values[columnMap.namespace]
        }
        if (columnMap.device_role >= 0 && values[columnMap.device_role]) {
          row.device_role = values[columnMap.device_role]
        }
        if (columnMap.secret_group >= 0 && values[columnMap.secret_group]) {
          row.secret_group = values[columnMap.secret_group]
        }
        if (columnMap.platform >= 0 && values[columnMap.platform]) {
          row.platform = values[columnMap.platform]
        }

        // Validate and map row
        const parsedRow = validateAndMapCSVRow(row, i + 1)
        parsedRows.push(parsedRow)
      }

      setParsedCSVData(parsedRows)
      
      const validCount = parsedRows.filter(r => r.isValid).length
      const invalidCount = parsedRows.length - validCount
      
      setStatusMessage({
        type: invalidCount > 0 ? 'warning' : 'success',
        message: `Parsed ${parsedRows.length} rows: ${validCount} valid, ${invalidCount} invalid.`
      })
    } catch (error) {
      console.error('Error parsing CSV:', error)
      setStatusMessage({
        type: 'error',
        message: `Error parsing CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsParsingCSV(false)
    }
  }

  const validateAndMapCSVRow = (row: CSVRow, rowNumber: number): ParsedCSVRow => {
    const validationErrors: string[] = []
    const mappedData: ParsedCSVRow['mappedData'] = {}

    // Validate IP address
    if (!validateIPAddress(row.ipaddress)) {
      validationErrors.push('Invalid IP address')
    }

    // Map location
    if (row.location) {
      const location = locations.find(loc => 
        loc.name.toLowerCase() === row.location?.toLowerCase() ||
        loc.hierarchicalPath?.toLowerCase() === row.location?.toLowerCase()
      )
      if (location) {
        mappedData.location_id = location.id
        mappedData.location_display = location.hierarchicalPath || location.name
      } else {
        validationErrors.push(`Location "${row.location}" not found`)
      }
    } else if (formData.location_id) {
      // Use default from form
      const defaultLocation = locations.find(loc => loc.id === formData.location_id)
      mappedData.location_id = formData.location_id
      mappedData.location_display = defaultLocation?.hierarchicalPath || defaultLocation?.name || 'Default'
    }

    // Map namespace
    if (row.namespace) {
      const namespace = namespaces.find(ns => ns.name.toLowerCase() === row.namespace?.toLowerCase())
      if (namespace) {
        mappedData.namespace_id = namespace.id
        mappedData.namespace_display = namespace.name
      } else {
        validationErrors.push(`Namespace "${row.namespace}" not found`)
      }
    } else if (formData.namespace_id) {
      const defaultNamespace = namespaces.find(ns => ns.id === formData.namespace_id)
      mappedData.namespace_id = formData.namespace_id
      mappedData.namespace_display = defaultNamespace?.name || 'Default'
    }

    // Map device role
    if (row.device_role) {
      const role = deviceRoles.find(r => r.name.toLowerCase() === row.device_role?.toLowerCase())
      if (role) {
        mappedData.role_id = role.id
        mappedData.role_display = role.name
      } else {
        validationErrors.push(`Device role "${row.device_role}" not found`)
      }
    } else if (formData.role_id) {
      const defaultRole = deviceRoles.find(r => r.id === formData.role_id)
      mappedData.role_id = formData.role_id
      mappedData.role_display = defaultRole?.name || 'Default'
    }

    // Map device status
    if (row.device_status) {
      const status = deviceStatuses.find(s => s.name.toLowerCase() === row.device_status?.toLowerCase())
      if (status) {
        mappedData.status_id = status.id
        mappedData.status_display = status.name
      } else {
        validationErrors.push(`Device status "${row.device_status}" not found`)
      }
    } else if (formData.status_id) {
      const defaultStatus = deviceStatuses.find(s => s.id === formData.status_id)
      mappedData.status_id = formData.status_id
      mappedData.status_display = defaultStatus?.name || 'Default'
    }

    // Map platform
    if (row.platform) {
      const platform = platforms.find(p => p.name.toLowerCase() === row.platform?.toLowerCase())
      if (platform) {
        mappedData.platform_id = platform.id
        mappedData.platform_display = platform.name
      } else {
        validationErrors.push(`Platform "${row.platform}" not found`)
      }
    } else {
      mappedData.platform_id = formData.platform_id
      mappedData.platform_display = formData.platform_id === 'detect' ? 'Auto-Detect' : 
        platforms.find(p => p.id === formData.platform_id)?.name || 'Default'
    }

    // Map secret group
    if (row.secret_group) {
      const secretGroup = secretGroups.find(sg => sg.name.toLowerCase() === row.secret_group?.toLowerCase())
      if (secretGroup) {
        mappedData.secret_groups_id = secretGroup.id
        mappedData.secret_groups_display = secretGroup.name
      } else {
        validationErrors.push(`Secret group "${row.secret_group}" not found`)
      }
    } else if (formData.secret_groups_id) {
      const defaultSecretGroup = secretGroups.find(sg => sg.id === formData.secret_groups_id)
      mappedData.secret_groups_id = formData.secret_groups_id
      mappedData.secret_groups_display = defaultSecretGroup?.name || 'Default'
    }

    // Map interface status
    if (row.interface_status) {
      const status = interfaceStatuses.find(s => s.name.toLowerCase() === row.interface_status?.toLowerCase())
      if (status) {
        mappedData.interface_status_id = status.id
        mappedData.interface_status_display = status.name
      } else {
        validationErrors.push(`Interface status "${row.interface_status}" not found`)
      }
    } else if (formData.interface_status_id) {
      const defaultStatus = interfaceStatuses.find(s => s.id === formData.interface_status_id)
      mappedData.interface_status_id = formData.interface_status_id
      mappedData.interface_status_display = defaultStatus?.name || 'Default'
    }

    // Map IP address status
    if (row.ipaddress_status) {
      const status = ipAddressStatuses.find(s => s.name.toLowerCase() === row.ipaddress_status?.toLowerCase())
      if (status) {
        mappedData.ip_address_status_id = status.id
        mappedData.ip_address_status_display = status.name
      } else {
        validationErrors.push(`IP address status "${row.ipaddress_status}" not found`)
      }
    } else if (formData.ip_address_status_id) {
      const defaultStatus = ipAddressStatuses.find(s => s.id === formData.ip_address_status_id)
      mappedData.ip_address_status_id = formData.ip_address_status_id
      mappedData.ip_address_status_display = defaultStatus?.name || 'Default'
    }

    // Check if all required fields are mapped
    if (!mappedData.location_id) validationErrors.push('Location is required')
    if (!mappedData.namespace_id) validationErrors.push('Namespace is required')
    if (!mappedData.role_id) validationErrors.push('Device role is required')
    if (!mappedData.status_id) validationErrors.push('Device status is required')
    if (!mappedData.secret_groups_id) validationErrors.push('Secret group is required')
    if (!mappedData.interface_status_id) validationErrors.push('Interface status is required')
    if (!mappedData.ip_address_status_id) validationErrors.push('IP address status is required')

    return {
      ...row,
      rowNumber,
      isValid: validationErrors.length === 0,
      validationErrors,
      mappedData
    }
  }

  const handleBulkOnboard = async () => {
    const validRows = parsedCSVData.filter(row => row.isValid)
    
    if (validRows.length === 0) {
      setStatusMessage({
        type: 'error',
        message: 'No valid rows to onboard. Please fix the errors first.'
      })
      return
    }

    setIsOnboardingBulk(true)
    setBulkOnboardingResults([])
    const results: typeof bulkOnboardingResults = []

    for (const row of validRows) {
      try {
        const onboardData = {
          ip_address: row.ipaddress,
          location_id: row.mappedData.location_id!,
          namespace_id: row.mappedData.namespace_id!,
          role_id: row.mappedData.role_id!,
          status_id: row.mappedData.status_id!,
          platform_id: row.mappedData.platform_id!,
          secret_groups_id: row.mappedData.secret_groups_id!,
          interface_status_id: row.mappedData.interface_status_id!,
          ip_address_status_id: row.mappedData.ip_address_status_id!,
          port: formData.port,
          timeout: formData.timeout
        }

        const data = await apiCall<{
          job_id: string
          message: string
        }>('nautobot/devices/onboard', {
          method: 'POST',
          body: onboardData
        })

        results.push({
          rowNumber: row.rowNumber,
          ipaddress: row.ipaddress,
          success: true,
          message: data.message,
          jobId: data.job_id
        })
      } catch (error) {
        results.push({
          rowNumber: row.rowNumber,
          ipaddress: row.ipaddress,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    setBulkOnboardingResults(results)
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    setStatusMessage({
      type: failureCount > 0 ? 'warning' : 'success',
      message: `Bulk onboarding completed: ${successCount} succeeded, ${failureCount} failed.`
    })

    setIsOnboardingBulk(false)
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
            className="w-64 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
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
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Information</h3>
                <p className="text-blue-100 text-xs">Enter IP address and verify availability</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white">
            {/* IP Address Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="ip_address" className="text-xs font-medium">
                  IP Address(es) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ip_address"
                  placeholder="192.168.1.1 or 192.168.1.1, 192.168.1.2"
                  value={formData.ip_address}
                  onChange={(e) => handleIPChange(e.target.value)}
                  className={`h-8 text-sm border-2 bg-white ${
                    ipValidation.isValid ? 'border-green-500 bg-green-50' : 
                    formData.ip_address && !ipValidation.isValid ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
                  }`}
                />
                {formData.ip_address && (
                  <p className={`text-xs ${ipValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {ipValidation.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">&nbsp;</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCheckIPInNautobot}
                    disabled={!ipValidation.isValid || isValidatingIP}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    {isValidatingIP ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        Check IP
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCSVUpload}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    title="Upload CSV file to onboard multiple devices"
                  >
                    <FileUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Device Properties Panel */}
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Properties</h3>
                <p className="text-blue-100 text-xs">Configure device settings and network properties</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white">
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
                  className={`border-2 ${formData.location_id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500'}`}
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
                className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
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
                className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="px-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
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
        </div>

        {/* Job Status Panel */}
        {jobId && (
          <div className="rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-400/80 to-purple-500/80 text-white py-2 px-4">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <div>
                  <h3 className="text-sm font-semibold">Job Status Check</h3>
                  <p className="text-purple-100 text-xs">Track the onboarding job progress</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Job ID</Label>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded border">
                    {jobId}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Onboarded IP Address</Label>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded border">
                    {onboardedIPAddress}
                  </p>
                </div>
              </div>

              {jobStatus && (
                <div>
                  <Label className="text-sm font-medium">Current Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        jobStatus === 'SUCCESS' ? 'default' :
                        jobStatus === 'FAILURE' ? 'destructive' :
                        'secondary'
                      }
                      className={
                        jobStatus === 'SUCCESS' ? 'bg-green-100 text-green-800 border-green-300' :
                        jobStatus === 'FAILURE' ? 'bg-red-100 text-red-800 border-red-300' :
                        'bg-blue-100 text-blue-800 border-blue-300'
                      }
                    >
                      {jobStatus}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleCheckJob}
                  disabled={isCheckingJob}
                  variant="outline"
                  size="sm"
                >
                  {isCheckingJob ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-2" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Check Job Status
                    </>
                  )}
                </Button>

                {jobStatus === 'SUCCESS' && (
                  <Button
                    onClick={handleGoToSyncDevices}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    size="sm"
                  >
                    <Settings className="h-3 w-3 mr-2" />
                    Go to Sync Devices
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Click outside to close location dropdown */}
      {showLocationDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowLocationDropdown(false)}
        />
      )}

      {/* CSV Upload Modal */}
      <Dialog open={showCSVModal} onOpenChange={setShowCSVModal}>
        <DialogContent className="!max-w-[70vw] !w-[98vw] max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Upload CSV for Bulk Device Onboarding</DialogTitle>
            <DialogDescription className="text-xs">
              Required: <strong>ipaddress</strong> | Optional: location, interface_status, device_status, ipaddress_status, namespace, device_role, secret_group, platform
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* File Upload Section */}
            {parsedCSVData.length === 0 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <FileUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <Label
                    htmlFor="csv-file-input"
                    className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Click to select CSV file
                  </Label>
                  <p className="text-sm text-gray-500 mt-2">
                    or drag and drop
                  </p>
                </div>

                {isParsingCSV && (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                    <span className="text-sm text-gray-600">Parsing CSV file...</span>
                  </div>
                )}
              </div>
            )}

            {/* Parsed Data Table */}
            {parsedCSVData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Total Rows:</span>
                      <span className="ml-2 text-lg font-bold text-gray-900">{parsedCSVData.length}</span>
                    </div>
                    <div className="h-6 w-px bg-gray-300" />
                    <div>
                      <span className="text-sm font-semibold text-green-700">Valid:</span>
                      <span className="ml-2 text-lg font-bold text-green-600">{parsedCSVData.filter(r => r.isValid).length}</span>
                    </div>
                    <div className="h-6 w-px bg-gray-300" />
                    <div>
                      <span className="text-sm font-semibold text-red-700">Invalid:</span>
                      <span className="ml-2 text-lg font-bold text-red-600">{parsedCSVData.filter(r => !r.isValid).length}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setParsedCSVData([])
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <FileUp className="h-3 w-3 mr-1" />
                    Upload Different File
                  </Button>
                </div>

                {/* Scrollable Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-gray-50 z-10">
                        <TableRow>
                          <TableHead className="w-12 text-xs">#</TableHead>
                          <TableHead className="text-xs">IP Address</TableHead>
                          <TableHead className="text-xs">Location</TableHead>
                          <TableHead className="text-xs">Namespace</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Platform</TableHead>
                          <TableHead className="text-xs">Secret Group</TableHead>
                          <TableHead className="text-xs">Interface Status</TableHead>
                          <TableHead className="text-xs">IP Status</TableHead>
                          <TableHead className="w-12 text-xs text-center">Valid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedCSVData.map((row) => (
                          <TableRow 
                            key={row.rowNumber}
                            className={!row.isValid ? 'bg-red-50' : ''}
                          >
                            <TableCell className="font-medium text-xs">{row.rowNumber}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.ipaddress}
                              {!validateIPAddress(row.ipaddress) && (
                                <XCircle className="inline-block h-3 w-3 text-red-500 ml-1" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.location_display || '-'}
                              {row.validationErrors.some(e => e.includes('Location')) && (
                                <div className="text-[10px] text-red-600 mt-0.5">
                                  {row.validationErrors.find(e => e.includes('Location'))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.namespace_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.role_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.status_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.platform_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.secret_groups_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.interface_status_display || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.mappedData.ip_address_status_display || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.isValid ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Validation Errors Summary */}
                {parsedCSVData.some(r => !r.isValid) && (
                  <Alert className="border-yellow-500 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-xs text-yellow-800">
                      <strong>Validation Errors:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {parsedCSVData
                          .filter(r => !r.isValid)
                          .slice(0, 3)
                          .map(row => (
                            <li key={row.rowNumber} className="truncate">
                              Row {row.rowNumber}: {row.validationErrors.join(', ')}
                            </li>
                          ))}
                        {parsedCSVData.filter(r => !r.isValid).length > 3 && (
                          <li className="italic">
                            ... and {parsedCSVData.filter(r => !r.isValid).length - 3} more errors
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Bulk Onboarding Results */}
                {bulkOnboardingResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Onboarding Results</h4>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50">
                          <TableRow>
                            <TableHead className="w-12 text-xs">#</TableHead>
                            <TableHead className="text-xs">IP Address</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Message</TableHead>
                            <TableHead className="text-xs">Job ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkOnboardingResults.map((result) => (
                            <TableRow 
                              key={result.rowNumber}
                              className={result.success ? 'bg-green-50' : 'bg-red-50'}
                            >
                              <TableCell className="text-xs">{result.rowNumber}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {result.ipaddress}
                              </TableCell>
                              <TableCell>
                                {result.success ? (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Success</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">Failed</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{result.message}</TableCell>
                              <TableCell className="font-mono text-[10px]">
                                {result.jobId || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button
                onClick={() => {
                  setShowCSVModal(false)
                  setParsedCSVData([])
                  setBulkOnboardingResults([])
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                variant="outline"
              >
                Close
              </Button>
              {parsedCSVData.length > 0 && bulkOnboardingResults.length === 0 && (
                <Button
                  onClick={handleBulkOnboard}
                  disabled={isOnboardingBulk || parsedCSVData.filter(r => r.isValid).length === 0}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  {isOnboardingBulk ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Onboarding {parsedCSVData.filter(r => r.isValid).length} devices...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Onboard {parsedCSVData.filter(r => r.isValid).length} Devices
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
