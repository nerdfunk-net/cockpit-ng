import { useState, useCallback, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { CheckMKHost, CheckMKConfig, NautobotMetadata, PropertyMapping } from '@/types/checkmk/types'
import { initializePropertyMappings, buildDevicePayload } from '@/lib/checkmk/property-mapping-utils'

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
  handleSyncToNautobot: (host: CheckMKHost) => Promise<void>
  updatePropertyMapping: (checkMkKey: string, nautobotField: string) => void
  updatePropertyMappings: (mappings: Record<string, PropertyMapping>) => void
  executeSyncToNautobot: () => Promise<void>
  closeSyncModal: () => void
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

  /**
   * Load CheckMK inventory data for interface mapping
   */
  const loadInventoryData = useCallback(async (hostName: string) => {
    try {
      setLoadingInventory(true)
      const response = await apiCall<{ success: boolean; message: string; data: Record<string, unknown> }>(
        `checkmk/inventory/${hostName}`
      )
      setInventoryData(response?.data || null)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setInventoryData(null)
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

      const [locations, roles, statuses, deviceTypes, platforms, customFields, ipStatuses] = await Promise.all([
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/locations'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/roles/devices'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/statuses/device'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/device-types'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/platforms'),
        apiCall<{ results: Array<{ id: string; name: string; key: string }> }>('nautobot/custom-fields/devices'),
        apiCall<{ results: Array<{ id: string; name: string }> }>('nautobot/statuses/ipaddress'),
      ])
      
      // Handle different response formats: some endpoints return { results: [...] }, others return array directly
      const extractResults = <T,>(response: { results?: T[] } | T[] | undefined): T[] => {
        if (!response) return []
        if (Array.isArray(response)) return response
        return response.results || []
      }
      
      setNautobotMetadata({
        locations: extractResults(locations),
        roles: extractResults(roles),
        statuses: extractResults(statuses),
        deviceTypes: extractResults(deviceTypes),
        platforms: extractResults(platforms),
        customFields: extractResults(customFields),
      })

      // Set IP address statuses separately
      setIpAddressStatuses(extractResults(ipStatuses))
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
      
      // Search for device in Nautobot by name
      onMessage(`Searching for ${host.host_name} in Nautobot...`, 'info')
      
      try {
        const searchResult = await apiCall<{ devices: unknown[] }>(
          `nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(host.host_name)}`
        )

        if (searchResult?.devices && searchResult.devices.length > 0) {
          const deviceBasic = searchResult.devices[0] as Record<string, unknown>

          // Get detailed device information
          const deviceId = deviceBasic.id as string
          const deviceDetails = await apiCall<Record<string, unknown>>(`nautobot/devices/${deviceId}`)

          setNautobotDevice(deviceDetails || null)
          onMessage(`Device found in Nautobot`, 'success')
        } else {
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
   * Update all property mappings at once (used by modal for role selection)
   */
  const updatePropertyMappings = useCallback((mappings: Record<string, PropertyMapping>) => {
    setPropertyMappings(mappings)
  }, [])

  /**
   * Execute sync to Nautobot
   */
  const executeSyncToNautobot = useCallback(async () => {
    if (!selectedHostForSync) return
    
    try {
      onMessage(`Syncing ${selectedHostForSync.host_name} to Nautobot...`, 'info')
      
      // Build the device payload from mappings using utility function
      const { devicePayload } = buildDevicePayload(propertyMappings, nautobotMetadata)
      
      // Validate required fields
      if (!devicePayload.name) {
        throw new Error('Device name is required')
      }
      if (!devicePayload.role) {
        throw new Error('Device role is required')
      }
      if (!devicePayload.status) {
        throw new Error('Device status is required')
      }
      if (!devicePayload.location) {
        throw new Error('Device location is required')
      }
      if (!devicePayload.device_type) {
        throw new Error('Device type is required')
      }
      
      // Call the add-device endpoint
      await apiCall('nautobot/add-device', {
        method: 'POST',
        body: JSON.stringify(devicePayload)
      })
      
      onMessage(`Successfully synced ${selectedHostForSync.host_name} to Nautobot`, 'success')
      setIsSyncModalOpen(false)
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync to Nautobot'
      onMessage(`Failed to sync ${selectedHostForSync.host_name}: ${message}`, 'error')
    }
  }, [selectedHostForSync, propertyMappings, nautobotMetadata, apiCall, onMessage])

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
    handleSyncToNautobot,
    updatePropertyMapping,
    updatePropertyMappings,
    executeSyncToNautobot,
    closeSyncModal
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
    handleSyncToNautobot,
    updatePropertyMapping,
    updatePropertyMappings,
    executeSyncToNautobot,
    closeSyncModal
  ])
}
