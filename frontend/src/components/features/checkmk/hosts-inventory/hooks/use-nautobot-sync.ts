import { useState, useCallback, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { CheckMKHost, CheckMKConfig, NautobotMetadata, PropertyMapping } from '@/types/checkmk/types'
import { initializePropertyMappings, type InterfaceMappingData } from '@/lib/checkmk/property-mapping-utils'
import { formatDeviceSubmissionData } from '@/components/features/nautobot/add-device/utils'
import type { DeviceFormValues } from '@/components/shared/device-form'
import { parseInterfacesFromInventory, type CheckMKInterface } from '@/lib/checkmk/interface-mapping-utils'

/**
 * Convert netmask (e.g., "255.255.255.0") to CIDR notation (e.g., 24)
 */
function netmaskToCIDR(netmask: string): number {
  if (!netmask) return 0
  
  try {
    const octets = netmask.split('.').map(Number)
    if (octets.length !== 4) return 0
    
    let cidr = 0
    for (const octet of octets) {
      if (octet < 0 || octet > 255) return 0
      // Count the number of 1 bits in this octet
      cidr += octet.toString(2).split('1').length - 1
    }
    
    return cidr
  } catch {
    return 0
  }
}

interface UseNautobotSyncProps {
  checkmkConfig: CheckMKConfig | null
  onMessage: (text: string, type: 'success' | 'error' | 'info') => void
}

interface UseNautobotSyncReturn {
  isSyncModalOpen: boolean
  selectedHostForSync: CheckMKHost | null
  nautobotDevice: Record<string, unknown> | null
  checkingNautobot: boolean
  nautobotMetadata: NautobotMetadata | null
  propertyMappings: Record<string, PropertyMapping>
  loadingMetadata: boolean
  inventoryData: Record<string, unknown> | null
  loadingInventory: boolean
  ipAddressStatuses: Array<{ id: string; name: string }> | null
  ipAddressRoles: Array<{ id: string; name: string }> | null
  interfaceMappings: Record<string, InterfaceMappingData>
  handleSyncToNautobot: (host: CheckMKHost) => Promise<void>
  updatePropertyMapping: (checkMkKey: string, nautobotField: string) => void
  executeSyncToNautobot: (formData: DeviceFormValues, deviceId?: string) => Promise<void>
  closeSyncModal: () => void
  isSyncing: boolean
  showErrorModal: boolean
  errorModalMessage: string
  closeErrorModal: () => void
}

const EMPTY_MAPPINGS: Record<string, PropertyMapping> = {}

export function useNautobotSync({ 
  checkmkConfig, 
  onMessage 
}: UseNautobotSyncProps): UseNautobotSyncReturn {
  const { apiCall } = useApi()
  
  // Modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [selectedHostForSync, setSelectedHostForSync] = useState<CheckMKHost | null>(null)
  const [nautobotDevice, setNautobotDevice] = useState<Record<string, unknown> | null>(null)
  const [checkingNautobot, setCheckingNautobot] = useState(false)
  
  // Nautobot data
  const [nautobotMetadata, setNautobotMetadata] = useState<NautobotMetadata | null>(null)
  const [propertyMappings, setPropertyMappings] = useState<Record<string, PropertyMapping>>(EMPTY_MAPPINGS)
  const [loadingMetadata, setLoadingMetadata] = useState(false)

  // Inventory data
  const [inventoryData, setInventoryData] = useState<Record<string, unknown> | null>(null)
  const [loadingInventory, setLoadingInventory] = useState(false)

  // IP address statuses
  const [ipAddressStatuses, setIpAddressStatuses] = useState<Array<{ id: string; name: string }> | null>(null)

  // IP address roles
  const [ipAddressRoles, setIpAddressRoles] = useState<Array<{ id: string; name: string }> | null>(null)

  // Interface mappings

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false)
  const [interfaceMappings, setInterfaceMappings] = useState<Record<string, InterfaceMappingData>>({})

  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState<string>('')

  /**
   * Load CheckMK inventory data for interface mapping
   */
  const loadInventoryData = useCallback(async (hostName: string) => {
    try {
      setLoadingInventory(true)
      const response = await apiCall<{ success: boolean; message: string; data: Record<string, unknown> }>(
        `checkmk/inventory/${hostName}`
      )
      const inventoryData = response?.data || null
      setInventoryData(inventoryData)
      
      // Parse interfaces from inventory and create interface mappings
      if (inventoryData) {
        const interfaces = parseInterfacesFromInventory(inventoryData)
        const mappings: Record<string, InterfaceMappingData> = {}
        let mappingCounter = 0
        
        interfaces.forEach((iface: CheckMKInterface) => {
          // Create a mapping for EACH IP address on the interface
          if (iface.ipAddresses.length > 0) {
            iface.ipAddresses.forEach((ipAddr, ipIndex) => {
              // Use CIDR if available, otherwise convert netmask to CIDR
              const cidr = ipAddr.cidr || netmaskToCIDR(ipAddr.netmask)
              const ipAddress = `${ipAddr.address}/${cidr}`
              
              mappings[`interface_${mappingCounter++}`] = {
                enabled: iface.oper_status === 1, // Enable only if interface is operationally up
                ipRole: ipIndex === 0 ? 'primary' : 'secondary', // First IP on interface is primary, others are secondary
                status: 'Active',
                ipAddress,
                interfaceName: iface.name,
                isPrimary: ipIndex === 0, // First IP on each interface is primary
              }
            })
          }
        })
        
        setInterfaceMappings(mappings)
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setInventoryData(null)
      setInterfaceMappings({})
    } finally {
      setLoadingInventory(false)
    }
  }, [apiCall])

  /**
   * Load Nautobot metadata for sync mapping
   */
  const loadNautobotMetadata = useCallback(async () => {
    try {
      setLoadingMetadata(true)

      const [locations, roles, statuses, deviceTypes, platforms, customFields, ipStatuses, ipRoles] = await Promise.all([
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/locations'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/roles/devices'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/statuses/device'),
        apiCall<Array<{ id: string; display: string; model: string }>>('nautobot/device-types'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/platforms'),
        apiCall<{ results: Array<{ id: string; name: string; key: string }> }>('nautobot/custom-fields/devices'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/statuses/ipaddress'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/roles/ipaddress'),
      ])
      
      // Handle different response formats: some endpoints return { results: [...] }, others return array directly
      const extractResults = <T,>(response: { results?: T[] } | T[] | undefined): T[] => {
        if (!response) return []
        if (Array.isArray(response)) return response
        return response.results || []
      }
      
      // Map device types to use 'display' field as 'name'
      const mappedDeviceTypes = extractResults(deviceTypes).map((dt: { id: string; display?: string; model?: string; name?: string }) => ({
        id: dt.id,
        name: dt.display || dt.model || dt.name || 'Unknown'
      }))
      
      setNautobotMetadata({
        locations: extractResults(locations),
        roles: extractResults(roles),
        statuses: extractResults(statuses),
        deviceTypes: mappedDeviceTypes,
        platforms: extractResults(platforms),
        customFields: extractResults(customFields),
      })

      // Set IP address statuses and roles separately
      setIpAddressStatuses(extractResults(ipStatuses))
      setIpAddressRoles(extractResults(ipRoles))
    } catch (err) {
      console.error('Failed to load Nautobot metadata:', err)
      onMessage('Failed to load Nautobot metadata', 'error')
    } finally {
      setLoadingMetadata(false)
    }
  }, [apiCall, onMessage])

  /**
   * Initialize property mappings from CheckMK host
   */
  const initializeMappings = useCallback((host: CheckMKHost) => {
    const mappings = initializePropertyMappings(host, checkmkConfig, nautobotMetadata)
    setPropertyMappings(mappings)
  }, [checkmkConfig, nautobotMetadata])

  /**
   * Handle sync to Nautobot - prepares the sync modal
   */
  const handleSyncToNautobot = useCallback(async (host: CheckMKHost) => {
    try {
      setSelectedHostForSync(host)
      setCheckingNautobot(true)
      setIsSyncModalOpen(true)
      setNautobotDevice(null)
      
      // Search for device in Nautobot by name (use reload=true to bypass cache)
      onMessage(`Searching for ${host.host_name} in Nautobot...`, 'info')
      
      try {
        const searchResult = await apiCall<{ devices: unknown[] }>(
          `nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(host.host_name)}&reload=true`
        )

        console.log('[useNautobotSync] Search result for', host.host_name, ':', searchResult)

        if (searchResult?.devices && searchResult.devices.length > 0) {
          const deviceBasic = searchResult.devices[0] as Record<string, unknown>

          // Get detailed device information
          const deviceId = deviceBasic.id as string
          console.log('[useNautobotSync] Found device with ID:', deviceId)
          const deviceDetails = await apiCall<Record<string, unknown>>(`nautobot/devices/${deviceId}`)

          setNautobotDevice(deviceDetails || null)
          onMessage(`Device found in Nautobot`, 'success')
        } else {
          console.log('[useNautobotSync] Device not found in Nautobot')
          setNautobotDevice(null)
          onMessage(`Device not found in Nautobot - will create new`, 'info')
        }
      } catch (err) {
        console.error('Error searching Nautobot:', err)
        setNautobotDevice(null)
      }
      
      setCheckingNautobot(false)

      // Load Nautobot metadata (locations, roles, etc.) and inventory data in parallel
      await Promise.all([
        loadNautobotMetadata(),
        loadInventoryData(host.host_name)
      ])

      // Initialize property mappings
      initializeMappings(host)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare sync'
      onMessage(`Failed to prepare sync for ${host.host_name}: ${message}`, 'error')
      setCheckingNautobot(false)
      setIsSyncModalOpen(false)
    }
  }, [apiCall, onMessage, loadNautobotMetadata, loadInventoryData, initializeMappings])

  /**
   * Update a single property mapping
   */
  const updatePropertyMapping = useCallback((checkMkKey: string, nautobotField: string) => {
    setPropertyMappings(prev => {
      const existing = prev[checkMkKey]
      if (!existing) return prev
      
      return {
        ...prev,
        [checkMkKey]: {
          nautobotField,
          value: existing.value,
          isCore: existing.isCore
        }
      }
    })
  }, [])

  /**
   * Execute sync to Nautobot
   * Now accepts form data directly from the shared form
   */
  const executeSyncToNautobot = useCallback(async (formData: DeviceFormValues, deviceId?: string) => {
    if (!selectedHostForSync) return
    
    try {
      setIsSyncing(true)
      onMessage(`Syncing ${selectedHostForSync.host_name} to Nautobot...`, 'info')
      
      // Format form data for submission (same as add-device)
      const submissionData = formatDeviceSubmissionData(formData)
      
      // Check if device exists (use provided deviceId or nautobotDevice)
      const existingDeviceId = deviceId || (nautobotDevice?.id as string | undefined)
      
      if (existingDeviceId) {
        // Device exists - use PATCH to update
        onMessage(`Updating existing device in Nautobot...`, 'info')
        
        await apiCall(`nautobot/devices/${existingDeviceId}`, {
          method: 'PATCH',
          body: JSON.stringify(submissionData)
        })
        
        onMessage(`Successfully updated ${selectedHostForSync.host_name} in Nautobot`, 'success')
      } else {
        // Device doesn't exist - use POST to create
        onMessage(`Creating new device in Nautobot...`, 'info')
        
        const createResponse = await apiCall<{ id?: string }>('nautobot/add-device', {
          method: 'POST',
          body: JSON.stringify(submissionData)
        })
        
        onMessage(`Successfully created ${selectedHostForSync.host_name} in Nautobot`, 'success')
        
        // After creating, refresh the device info to get the device ID
        if (createResponse?.id) {
          try {
            const deviceDetails = await apiCall<Record<string, unknown>>(`nautobot/devices/${createResponse.id}`)
            setNautobotDevice(deviceDetails || null)
          } catch (err) {
            console.error('Failed to fetch created device details:', err)
          }
        } else {
          // Fallback: search for the device by name
          try {
            const searchResult = await apiCall<{ devices: unknown[] }>(
              `nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(selectedHostForSync.host_name)}`
            )
            if (searchResult?.devices && searchResult.devices.length > 0) {
              const deviceBasic = searchResult.devices[0] as Record<string, unknown>
              const deviceId = deviceBasic.id as string
              const deviceDetails = await apiCall<Record<string, unknown>>(`nautobot/devices/${deviceId}`)
              setNautobotDevice(deviceDetails || null)
            }
          } catch (err) {
            console.error('Failed to refresh device info after creation:', err)
          }
        }
      }
      
      setIsSyncModalOpen(false)
      
    } catch (err) {
      // Extract detailed error message from API response
      let message = 'Failed to sync to Nautobot'
      
      if (err instanceof Error) {
        message = err.message
        
        // Try to parse JSON error response for more details
        try {
          // Check if message contains JSON (using [\s\S] instead of . with s flag for compatibility)
          const jsonMatch = message.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0])
            if (errorData.detail) {
              message = errorData.detail
            } else if (errorData.message) {
              message = errorData.message
            }
          }
        } catch {
          // If parsing fails, use the original message
        }
      }
      
      console.error('Sync error:', err)
      setErrorModalMessage(message)
      setShowErrorModal(true)
      setIsSyncModalOpen(false) // Close sync modal so error modal is visible
    } finally {
      setIsSyncing(false)
    }
  }, [selectedHostForSync, nautobotDevice, apiCall, onMessage])

  /**
   * Close sync modal
   */
  const closeSyncModal = useCallback(() => {
    setIsSyncModalOpen(false)
    setSelectedHostForSync(null)
    setNautobotDevice(null)
    setPropertyMappings(EMPTY_MAPPINGS)
    setInventoryData(null)
    setIpAddressStatuses(null)
    setIpAddressRoles(null)
    setInterfaceMappings({})
  }, [])

  /**
   * Close error modal
   */
  const closeErrorModal = useCallback(() => {
    setShowErrorModal(false)
    setErrorModalMessage('')
  }, [])

  // Re-initialize mappings when checkmkConfig or nautobotMetadata changes
  useEffect(() => {
    if (selectedHostForSync && isSyncModalOpen && (checkmkConfig || nautobotMetadata)) {
      initializeMappings(selectedHostForSync)
    }
  }, [checkmkConfig, nautobotMetadata, selectedHostForSync, isSyncModalOpen, initializeMappings])

  return useMemo(() => ({
    isSyncModalOpen,
    selectedHostForSync,
    nautobotDevice,
    checkingNautobot,
    nautobotMetadata,
    propertyMappings,
    loadingMetadata,
    inventoryData,
    loadingInventory,
    ipAddressStatuses,
    ipAddressRoles,
    interfaceMappings,
    handleSyncToNautobot,
    updatePropertyMapping,
    executeSyncToNautobot,
    closeSyncModal,
    isSyncing,
    showErrorModal,
    errorModalMessage,
    closeErrorModal,
  }), [
    isSyncModalOpen,
    selectedHostForSync,
    nautobotDevice,
    checkingNautobot,
    nautobotMetadata,
    propertyMappings,
    loadingMetadata,
    inventoryData,
    loadingInventory,
    ipAddressStatuses,
    ipAddressRoles,
    interfaceMappings,
    handleSyncToNautobot,
    updatePropertyMapping,
    executeSyncToNautobot,
    closeSyncModal,
    isSyncing,
    showErrorModal,
    errorModalMessage,
    closeErrorModal,
  ])
}