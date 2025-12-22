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
import { Plus, Trash2, Server, Network, AlertCircle, CheckCircle2, Info, Settings, FileSpreadsheet, Tags, FileText, Loader2, Upload, X } from 'lucide-react'
import { useCSVUpload } from './hooks/use-csv-upload'
import { CSVUploadModal } from './components/csv-upload-modal'
import { BulkUpdateModal } from './components/bulk-update-modal'
import { ParsedDevice, DeviceImportResult } from './types'

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
    name?: string
    display?: string
  }
  display?: string
}

interface SoftwareVersion {
  id: string
  version: string
  alias?: string
  release_date?: string
  end_of_support_date?: string
  documentation_url?: string
  long_term_support?: boolean
  pre_release?: boolean
  platform?: {
    id: string
    name: string
  }
  tags?: Array<{
    id: string
    name: string
  }>
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

interface VlanItem {
  id: string
  name: string
  description?: string
  vid: number
  role?: {
    id: string
    name: string
  }
  location?: {
    id: string
    name: string
  }
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

interface TagItem {
  id: string
  name: string
  color?: string
}

interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
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
  csv_delimiter: string
}

const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
const EMPTY_DEVICE_TYPES: DeviceType[] = []
const EMPTY_LOCATIONS: LocationItem[] = []
const EMPTY_SOFTWARE_VERSIONS: SoftwareVersion[] = []

export function AddDevicePage() {
  const { isAuthenticated } = useAuthStore()
  const { apiCall } = useApi()

  // Device fields
  const [deviceName, setDeviceName] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedDeviceType, setSelectedDeviceType] = useState('')
  const [selectedSoftwareVersion, setSelectedSoftwareVersion] = useState('')

  // Interface management
  const [interfaces, setInterfaces] = useState<InterfaceData[]>([
    { id: '1', name: '', type: '', status: '', ip_address: '' }
  ])

  // Dropdown data
  const [roles, setRoles] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [statuses, setStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [locations, setLocations] = useState<LocationItem[]>(EMPTY_LOCATIONS)
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>(EMPTY_DEVICE_TYPES)
  const [softwareVersions, setSoftwareVersions] = useState<SoftwareVersion[]>(EMPTY_SOFTWARE_VERSIONS)
  const [interfaceTypes, setInterfaceTypes] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [interfaceStatuses, setInterfaceStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [namespaces, setNamespaces] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Nautobot defaults
  const [nautobotDefaults, setNautobotDefaults] = useState<NautobotDefaults | null>(null)
  const hasInitialized = useRef(false)

  // Location search state
  const [locationSearch, setLocationSearch] = useState('')
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>([])
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const locationContainerRef = useRef<HTMLDivElement | null>(null)

  // Device type search state
  const [deviceTypeSearch, setDeviceTypeSearch] = useState('')
  const [deviceTypeFiltered, setDeviceTypeFiltered] = useState<DeviceType[]>([])
  const [showDeviceTypeDropdown, setShowDeviceTypeDropdown] = useState(false)
  const deviceTypeContainerRef = useRef<HTMLDivElement | null>(null)

  // Software version search state
  const [softwareVersionSearch, setSoftwareVersionSearch] = useState('')
  const [softwareVersionFiltered, setSoftwareVersionFiltered] = useState<SoftwareVersion[]>([])
  const [showSoftwareVersionDropdown, setShowSoftwareVersionDropdown] = useState(false)
  const softwareVersionContainerRef = useRef<HTMLDivElement | null>(null)

  // Properties modal state
  const [showPropertiesModal, setShowPropertiesModal] = useState(false)
  const [currentInterfaceId, setCurrentInterfaceId] = useState<string | null>(null)

  // VLAN state for properties modal
  const [vlans, setVlans] = useState<VlanItem[]>([])
  const [isLoadingVlans, setIsLoadingVlans] = useState(false)

  // Interface type search state (per interface)
  const [interfaceTypeSearch, setInterfaceTypeSearch] = useState<Record<string, string>>({})
  const [showInterfaceTypeDropdown, setShowInterfaceTypeDropdown] = useState<Record<string, boolean>>({})

  // Tags state
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [availableTags, setAvailableTags] = useState<TagItem[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  // Custom fields state
  const [showCustomFieldsModal, setShowCustomFieldsModal] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldChoices, setCustomFieldChoices] = useState<Record<string, string[]>>({})
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false)

  // Bulk Update modal state
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)

  // CSV import device handler
  const handleImportDevice = useCallback(async (device: ParsedDevice): Promise<DeviceImportResult> => {
    try {
      const token = Cookies.get('cockpit_auth_token')
      if (!token) {
        return {
          deviceName: device.name,
          status: 'error',
          message: 'No authentication token found'
        }
      }

      // Resolve IDs from names for device fields
      const roleId = device.role ? roles.find(r => r.name === device.role || r.id === device.role)?.id : selectedRole
      const statusId = device.status ? statuses.find(s => s.name === device.status || s.id === device.status)?.id : selectedStatus
      const locationId = device.location ? locations.find(l => l.name === device.location || l.id === device.location || l.hierarchicalPath === device.location)?.id : selectedLocation
      const deviceTypeId = device.device_type ? deviceTypes.find(dt => dt.model === device.device_type || dt.id === device.device_type || dt.display === device.device_type)?.id : undefined

      // Resolve interface type and status IDs
      const resolvedInterfaces = device.interfaces.map((iface, index) => {
        const typeId = interfaceTypes.find(t => t.name === iface.type || t.id === iface.type)?.id || iface.type
        const statusId = interfaceStatuses.find(s => s.name === iface.status || s.id === iface.status)?.id || iface.status
        const namespaceId = iface.namespace ? namespaces.find(ns => ns.name === iface.namespace || ns.id === iface.namespace)?.id : nautobotDefaults?.namespace

        return {
          id: (index + 1).toString(),
          name: iface.name,
          type: typeId,
          status: statusId,
          ip_address: iface.ip_address || '',
          namespace: namespaceId,
          is_primary_ipv4: iface.is_primary_ipv4,
          enabled: iface.enabled,
          mgmt_only: iface.mgmt_only,
          description: iface.description,
          mac_address: iface.mac_address,
          mtu: iface.mtu,
          mode: iface.mode,
          untagged_vlan: iface.untagged_vlan,
          tagged_vlans: iface.tagged_vlans?.join(','),
          parent_interface: iface.parent_interface,
          bridge: iface.bridge,
          lag: iface.lag,
          tags: iface.tags,
        }
      })

      if (!deviceTypeId) {
        return {
          deviceName: device.name,
          status: 'error',
          message: `Device type "${device.device_type}" not found in Nautobot`
        }
      }

      if (!roleId) {
        return {
          deviceName: device.name,
          status: 'error',
          message: `Role "${device.role}" not found in Nautobot`
        }
      }

      if (!locationId) {
        return {
          deviceName: device.name,
          status: 'error',
          message: `Location "${device.location}" not found in Nautobot`
        }
      }

      const deviceData = {
        name: device.name,
        role: roleId,
        status: statusId || nautobotDefaults?.device_status,
        location: locationId,
        device_type: deviceTypeId,
        serial: device.serial,
        asset_tag: device.asset_tag,
        tags: device.tags,
        custom_fields: device.custom_fields,
        interfaces: resolvedInterfaces
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
        return {
          deviceName: device.name,
          status: 'error',
          message: errorData.detail || 'Failed to add device'
        }
      }

      const result = await response.json()

      return {
        deviceName: device.name,
        status: result.success ? 'success' : 'error',
        message: result.success
          ? `Device created (${result.summary?.interfaces_created || 0} interfaces)`
          : result.message || 'Unknown error',
        deviceId: result.device_id,
        workflowStatus: result.workflow_status
      }
    } catch (error) {
      return {
        deviceName: device.name,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }, [roles, statuses, locations, deviceTypes, interfaceTypes, interfaceStatuses, namespaces, nautobotDefaults, selectedRole, selectedStatus, selectedLocation])

  // CSV Upload hook
  const csvUpload = useCSVUpload({
    nautobotDefaults,
    onImportDevice: handleImportDevice
  })

  // Open Tags modal and load tags
  const handleOpenTagsModal = useCallback(async () => {
    setShowTagsModal(true)
    setIsLoadingTags(true)
    try {
      const tagsData = await apiCall<TagItem[]>('nautobot/tags/devices', { method: 'GET' })
      if (tagsData && Array.isArray(tagsData)) {
        setAvailableTags(tagsData)
      }
    } catch (error) {
      console.error('Error loading tags:', error)
      setAvailableTags([])
    } finally {
      setIsLoadingTags(false)
    }
  }, [apiCall])

  // Toggle tag selection
  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
      console.log('Tag toggled:', tagId, 'New tags:', newTags)
      return newTags
    })
  }, [])

  // Open Custom Fields modal and load custom fields
  const handleOpenCustomFieldsModal = useCallback(async () => {
    setShowCustomFieldsModal(true)
    setIsLoadingCustomFields(true)
    try {
      const fieldsData = await apiCall<CustomField[]>('nautobot/custom-fields/devices', { method: 'GET' })
      if (fieldsData && Array.isArray(fieldsData)) {
        setCustomFields(fieldsData)

        // Load choices for select-type fields
        const selectFields = fieldsData.filter(f => f.type?.value === 'select' || f.type?.value === 'multi-select')
        const choicesPromises = selectFields.map(async (field) => {
          try {
            const choices = await apiCall<string[]>(`nautobot/custom-field-choices/${field.key}`, { method: 'GET' })
            return { key: field.key, choices: choices || [] }
          } catch {
            return { key: field.key, choices: [] }
          }
        })

        const choicesResults = await Promise.all(choicesPromises)
        const choicesMap: Record<string, string[]> = {}
        choicesResults.forEach(result => {
          choicesMap[result.key] = result.choices
        })
        setCustomFieldChoices(choicesMap)
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
      setCustomFields([])
    } finally {
      setIsLoadingCustomFields(false)
    }
  }, [apiCall])

  // Update custom field value
  const handleUpdateCustomField = useCallback((key: string, value: string) => {
    setCustomFieldValues(prev => {
      const newValues = {
        ...prev,
        [key]: value
      }
      console.log('Custom field updated:', key, '=', value, 'All values:', newValues)
      return newValues
    })
  }, [])

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

      // Load software versions
      const softwareVersionsData = await apiCall<SoftwareVersion[]>('nautobot/software-versions', {
        method: 'GET'
      })
      if (softwareVersionsData && Array.isArray(softwareVersionsData)) {
        setSoftwareVersions(softwareVersionsData)
      }

      // Load interface statuses
      const interfaceStatusesData = await apiCall<DropdownOption[]>('nautobot/statuses/interface', {
        method: 'GET'
      })
      if (interfaceStatusesData && Array.isArray(interfaceStatusesData)) {
        setInterfaceStatuses(interfaceStatusesData)
      }

      // Load interface types from Nautobot
      const interfaceTypesData = await apiCall<Array<{value: string, display_name: string}>>('nautobot/interface-types', {
        method: 'GET'
      })
      if (interfaceTypesData && Array.isArray(interfaceTypesData)) {
        setInterfaceTypes(interfaceTypesData.map(t => ({ id: t.value, name: t.display_name })))
      }

      // Load namespaces
      const namespacesData = await apiCall<DropdownOption[]>('nautobot/namespaces', {
        method: 'GET'
      })
      if (namespacesData && Array.isArray(namespacesData)) {
        setNamespaces(namespacesData)
      }

      // Load Nautobot defaults from settings
      const defaultsResponse = await apiCall<{ success: boolean; data: NautobotDefaults }>('settings/nautobot/defaults', {
        method: 'GET'
      })
      if (defaultsResponse?.success && defaultsResponse.data) {
        setNautobotDefaults(defaultsResponse.data)
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

  // Apply defaults when nautobotDefaults loads
  useEffect(() => {
    if (!hasInitialized.current && !isLoadingData && nautobotDefaults) {
      hasInitialized.current = true

      // Apply defaults to form fields
      if (nautobotDefaults.location) {
        setSelectedLocation(nautobotDefaults.location)
        // Set location search display
        const defaultLocation = locations.find(loc => loc.id === nautobotDefaults.location)
        if (defaultLocation) {
          setLocationSearch(defaultLocation.hierarchicalPath || defaultLocation.name)
        }
      }
      if (nautobotDefaults.device_role) {
        setSelectedRole(nautobotDefaults.device_role)
      }
      if (nautobotDefaults.device_status) {
        setSelectedStatus(nautobotDefaults.device_status)
      }

      // Apply defaults to initial interface
      setInterfaces(prev => prev.map(iface => ({
        ...iface,
        status: iface.status || nautobotDefaults.interface_status || '',
        namespace: iface.namespace || nautobotDefaults.namespace || ''
      })))
    }
  }, [isLoadingData, nautobotDefaults, locations])

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

  // Filter device types based on search
  useEffect(() => {
    if (deviceTypeSearch.trim()) {
      setDeviceTypeFiltered(
        deviceTypes.filter(dt =>
          (dt.display || dt.model).toLowerCase().includes(deviceTypeSearch.toLowerCase())
        )
      )
    } else {
      setDeviceTypeFiltered(deviceTypes)
    }
  }, [deviceTypeSearch, deviceTypes])

  // Click outside handler to close device type dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!deviceTypeContainerRef.current) return
      if (!deviceTypeContainerRef.current.contains(e.target as Node)) {
        setShowDeviceTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Filter software versions based on search
  useEffect(() => {
    if (softwareVersionSearch.trim()) {
      setSoftwareVersionFiltered(
        softwareVersions.filter(sv => {
          const displayText = `${sv.platform?.name || ''} ${sv.version}`.toLowerCase()
          return displayText.includes(softwareVersionSearch.toLowerCase())
        })
      )
    } else {
      setSoftwareVersionFiltered(softwareVersions)
    }
  }, [softwareVersionSearch, softwareVersions])

  // Click outside handler to close software version dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!softwareVersionContainerRef.current) return
      if (!softwareVersionContainerRef.current.contains(e.target as Node)) {
        setShowSoftwareVersionDropdown(false)
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

  // Add new interface
  const handleAddInterface = useCallback(() => {
    const newId = (Math.max(0, ...interfaces.map(i => parseInt(i.id))) + 1).toString()
    setInterfaces(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        type: '',
        status: nautobotDefaults?.interface_status || '',
        ip_address: '',
        namespace: nautobotDefaults?.namespace || ''
      }
    ])
  }, [interfaces, nautobotDefaults])

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

  // Open properties modal and load VLANs
  const handleOpenProperties = useCallback(async (interfaceId: string) => {
    setCurrentInterfaceId(interfaceId)
    setShowPropertiesModal(true)

    // Load VLANs for the selected location
    setIsLoadingVlans(true)
    try {
      // Get the location name from the selected location ID
      const selectedLoc = locations.find(loc => loc.id === selectedLocation)
      const locationName = selectedLoc?.name

      // Build the API URL with parameters
      let url = 'nautobot/vlans?get_global_vlans=true'
      if (locationName) {
        url += `&location=${encodeURIComponent(locationName)}`
      }

      const vlansData = await apiCall<VlanItem[]>(url, { method: 'GET' })
      if (vlansData && Array.isArray(vlansData)) {
        setVlans(vlansData)
      }
    } catch (error) {
      console.error('Error loading VLANs:', error)
      setVlans([])
    } finally {
      setIsLoadingVlans(false)
    }
  }, [apiCall, locations, selectedLocation])

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

      // IP address is optional (layer 2 interfaces don't have IP)
      // But if provided, validate format and require namespace
      if (iface.ip_address.trim()) {
        if (!iface.namespace) return `Interface ${i + 1}: Namespace is required when IP address is provided`

        // Validate IP address format (basic check)
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
        if (!ipPattern.test(iface.ip_address.trim())) {
          return `Interface ${i + 1}: Invalid IP address format (use x.x.x.x or x.x.x.x/mask)`
        }
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
      // Get platform ID from selected software version
      const selectedSV = softwareVersions.find(sv => sv.id === selectedSoftwareVersion)
      const platformId = selectedSV?.platform?.id

      // Transform interfaces for backend (convert tagged_vlans array to comma-separated string)
      const transformedInterfaces = interfaces
        .filter(iface => iface.name && iface.type && iface.status)
        .map(iface => ({
          ...iface,
          tagged_vlans: iface.tagged_vlans?.join(',') || undefined
        }))

      // Filter out empty custom field values
      const filteredCustomFields = Object.entries(customFieldValues)
        .filter(([, value]) => value && value.trim() !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Record<string, string>)

      const deviceData = {
        name: deviceName,
        role: selectedRole,
        status: selectedStatus,
        location: selectedLocation,
        device_type: selectedDeviceType,
        platform: platformId || undefined,
        software_version: selectedSoftwareVersion || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        custom_fields: Object.keys(filteredCustomFields).length > 0 ? filteredCustomFields : undefined,
        interfaces: transformedInterfaces
      }

      // DEBUG: Log device data being sent
      console.log('=== DEVICE DATA DEBUG ===')
      console.log('Selected tags state:', selectedTags)
      console.log('Selected tags length:', selectedTags.length)
      console.log('Custom field values state:', customFieldValues)
      console.log('Custom field values keys:', Object.keys(customFieldValues))
      console.log('Filtered custom fields:', filteredCustomFields)
      console.log('Device data being sent:', JSON.stringify(deviceData, null, 2))

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
      
      const statusMessages: string[] = []
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
        workflowStatus.step2_ip_addresses.errors.forEach((err: { ip_address: string; interface: string; error: string }) => {
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
        const ipAssignments = workflowStatus.step3_interfaces.data.filter((iface: { ip_assigned: boolean }) => iface.ip_assigned)
        if (ipAssignments.length > 0) {
          statusMessages.push(`  - Assigned ${ipAssignments.length} IP address(es) to interfaces`)
        }
      } else if (workflowStatus.step3_interfaces.status === 'partial') {
        statusMessages.push(`⚠ ${workflowStatus.step3_interfaces.message}`)
        hasWarnings = true
        // Show which interfaces failed
        workflowStatus.step3_interfaces.errors.forEach((err: { interface: string; error: string }) => {
          statusMessages.push(`  - Failed: ${err.interface}: ${err.error}`)
        })
      } else if (workflowStatus.step3_interfaces.status === 'failed') {
        statusMessages.push(`✗ ${workflowStatus.step3_interfaces.message}`)
        hasErrors = true
      }

      // Step 4: Primary IP
      if (workflowStatus.step4_primary_ip.status === 'success') {
        statusMessages.push(`✓ Primary IPv4 address assigned successfully`)
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

      // Only reset device-specific fields if completely successful
      // Preserve common fields (role, status, location, device type) for adding similar devices
      if (result.success && !hasErrors && !hasWarnings) {
        setTimeout(() => {
          setDeviceName('')
          setInterfaces([{
            id: '1',
            name: '',
            type: '',
            status: nautobotDefaults?.interface_status || '',
            ip_address: '',
            namespace: nautobotDefaults?.namespace || ''
          }])
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
  }, [validateForm, deviceName, selectedRole, selectedStatus, selectedLocation, selectedDeviceType, interfaces, selectedSoftwareVersion, softwareVersions, selectedTags, customFieldValues, nautobotDefaults])

  const handleClearForm = useCallback(() => {
    setDeviceName('')
    setSelectedRole('')
    setSelectedStatus('')
    setSelectedLocation('')
    setSelectedDeviceType('')
    setSelectedSoftwareVersion('')
    setSelectedTags([])
    setCustomFieldValues({})
    setInterfaces([{
      id: '1',
      name: '',
      type: '',
      status: nautobotDefaults?.interface_status || '',
      ip_address: '',
      namespace: nautobotDefaults?.namespace || ''
    }])
    setStatusMessage(null)
  }, [nautobotDefaults])

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add Device to Nautobot</h1>
            <p className="text-muted-foreground">Add a new network device or bare metal server</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBulkUpdateModal(true)}
            disabled={isLoading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Update
          </Button>
          <Button
            variant="outline"
            onClick={() => csvUpload.setShowModal(true)}
            disabled={isLoading}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import from CSV
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
      <div className="rounded-xl border shadow-sm">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Information</h3>
                <p className="text-blue-100 text-xs">Enter the basic information for the device. All fields are required.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleOpenTagsModal}
                disabled={isLoading}
                size="sm"
                variant="outline"
                className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200"
              >
                <Tags className="h-4 w-4 mr-1" />
                Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
              </Button>
              <Button
                onClick={handleOpenCustomFieldsModal}
                disabled={isLoading}
                size="sm"
                variant="outline"
                className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200"
              >
                <FileText className="h-4 w-4 mr-1" />
                Custom Fields
              </Button>
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
                    className="absolute z-[100] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
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
            <div className="space-y-1">
              <Label htmlFor="device-type" className="text-xs font-medium">
                Device Type <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={deviceTypeContainerRef}>
                <Input
                  id="device-type"
                  placeholder="Search for device type..."
                  value={deviceTypeSearch || (selectedDeviceType ? deviceTypes.find(dt => dt.id === selectedDeviceType)?.display || '' : '')}
                  onChange={(e) => {
                    const q = e.target.value
                    setDeviceTypeSearch(q)
                    setShowDeviceTypeDropdown(true)
                  }}
                  onFocus={() => setShowDeviceTypeDropdown(true)}
                  disabled={isLoading}
                />
                {showDeviceTypeDropdown && deviceTypeFiltered.length > 0 && (
                  <div
                    className="absolute z-[100] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {deviceTypeFiltered.map(dt => (
                      <div
                        key={dt.id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          setSelectedDeviceType(dt.id)
                          setDeviceTypeSearch(dt.display || dt.model)
                          setShowDeviceTypeDropdown(false)
                        }}
                      >
                        {dt.display || dt.model}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Software Version */}
            <div className="space-y-1">
              <Label htmlFor="software-version" className="text-xs font-medium">
                Software Version
              </Label>
              <div className="relative" ref={softwareVersionContainerRef}>
                <Input
                  id="software-version"
                  placeholder="Search for software version..."
                  value={softwareVersionSearch || (selectedSoftwareVersion ? (() => {
                    const sv = softwareVersions.find(s => s.id === selectedSoftwareVersion)
                    return sv ? `${sv.platform?.name || ''} ${sv.version}`.trim() : ''
                  })() : '')}
                  onChange={(e) => {
                    const q = e.target.value
                    setSoftwareVersionSearch(q)
                    setShowSoftwareVersionDropdown(true)
                  }}
                  onFocus={() => setShowSoftwareVersionDropdown(true)}
                  disabled={isLoading}
                />
                {showSoftwareVersionDropdown && softwareVersionFiltered.length > 0 && (
                  <div
                    className="absolute z-[100] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {softwareVersionFiltered.map(sv => (
                      <div
                        key={sv.id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          setSelectedSoftwareVersion(sv.id)
                          setSoftwareVersionSearch(`${sv.platform?.name || ''} ${sv.version}`.trim())
                          setShowSoftwareVersionDropdown(false)
                        }}
                      >
                        {`${sv.platform?.name || ''} ${sv.version}`.trim()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Interfaces Card */}
      <div className="rounded-xl border shadow-sm">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Network Interfaces</h3>
                <p className="text-blue-100 text-xs">Add one or more network interfaces. IP address is optional for layer 2 interfaces.</p>
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
                  <div className="relative">
                    <Input
                      id={`interface-type-${iface.id}`}
                      placeholder="Search type..."
                      value={interfaceTypeSearch[iface.id] ?? (iface.type ? interfaceTypes.find(t => t.id === iface.type)?.name || '' : '')}
                      onChange={(e) => {
                        setInterfaceTypeSearch(prev => ({ ...prev, [iface.id]: e.target.value }))
                        setShowInterfaceTypeDropdown(prev => ({ ...prev, [iface.id]: true }))
                      }}
                      onFocus={() => setShowInterfaceTypeDropdown(prev => ({ ...prev, [iface.id]: true }))}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowInterfaceTypeDropdown(prev => ({ ...prev, [iface.id]: false })), 200)
                      }}
                      disabled={isLoading}
                    />
                    {showInterfaceTypeDropdown[iface.id] && (
                      <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {interfaceTypes
                          .filter(type => {
                            const search = interfaceTypeSearch[iface.id]?.toLowerCase() || ''
                            return !search || type.name.toLowerCase().includes(search) || type.id.toLowerCase().includes(search)
                          })
                          .map(type => (
                            <div
                              key={type.id}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                              onMouseDown={() => {
                                handleUpdateInterface(iface.id, 'type', type.id)
                                setInterfaceTypeSearch(prev => ({ ...prev, [iface.id]: type.name }))
                                setShowInterfaceTypeDropdown(prev => ({ ...prev, [iface.id]: false }))
                              }}
                            >
                              {type.name}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
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
                    IP Address
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
                    Namespace
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

      {/* Submit Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleClearForm}
          disabled={isLoading}
          variant="outline"
          size="lg"
          className="min-w-[150px]"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Form
        </Button>
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
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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
              {/* Basic Settings Section */}
              <div className="rounded-lg border bg-green-50 p-4">
                <h4 className="text-sm font-semibold text-green-700 mb-3">Basic Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`enabled-${currentInterface.id}`}
                        checked={currentInterface.enabled ?? true}
                        onCheckedChange={(checked) =>
                          handleUpdateInterface(currentInterface.id, 'enabled', checked === true)
                        }
                        disabled={isLoading}
                      />
                      <Label htmlFor={`enabled-${currentInterface.id}`} className="cursor-pointer text-sm">
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
                      <Label htmlFor={`mgmt-only-${currentInterface.id}`} className="cursor-pointer text-sm">
                        Management Only
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`mac-address-${currentInterface.id}`} className="text-xs">MAC Address</Label>
                      <Input
                        id={`mac-address-${currentInterface.id}`}
                        placeholder="00:1A:2B:3C:4D:5E"
                        value={currentInterface.mac_address ?? ''}
                        onChange={(e) =>
                          handleUpdateInterface(currentInterface.id, 'mac_address', e.target.value)
                        }
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`mtu-${currentInterface.id}`} className="text-xs">MTU</Label>
                      <Input
                        id={`mtu-${currentInterface.id}`}
                        type="number"
                        placeholder="1500"
                        value={currentInterface.mtu ?? ''}
                        onChange={(e) =>
                          handleUpdateInterface(
                            currentInterface.id,
                            'mtu',
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`description-${currentInterface.id}`} className="text-xs">Description</Label>
                      <Input
                        id={`description-${currentInterface.id}`}
                        placeholder="Interface description"
                        value={currentInterface.description ?? ''}
                        onChange={(e) =>
                          handleUpdateInterface(currentInterface.id, 'description', e.target.value)
                        }
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* VLAN Configuration Section */}
              <div className="rounded-lg border bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-700 mb-3">VLAN Configuration</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`mode-${currentInterface.id}`} className="text-xs">Mode</Label>
                      <Select
                        value={currentInterface.mode ?? ''}
                        onValueChange={(value) =>
                          handleUpdateInterface(currentInterface.id, 'mode', value)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger id={`mode-${currentInterface.id}`} className="h-8 text-sm">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="access">Access</SelectItem>
                          <SelectItem value="tagged">Tagged</SelectItem>
                          <SelectItem value="tagged-all">Tagged All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`untagged-vlan-${currentInterface.id}`} className="text-xs">Untagged VLAN</Label>
                      <Select
                        value={currentInterface.untagged_vlan || 'none'}
                        onValueChange={(value) =>
                          handleUpdateInterface(currentInterface.id, 'untagged_vlan', value === 'none' ? '' : value)
                        }
                        disabled={isLoading || isLoadingVlans}
                      >
                        <SelectTrigger id={`untagged-vlan-${currentInterface.id}`} className="h-8 text-sm">
                          <SelectValue placeholder={isLoadingVlans ? "Loading..." : "Select VLAN"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vlans.map(vlan => (
                            <SelectItem key={vlan.id} value={vlan.id}>
                              {vlan.vid} - {vlan.name}{vlan.location ? ` (${vlan.location.name})` : ' (Global)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`tagged-vlans-${currentInterface.id}`} className="text-xs">Tagged VLANs</Label>
                      <Select
                        value={currentInterface.tagged_vlans?.[0] ?? ''}
                        onValueChange={(value) => {
                          const currentTagged = currentInterface.tagged_vlans || []
                          if (value && !currentTagged.includes(value)) {
                            handleUpdateInterface(
                              currentInterface.id,
                              'tagged_vlans',
                              [...currentTagged, value]
                            )
                          }
                        }}
                        disabled={isLoading || isLoadingVlans || currentInterface.mode !== 'tagged'}
                      >
                        <SelectTrigger id={`tagged-vlans-${currentInterface.id}`} className="h-8 text-sm">
                          <SelectValue placeholder={
                            currentInterface.mode !== 'tagged'
                              ? "Tagged mode only"
                              : isLoadingVlans
                                ? "Loading..."
                                : "Add VLAN"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {vlans
                            .filter(vlan => !currentInterface.tagged_vlans?.includes(vlan.id))
                            .map(vlan => (
                              <SelectItem key={vlan.id} value={vlan.id}>
                                {vlan.vid} - {vlan.name}{vlan.location ? ` (${vlan.location.name})` : ' (Global)'}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {currentInterface.tagged_vlans && currentInterface.tagged_vlans.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currentInterface.tagged_vlans.map(vlanId => {
                            const vlan = vlans.find(v => v.id === vlanId)
                            return (
                              <Badge
                                key={vlanId}
                                variant="secondary"
                                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                                onClick={() => {
                                  handleUpdateInterface(
                                    currentInterface.id,
                                    'tagged_vlans',
                                    currentInterface.tagged_vlans?.filter(id => id !== vlanId) || []
                                  )
                                }}
                              >
                                {vlan ? `${vlan.vid} - ${vlan.name}` : vlanId} ×
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Settings Section */}
              <div className="rounded-lg border bg-purple-50 p-4">
                <h4 className="text-sm font-semibold text-purple-700 mb-3">Advanced Settings</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`parent-interface-${currentInterface.id}`} className="text-xs">Parent Interface</Label>
                    <Input
                      id={`parent-interface-${currentInterface.id}`}
                      placeholder="UUID"
                      value={currentInterface.parent_interface ?? ''}
                      onChange={(e) =>
                        handleUpdateInterface(currentInterface.id, 'parent_interface', e.target.value)
                      }
                      disabled={isLoading}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`bridge-${currentInterface.id}`} className="text-xs">Bridge</Label>
                    <Input
                      id={`bridge-${currentInterface.id}`}
                      placeholder="UUID"
                      value={currentInterface.bridge ?? ''}
                      onChange={(e) =>
                        handleUpdateInterface(currentInterface.id, 'bridge', e.target.value)
                      }
                      disabled={isLoading}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`lag-${currentInterface.id}`} className="text-xs">LAG</Label>
                    <Select
                      value={currentInterface.lag || 'none'}
                      onValueChange={(value) =>
                        handleUpdateInterface(currentInterface.id, 'lag', value === 'none' ? '' : value)
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger id={`lag-${currentInterface.id}`} className="h-8 text-sm">
                        <SelectValue placeholder="Select LAG interface" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {interfaces
                          .filter(iface => iface.id !== currentInterface.id && iface.name && iface.type === 'lag')
                          .map(iface => (
                            <SelectItem key={iface.id} value={iface.id}>
                              {iface.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1 mt-3">
                  <Label htmlFor={`tags-${currentInterface.id}`} className="text-xs">Tags (comma-separated)</Label>
                  <Input
                    id={`tags-${currentInterface.id}`}
                    placeholder="production, critical, monitored"
                    value={currentInterface.tags?.join(',') ?? ''}
                    onChange={(e) =>
                      handleUpdateInterface(
                        currentInterface.id,
                        'tags',
                        e.target.value ? e.target.value.split(',').map(v => v.trim()).filter(Boolean) : []
                      )
                    }
                    disabled={isLoading}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCloseProperties}
                variant="outline"
                disabled={isLoading}
              >
                Save & Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CSV Upload Modal */}
      <CSVUploadModal
        showModal={csvUpload.showModal}
        onClose={csvUpload.closeModal}
        csvFile={csvUpload.csvFile}
        parseResult={csvUpload.parseResult}
        isParsing={csvUpload.isParsing}
        parseError={csvUpload.parseError}
        isImporting={csvUpload.isImporting}
        importProgress={csvUpload.importProgress}
        importSummary={csvUpload.importSummary}
        columnMappings={csvUpload.columnMappings}
        showMappingConfig={csvUpload.showMappingConfig}
        lookupData={{
          roles,
          locations,
          deviceTypes
        }}
        onFileSelect={csvUpload.parseCSV}
        onImport={csvUpload.importDevices}
        onUpdateMapping={csvUpload.updateMapping}
        onApplyMappings={csvUpload.applyMappings}
        onShowMappingConfig={csvUpload.setShowMappingConfig}
        onReset={csvUpload.reset}
      />

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        open={showBulkUpdateModal}
        onClose={() => setShowBulkUpdateModal(false)}
      />

      {/* Tags Modal */}
      <Dialog open={showTagsModal} onOpenChange={setShowTagsModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Device Tags
            </DialogTitle>
            <DialogDescription>
              Select tags to apply to this device.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingTags ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags available for devices.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableTags.map(tag => (
                  <label
                    key={tag.id}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedTags.includes(tag.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagsModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Fields Modal */}
      <Dialog open={showCustomFieldsModal} onOpenChange={setShowCustomFieldsModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Custom Fields
            </DialogTitle>
            <DialogDescription>
              Set custom field values for this device.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingCustomFields ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom fields available for devices.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium">Field Name</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customFields.map((field, index) => (
                      <tr key={field.id} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                        <td className="py-2 px-3 border-r">
                          <div>
                            <span className="text-sm font-medium">
                              {field.label}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </span>
                            {field.description && (
                              <p className="text-xs text-muted-foreground">{field.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {field.type?.value === 'select' && customFieldChoices[field.key] ? (
                            <Select
                              value={customFieldValues[field.key] || ''}
                              onValueChange={(value) => handleUpdateCustomField(field.key, value)}
                            >
                              <SelectTrigger className="h-9 bg-white border">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customFieldChoices[field.key]?.map((choice) => {
                                  // Handle both string and object choices
                                  const choiceValue = typeof choice === 'object' && choice !== null
                                    ? (choice as { value?: string; id?: string }).value || (choice as { value?: string; id?: string }).id || JSON.stringify(choice)
                                    : String(choice)
                                  return (
                                    <SelectItem key={`${field.key}-${choiceValue}`} value={choiceValue}>
                                      {choiceValue}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          ) : field.type?.value === 'boolean' ? (
                            <div className="flex items-center h-9">
                              <Checkbox
                                checked={customFieldValues[field.key] === 'true'}
                                onCheckedChange={(checked) =>
                                  handleUpdateCustomField(field.key, checked ? 'true' : 'false')
                                }
                              />
                            </div>
                          ) : field.type?.value === 'integer' ? (
                            <Input
                              type="number"
                              value={customFieldValues[field.key] || ''}
                              onChange={(e) => handleUpdateCustomField(field.key, e.target.value)}
                              className="h-9 bg-white border"
                            />
                          ) : (
                            <Input
                              value={customFieldValues[field.key] || ''}
                              onChange={(e) => handleUpdateCustomField(field.key, e.target.value)}
                              className="h-9 bg-white border"
                              placeholder="Enter value..."
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomFieldsModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
