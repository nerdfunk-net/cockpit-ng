'use client'

import { useState, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { convertModifiedDevicesToJSON, validateModifiedDevices } from './utils/json-converter'

// Tab Components
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { PropertiesTab } from './tabs/properties-tab'
import { BulkEditTab } from './tabs/bulk-edit-tab'

// Dialog Components
import { PreviewChangesDialog } from './dialogs/preview-changes-dialog'
import { ProgressDialog } from './dialogs/progress-dialog'
import { BulkUpdateModal } from './dialogs/csv-upload-dialog'

// Types
export interface InterfaceConfig {
  name: string
  type: string
  status: string
  createOnIpChange: boolean
}

export interface IPConfig {
  addPrefixesAutomatically: boolean
  useAssignedIpIfExists: boolean
  defaultNetworkMask: string
  namespace: string
}

export interface BulkEditProperties {
  interfaceConfig: InterfaceConfig
  ipConfig: IPConfig
}

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICE_IDS: string[] = []
const EMPTY_MAP: Map<string, Partial<DeviceInfo>> = new Map()

const DEFAULT_INTERFACE_CONFIG: InterfaceConfig = {
  name: '',
  type: '1000base-t',
  status: 'active',
  createOnIpChange: false,
}

const DEFAULT_IP_CONFIG: IPConfig = {
  addPrefixesAutomatically: true,
  useAssignedIpIfExists: false,
  defaultNetworkMask: '/24',
  namespace: 'Global',
}

const DEFAULT_PROPERTIES: BulkEditProperties = {
  interfaceConfig: DEFAULT_INTERFACE_CONFIG,
  ipConfig: DEFAULT_IP_CONFIG,
}

export default function BulkEditPage() {
  const { apiCall } = useApi()
  const { toast } = useToast()

  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>(EMPTY_CONDITIONS)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(EMPTY_DEVICE_IDS)
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)

  // Properties state
  const [properties, setProperties] = useState<BulkEditProperties>(DEFAULT_PROPERTIES)

  // Bulk edit state
  const [modifiedDevices, setModifiedDevices] = useState<Map<string, Partial<DeviceInfo>>>(EMPTY_MAP)

  // Dialog state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [showCSVUploadDialog, setShowCSVUploadDialog] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  // Reload state
  const [isReloadingData, setIsReloadingData] = useState(false)

  const handleDevicesSelected = useCallback((devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
  }, [])

  const handleSelectionChange = useCallback((selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }, [])

  const handlePropertiesChange = useCallback((newProperties: BulkEditProperties) => {
    setProperties(newProperties)
  }, [])

  const handleDeviceModified = useCallback((deviceId: string, changes: Partial<DeviceInfo>) => {
    setModifiedDevices(prev => {
      const next = new Map(prev)
      next.set(deviceId, changes)
      return next
    })
  }, [])

  const handleSaveDevices = useCallback(async () => {
    try {
      // Validate that we have modified devices
      validateModifiedDevices(modifiedDevices)

      // Convert modified devices to JSON array with interface config and namespace
      const devicesJson = convertModifiedDevicesToJSON(
        modifiedDevices,
        properties.interfaceConfig,
        properties.ipConfig.namespace,
        properties.ipConfig.addPrefixesAutomatically,
        properties.ipConfig.useAssignedIpIfExists
      )

      // Show loading toast
      toast({
        title: 'Starting bulk update...',
        description: `Updating ${modifiedDevices.size} device(s)`,
      })

      // Call the new JSON update endpoint
      const result = await apiCall('/api/celery/tasks/update-devices', {
        method: 'POST',
        body: JSON.stringify({
          devices: devicesJson,
          dry_run: false,
        }),
      }) as { job_id: string; task_id: string; message: string }

      // Set job tracking info
      setCurrentJobId(result.job_id)
      setCurrentTaskId(result.task_id)

      // Show progress dialog
      setShowProgressDialog(true)

      // Reset the modified devices state
      setModifiedDevices(EMPTY_MAP)
    } catch (error) {
      // Show error toast
      const errorMessage = error instanceof Error ? error.message : 'Failed to save devices'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Failed to save devices:', error)
    }
  }, [modifiedDevices, properties.interfaceConfig, properties.ipConfig.namespace, properties.ipConfig.addPrefixesAutomatically, properties.ipConfig.useAssignedIpIfExists, apiCall, toast])

  const handlePreviewChanges = useCallback(() => {
    setShowPreviewDialog(true)
  }, [])

  const handleRunDryRun = useCallback(async () => {
    // Validate and convert to JSON with interface config and namespace
    validateModifiedDevices(modifiedDevices)
    const devicesJson = convertModifiedDevicesToJSON(
      modifiedDevices,
      properties.interfaceConfig,
      properties.ipConfig.namespace,
      properties.ipConfig.addPrefixesAutomatically,
      properties.ipConfig.useAssignedIpIfExists
    )

    // Call API with dry_run = true
    const result = await apiCall('/api/celery/tasks/update-devices', {
      method: 'POST',
      body: JSON.stringify({
        devices: devicesJson,
        dry_run: true,
      }),
    })

    return result as {
      success: boolean
      devices_processed: number
      successful_updates: number
      failed_updates: number
      skipped_updates: number
      results: Array<{
        device_id: string
        device_name?: string
        success: boolean
        message: string
        changes?: Record<string, unknown>
      }>
    }
  }, [modifiedDevices, properties.interfaceConfig, properties.ipConfig.namespace, properties.ipConfig.addPrefixesAutomatically, properties.ipConfig.useAssignedIpIfExists, apiCall])

  const handleJobComplete = useCallback(() => {
    toast({
      title: 'Bulk update completed!',
      description: 'All devices have been processed.',
    })
  }, [toast])

  const handleResetDevices = useCallback(() => {
    setModifiedDevices(EMPTY_MAP)
  }, [])

  const handleReloadData = useCallback(async () => {
    if (deviceConditions.length === 0) {
      toast({
        title: 'No device conditions',
        description: 'Please select devices from the Devices tab first',
        variant: 'destructive',
      })
      return
    }

    setIsReloadingData(true)
    try {
      // Build operations from the original device conditions
      const andConditions: Array<{ field: string; operator: string; value: string }> = []
      const orConditions: Array<{ field: string; operator: string; value: string }> = []
      const notConditions: Array<{ field: string; operator: string; value: string }> = []

      deviceConditions.forEach((condition, index) => {
        const conditionData = {
          field: condition.field,
          operator: condition.operator,
          value: condition.value
        }

        if (index === 0) {
          andConditions.push(conditionData)
        } else {
          switch (condition.logic) {
            case 'AND':
              andConditions.push(conditionData)
              break
            case 'OR':
              orConditions.push(conditionData)
              break
            case 'NOT':
              notConditions.push(conditionData)
              break
          }
        }
      })

      const operations = []

      if (orConditions.length > 0) {
        operations.push({
          operation_type: 'OR',
          conditions: [...andConditions, ...orConditions],
          nested_operations: []
        })
      } else if (andConditions.length > 0) {
        operations.push({
          operation_type: 'AND',
          conditions: andConditions,
          nested_operations: []
        })
      }

      notConditions.forEach(condition => {
        operations.push({
          operation_type: 'NOT',
          conditions: [condition],
          nested_operations: []
        })
      })

      // Fetch fresh device data from Nautobot using the same endpoint as initial load
      const response = await apiCall<{
        devices: DeviceInfo[]
        total_count: number
        operations_executed: number
      }>('ansible-inventory/preview', {
        method: 'POST',
        body: { operations }
      })

      // Update devices with fresh data
      setPreviewDevices(response.devices)
      setSelectedDevices(response.devices)
      
      // Update selected device IDs
      const deviceIds = response.devices.map(d => d.id)
      setSelectedDeviceIds(deviceIds)

      // Clear modified devices since we have fresh data
      setModifiedDevices(EMPTY_MAP)

      toast({
        title: 'Data reloaded',
        description: `Successfully reloaded ${response.devices.length} device(s)`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reload data'
      toast({
        title: 'Error reloading data',
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Failed to reload device data:', error)
    } finally {
      setIsReloadingData(false)
    }
  }, [deviceConditions, apiCall, toast])

  const stableState = useMemo(() => ({
    previewDevices,
    deviceConditions,
    selectedDeviceIds,
    selectedDevices,
    properties,
    modifiedDevices,
  }), [previewDevices, deviceConditions, selectedDeviceIds, selectedDevices, properties, modifiedDevices])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Edit className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Edit Devices</h1>
            <p className="text-gray-600 mt-1">Edit multiple device properties efficiently</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="bulk-edit">Bulk Edit</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceSelectionTab
            selectedDeviceIds={stableState.selectedDeviceIds}
            selectedDevices={stableState.selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
            onOpenCSVUpload={() => setShowCSVUploadDialog(true)}
          />
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-6">
          <PropertiesTab
            properties={stableState.properties}
            onPropertiesChange={handlePropertiesChange}
          />
        </TabsContent>

        {/* Bulk Edit Tab */}
        <TabsContent value="bulk-edit" className="space-y-6">
          <BulkEditTab
            selectedDevices={stableState.selectedDevices}
            properties={stableState.properties}
            modifiedDevices={stableState.modifiedDevices}
            onDeviceModified={handleDeviceModified}
            onSaveDevices={handleSaveDevices}
            onResetDevices={handleResetDevices}
            onPreviewChanges={handlePreviewChanges}
            onReloadData={handleReloadData}
            isReloadingData={isReloadingData}
          />
        </TabsContent>
      </Tabs>

      {/* Preview Changes Dialog */}
      <PreviewChangesDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        modifiedDevices={modifiedDevices}
        onConfirmSave={handleSaveDevices}
        onRunDryRun={handleRunDryRun}
      />

      {/* Progress Tracking Dialog */}
      <ProgressDialog
        key={currentJobId || 'no-job'}
        open={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        jobId={currentJobId}
        taskId={currentTaskId}
        onJobComplete={handleJobComplete}
      />

      {/* CSV Upload Dialog */}
      <BulkUpdateModal
        open={showCSVUploadDialog}
        onClose={() => setShowCSVUploadDialog(false)}
      />
    </div>
  )
}
