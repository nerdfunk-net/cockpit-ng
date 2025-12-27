/**
 * Refactored Nautobot Sync Devices Page
 *
 * This version uses the shared DeviceSelector component for device filtering/selection,
 * significantly reducing code duplication while maintaining all sync functionality.
 *
 * Changes from original:
 * - Replaced custom device list/filtering (400+ lines) with DeviceSelector component
 * - Kept all sync configuration and execution logic
 * - Maintained URL parameter support (ip_filter)
 * - Preserved all existing functionality
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, CheckCircle, AlertCircle, Info, Settings } from 'lucide-react'

// Import shared DeviceSelector
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from '@/components/shared/device-selector'

// Type definitions
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

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

// Constants
const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICE_IDS: string[] = []

const SYNC_OPTIONS = [
  { id: 'enable_sync', label: 'Enable Sync', description: 'Enable automatic synchronization' },
  { id: 'update_interfaces', label: 'Update Interfaces', description: 'Synchronize interface configurations' },
  { id: 'update_ip_addresses', label: 'Update IP Addresses', description: 'Synchronize IP address assignments' },
]

export function SyncDevicesPage() {
  // Auth and API
  const { isAuthenticated, logout } = useAuthStore()
  const { apiCall } = useApi()
  const searchParams = useSearchParams()

  // Device selection state (from DeviceSelector)
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>(EMPTY_CONDITIONS)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(EMPTY_DEVICE_IDS)
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)

  // Sync state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Sync properties state
  const [syncProperties, setSyncProperties] = useState<SyncProperties>({
    prefix_status: '',
    interface_status: '',
    ip_address_status: '',
    namespace: '',
    sync_options: []
  })

  // Nautobot defaults
  const [nautobotDefaults, setNautobotDefaults] = useState<{
    namespace: string
    interface_status: string
    ip_address_status: string
    ip_prefix_status: string
  } | null>(null)

  // Dropdown options for sync properties
  const [dropdownOptions, setDropdownOptions] = useState({
    namespaces: [] as DropdownOption[],
    prefixStatuses: [] as DropdownOption[],
    interfaceStatuses: [] as DropdownOption[],
    ipAddressStatuses: [] as DropdownOption[],
  })

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, logout])

  // Load initial data (defaults and dropdown options)
  useEffect(() => {
    loadInitialData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Handle URL parameters (ip_filter)
  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter) {
      // Create a condition for the IP filter
      const ipCondition: LogicalCondition = {
        field: 'primary_ip4',
        operator: 'contains',
        value: ipFilter,
        logic: 'AND'
      }
      setDeviceConditions([ipCondition])
    }
  }, [searchParams])

  const loadInitialData = async () => {
    try {
      // Load Nautobot defaults
      await loadNautobotDefaults()
      // Load dropdown options
      await loadDropdownOptions()
    } catch (error) {
      console.error('Error loading initial data:', error)
      setStatusMessage({
        type: 'error',
        message: 'Failed to load sync configuration options'
      })
    }
  }

  const loadNautobotDefaults = async () => {
    try {
      const response = await apiCall<{
        success: boolean
        data?: {
          namespace: string
          interface_status: string
          ip_address_status: string
          ip_prefix_status: string
        }
      }>('settings/nautobot/defaults')

      if (response?.success && response.data) {
        setNautobotDefaults(response.data)
        // Set defaults in sync properties
        setSyncProperties(prev => ({
          ...prev,
          namespace: response.data!.namespace || '',
          interface_status: response.data!.interface_status || '',
          ip_address_status: response.data!.ip_address_status || '',
          prefix_status: response.data!.ip_prefix_status || ''
        }))
      }
    } catch (error) {
      console.error('Error loading Nautobot defaults:', error)
    }
  }

  const loadDropdownOptions = async () => {
    try {
      // Load namespaces
      const namespacesResponse = await apiCall<{ namespaces: DropdownOption[] }>('nautobot/namespaces')

      // Load statuses
      const statusesResponse = await apiCall<{ statuses: DropdownOption[] }>('nautobot/statuses')

      setDropdownOptions({
        namespaces: namespacesResponse?.namespaces || [],
        prefixStatuses: statusesResponse?.statuses || [],
        interfaceStatuses: statusesResponse?.statuses || [],
        ipAddressStatuses: statusesResponse?.statuses || [],
      })
    } catch (error) {
      console.error('Error loading dropdown options:', error)
    }
  }

  // DeviceSelector callbacks
  const handleDevicesSelected = useCallback((devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
  }, [])

  const handleSelectionChange = useCallback((selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }, [])

  // Sync properties handlers
  const handleSyncPropertyChange = (field: keyof SyncProperties, value: string) => {
    setSyncProperties(prev => ({
      ...prev,
      [field]: value
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

  const isFormValid = useMemo(() => {
    return (
      syncProperties.prefix_status &&
      syncProperties.interface_status &&
      syncProperties.ip_address_status &&
      syncProperties.namespace &&
      selectedDevices.length > 0
    )
  }, [syncProperties, selectedDevices])

  const handleSyncDevices = async () => {
    if (!isFormValid) {
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
          devices: selectedDeviceIds,
          default_prefix_status: syncProperties.prefix_status,
          interface_status: syncProperties.interface_status,
          ip_address_status: syncProperties.ip_address_status,
          namespace: syncProperties.namespace,
          sync_options: syncProperties.sync_options
        }
      }

      const response = await apiCall<{ success: boolean; message?: string }>(
        'nautobot/sync-network-data',
        {
          method: 'POST',
          body: syncData
        }
      )

      if (response?.success) {
        setStatusMessage({
          type: 'success',
          message: `Successfully synchronized ${selectedDevices.length} device(s)`
        })
        // Clear selection after successful sync
        setSelectedDeviceIds(EMPTY_DEVICE_IDS)
        setSelectedDevices(EMPTY_DEVICES)
      } else {
        setStatusMessage({
          type: 'error',
          message: response?.message || 'Failed to sync devices'
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to sync devices'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetToDefaults = () => {
    if (nautobotDefaults) {
      setSyncProperties(prev => ({
        ...prev,
        namespace: nautobotDefaults.namespace || '',
        interface_status: nautobotDefaults.interface_status || '',
        ip_address_status: nautobotDefaults.ip_address_status || '',
        prefix_status: nautobotDefaults.ip_prefix_status || ''
      }))
      setStatusMessage({
        type: 'info',
        message: 'Reset to default Nautobot settings'
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <RefreshCw className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sync Devices to Nautobot</h1>
            <p className="text-gray-600 mt-1">
              Select devices and configure synchronization settings
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <Alert className={
          statusMessage.type === 'success' ? 'bg-green-50 border-green-200' :
          statusMessage.type === 'error' ? 'bg-red-50 border-red-200' :
          statusMessage.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-blue-50 border-blue-200'
        }>
          {statusMessage.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
          {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
          {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
          <AlertDescription className={
            statusMessage.type === 'success' ? 'text-green-800' :
            statusMessage.type === 'error' ? 'text-red-800' :
            statusMessage.type === 'warning' ? 'text-yellow-800' :
            'text-blue-800'
          }>
            {statusMessage.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Device Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle>Select Devices</CardTitle>
          <CardDescription>
            Use logical operations to filter and select devices for synchronization
          </CardDescription>
        </CardHeader>
      </Card>

      <DeviceSelector
        onDevicesSelected={handleDevicesSelected}
        showActions={true}
        showSaveLoad={true}
        initialConditions={deviceConditions}
        initialDevices={previewDevices}
        enableSelection={true}
        selectedDeviceIds={selectedDeviceIds}
        onSelectionChange={handleSelectionChange}
      />

      {selectedDevices.length > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected for synchronization.
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sync Configuration
              </CardTitle>
              <CardDescription>
                Configure synchronization properties for selected devices
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              disabled={!nautobotDefaults}
            >
              Reset to Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Namespace */}
          <div className="space-y-2">
            <Label htmlFor="namespace">
              Namespace <span className="text-red-500">*</span>
            </Label>
            <Select
              value={syncProperties.namespace}
              onValueChange={(value) => handleSyncPropertyChange('namespace', value)}
            >
              <SelectTrigger id="namespace">
                <SelectValue placeholder="Select namespace" />
              </SelectTrigger>
              <SelectContent>
                {dropdownOptions.namespaces.map(ns => (
                  <SelectItem key={ns.id} value={ns.id}>
                    {ns.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prefix Status */}
          <div className="space-y-2">
            <Label htmlFor="prefix_status">
              Prefix Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={syncProperties.prefix_status}
              onValueChange={(value) => handleSyncPropertyChange('prefix_status', value)}
            >
              <SelectTrigger id="prefix_status">
                <SelectValue placeholder="Select prefix status" />
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
          <div className="space-y-2">
            <Label htmlFor="interface_status">
              Interface Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={syncProperties.interface_status}
              onValueChange={(value) => handleSyncPropertyChange('interface_status', value)}
            >
              <SelectTrigger id="interface_status">
                <SelectValue placeholder="Select interface status" />
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
          <div className="space-y-2">
            <Label htmlFor="ip_address_status">
              IP Address Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={syncProperties.ip_address_status}
              onValueChange={(value) => handleSyncPropertyChange('ip_address_status', value)}
            >
              <SelectTrigger id="ip_address_status">
                <SelectValue placeholder="Select IP address status" />
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
              {SYNC_OPTIONS.map(option => (
                <div key={option.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={syncProperties.sync_options.includes(option.id)}
                    onCheckedChange={(checked) =>
                      handleSyncOptionChange(option.id, checked as boolean)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={option.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Button */}
          <div className="pt-4">
            <Button
              onClick={handleSyncDevices}
              disabled={!isFormValid || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync {selectedDevices.length} Device{selectedDevices.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
