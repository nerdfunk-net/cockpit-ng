/**
 * Device Sync Modal - Replaces sync-to-nautobot-modal.tsx
 * Uses shared form components from add-device for consistent UX
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useApi } from '@/hooks/use-api'

// Shared form components from add-device
import {
  DeviceInfoForm,
  InterfaceTable,
  PrefixConfiguration,
} from '@/components/features/nautobot/add-device/components'

// Shared form utilities
import { useDeviceForm, transformCheckMKToFormData } from '@/components/shared/device-form'
import type { DeviceFormValues } from '@/components/shared/device-form'

// CheckMK types
import type { NautobotMetadata, PropertyMapping } from '@/types/checkmk/types'
import type { InterfaceMappingData } from '@/lib/checkmk/property-mapping-utils'

// Add-device types and utilities
import { useSearchableDropdown } from '@/components/features/nautobot/add-device/hooks/use-searchable-dropdown'
import { useTagsManager } from '@/components/features/nautobot/add-device/hooks/use-tags-manager'
import { useCustomFieldsManager } from '@/components/features/nautobot/add-device/hooks/use-custom-fields-manager'
import { usePropertiesModal } from '@/components/features/nautobot/add-device/hooks/use-properties-modal'
import { useNautobotDropdownsQuery } from '@/components/features/nautobot/add-device/hooks/queries/use-nautobot-dropdowns-query'
import { buildLocationHierarchy } from '@/components/features/nautobot/add-device/utils'
import {
  TagsModal,
  CustomFieldsModal,
  InterfacePropertiesModal,
} from '@/components/features/nautobot/add-device/components'

import type {
  LocationItem,
  DeviceType,
  SoftwareVersion,
  NautobotDropdownsResponse,
} from '@/components/features/nautobot/add-device/types'
import type { InterfaceSource } from '@/components/features/checkmk/hosts-inventory/hooks/use-nautobot-sync'

interface DeviceSyncModalProps {
  open: boolean
  deviceId?: string
  propertyMappings: Record<string, PropertyMapping>
  nautobotMetadata: NautobotMetadata | null
  loadingMetadata: boolean
  interfaceMappings: Record<string, InterfaceMappingData>
  ipAddressStatuses: Array<{ id: string; name: string }> | null
  interfaceSource: InterfaceSource
  onInterfaceSourceChange: (source: InterfaceSource) => void
  onSync: (formData: DeviceFormValues, deviceId?: string) => Promise<void>
  onClose: () => void
  isSyncing: boolean
}

export function DeviceSyncModal({
  open,
  deviceId,
  propertyMappings,
  nautobotMetadata,
  loadingMetadata,
  interfaceMappings,
  ipAddressStatuses,
  interfaceSource,
  onInterfaceSourceChange,
  onSync,
  onClose,
  isSyncing,
}: DeviceSyncModalProps) {
  const { toast } = useToast()
  const { apiCall } = useApi()
  
  // Fetch all dropdown data from Nautobot (for interface types, namespaces, IP roles, etc.)
  const { data: fullDropdownData } = useNautobotDropdownsQuery({
    enabled: open,
  })
  
  // Transform CheckMK data to form format
  const initialFormData = useMemo(() => {
    if (!open || loadingMetadata) return undefined
    
    return transformCheckMKToFormData(
      propertyMappings,
      nautobotMetadata,
      interfaceMappings,
      {
        namespaces: fullDropdownData?.namespaces,
        nautobotDefaults: fullDropdownData?.nautobotDefaults,
        ipRoles: fullDropdownData?.ipRoles,
      }
    )
  }, [propertyMappings, nautobotMetadata, interfaceMappings, open, loadingMetadata, fullDropdownData])

  // Merge CheckMK metadata with full dropdown data
  const dropdownData: NautobotDropdownsResponse = useMemo(() => ({
    roles: nautobotMetadata?.roles || [],
    statuses: nautobotMetadata?.statuses || [],
    locations: nautobotMetadata?.locations || [],
    deviceTypes: (nautobotMetadata?.deviceTypes || []).map(dt => ({
      id: dt.id,
      model: dt.name || '',
      manufacturer: { id: '', name: '' },
      display: dt.name,
    })),
    platforms: (nautobotMetadata?.platforms || []).map(p => ({
      id: p.id,
      name: p.name,
      display: p.name,
    })),
    softwareVersions: fullDropdownData?.softwareVersions || [],
    interfaceTypes: fullDropdownData?.interfaceTypes || [],
    interfaceStatuses: fullDropdownData?.interfaceStatuses || ipAddressStatuses || [],
    namespaces: fullDropdownData?.namespaces || [{ id: 'Global', name: 'Global' }],
    ipRoles: fullDropdownData?.ipRoles || [],
    nautobotDefaults: fullDropdownData?.nautobotDefaults || null,
  }), [nautobotMetadata, ipAddressStatuses, fullDropdownData])

  // Initialize form with CheckMK data
  const form = useDeviceForm({
    initialData: initialFormData,
    mode: 'update',
  })

  const { watch, reset } = form

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationResults, setValidationResults] = useState<{
    isValid: boolean
    deviceRole: boolean
    deviceStatus: boolean
    deviceType: boolean
    location: boolean
    interfaceStatus: boolean
    interfaceIssues: number
    ipAddresses: boolean
    ipAddressIssues: number
  }>({
    isValid: true,
    deviceRole: true,
    deviceStatus: true,
    deviceType: true,
    location: true,
    interfaceStatus: true,
    interfaceIssues: 0,
    ipAddresses: true,
    ipAddressIssues: 0,
  })

  // Reset form when initial data changes or device changes
  useEffect(() => {
    if (initialFormData && open) {
      // First reset to empty to clear any stale data from previous device
      reset({} as DeviceFormValues)
      // Then populate with the new device data in the next tick
      setTimeout(() => {
        reset(initialFormData as DeviceFormValues)
      }, 0)
    }
  }, [initialFormData, open, reset, deviceId])

  // Clear form completely when modal closes to prevent data from persisting
  useEffect(() => {
    if (!open) {
      // Reset to empty values when closing
      reset({} as DeviceFormValues)
    }
  }, [open, reset])

  // Searchable dropdowns
  const locationFilterPredicate = React.useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const deviceTypeFilterPredicate = React.useCallback(
    (dt: DeviceType, query: string) => (dt.display || dt.model || '').toLowerCase().includes(query),
    []
  )

  const softwareVersionFilterPredicate = React.useCallback(
    (sv: SoftwareVersion, query: string) =>
      `${sv.platform?.name || ''} ${sv.version}`.toLowerCase().includes(query),
    []
  )

  const locationDropdown = useSearchableDropdown({
    items: useMemo(
      () => buildLocationHierarchy(dropdownData.locations),
      [dropdownData.locations]
    ),
    selectedId: watch('selectedLocation'),
    onSelect: (id) => form.setValue('selectedLocation', id),
    getDisplayText: (loc) => loc.hierarchicalPath || loc.name,
    filterPredicate: locationFilterPredicate,
  })

  const deviceTypeDropdown = useSearchableDropdown({
    items: dropdownData.deviceTypes,
    selectedId: watch('selectedDeviceType'),
    onSelect: (id) => form.setValue('selectedDeviceType', id),
    getDisplayText: (dt) => dt.display || dt.model || 'Unknown',
    filterPredicate: deviceTypeFilterPredicate,
  })

  const softwareVersionDropdown = useSearchableDropdown({
    items: dropdownData.softwareVersions,
    selectedId: watch('selectedSoftwareVersion') || '',
    onSelect: (id) => form.setValue('selectedSoftwareVersion', id),
    getDisplayText: (sv) => `${sv.platform?.name || ''} ${sv.version}`.trim(),
    filterPredicate: softwareVersionFilterPredicate,
  })

  // Modal managers
  const propertiesModal = usePropertiesModal()
  const tagsManager = useTagsManager()
  const customFieldsManager = useCustomFieldsManager()

  // Handle form submission with validation
  const handleSync = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      
      // Get current form values
      const values = form.getValues()
      
      // Run validation
      const deviceRole = !!values.selectedRole
      const deviceStatus = !!values.selectedStatus
      const deviceType = !!values.selectedDeviceType
      const location = !!values.selectedLocation

      // Check interface statuses and IP addresses
      const interfaces = values.interfaces || []
      let allInterfacesHaveStatus = true
      let allIpAddressesValid = true

      // IP address validation regex: xxx.xxx.xxx.xxx/yy or xxxx:xxxx::/yy
      const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
      const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/

      const errorMessages: string[] = []

      if (!deviceRole) errorMessages.push('Device Role is required')
      if (!deviceStatus) errorMessages.push('Device Status is required')
      if (!deviceType) errorMessages.push('Device Type is required')
      if (!location) errorMessages.push('Location is required')

      interfaces.forEach((iface, idx) => {
        if (!iface.status) {
          allInterfacesHaveStatus = false
          errorMessages.push(`Interface ${idx + 1} (${iface.name || 'unnamed'}) is missing status`)
        }

        // Check IP addresses
        const ipAddresses = iface.ip_addresses || []
        ipAddresses.forEach((ip, ipIdx) => {
          if (ip.address) {
            const isValidCidr = ipv4CidrRegex.test(ip.address) || ipv6CidrRegex.test(ip.address)
            if (!isValidCidr) {
              allIpAddressesValid = false
              errorMessages.push(`Interface ${idx + 1}, IP ${ipIdx + 1}: Invalid CIDR format (${ip.address})`)
            }
          } else {
            allIpAddressesValid = false
            errorMessages.push(`Interface ${idx + 1}, IP ${ipIdx + 1}: IP address is required`)
          }
        })
      })
      
      const isValid = deviceRole && deviceStatus && deviceType && location && allInterfacesHaveStatus && allIpAddressesValid
      
      if (!isValid) {
        toast({
          title: 'Validation Failed',
          description: errorMessages.slice(0, 5).join('\n') + (errorMessages.length > 5 ? `\n...and ${errorMessages.length - 5} more` : ''),
          variant: 'destructive',
        })
        return
      }
      
      // If validation passes, proceed with sync
      await onSync(values, deviceId)
    },
    [form, deviceId, onSync, toast]
  )

  // Handle manual validation
  const handleValidate = React.useCallback(
    async () => {
      // Get current form values
      const values = form.getValues()
      
      // Check required fields
      const deviceRole = !!values.selectedRole
      const deviceStatus = !!values.selectedStatus
      const deviceType = !!values.selectedDeviceType
      const location = !!values.selectedLocation
      
      // Check interface statuses and IP addresses
      const interfaces = values.interfaces || []
      let interfaceIssues = 0
      let allInterfacesHaveStatus = true
      let ipAddressIssues = 0
      let allIpAddressesValid = true
      
      // IP address validation regex: xxx.xxx.xxx.xxx/yy or xxxx:xxxx::/yy
      const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
      const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/
      
      interfaces.forEach(iface => {
        if (!iface.status) {
          allInterfacesHaveStatus = false
          interfaceIssues++
        }
        
        // Check IP addresses
        const ipAddresses = iface.ip_addresses || []
        ipAddresses.forEach(ip => {
          if (ip.address) {
            const isValidCidr = ipv4CidrRegex.test(ip.address) || ipv6CidrRegex.test(ip.address)
            if (!isValidCidr) {
              allIpAddressesValid = false
              ipAddressIssues++
            }
          } else {
            // Empty IP address is also invalid
            allIpAddressesValid = false
            ipAddressIssues++
          }
        })
      })
      
      const isValid = deviceRole && deviceStatus && deviceType && location && allInterfacesHaveStatus && allIpAddressesValid
      
      setValidationResults({
        isValid,
        deviceRole,
        deviceStatus,
        deviceType,
        location,
        interfaceStatus: allInterfacesHaveStatus,
        interfaceIssues,
        ipAddresses: allIpAddressesValid,
        ipAddressIssues,
      })
      
      setShowValidationModal(true)
    },
    [form]
  )

  // Load and apply default values from Nautobot settings
  const handleUseDefaultValues = useCallback(async () => {
    try {
      const response = await apiCall<{
        success: boolean
        data: {
          device_role?: string
          device_status?: string
          location?: string
          platform?: string
          interface_status?: string
          namespace?: string
        }
      }>('settings/nautobot/defaults')
      
      console.log('[DeviceSyncModal] Default values received:', response)
      
      if (response?.data) {
        const defaults = response.data
        
        // Apply defaults to form
        if (defaults.device_role) {
          console.log('[DeviceSyncModal] Setting device_role to:', defaults.device_role)
          form.setValue('selectedRole', defaults.device_role)
        }
        if (defaults.device_status) {
          console.log('[DeviceSyncModal] Setting device_status to:', defaults.device_status)
          form.setValue('selectedStatus', defaults.device_status)
        }
        if (defaults.location) {
          console.log('[DeviceSyncModal] Setting location to:', defaults.location)
          form.setValue('selectedLocation', defaults.location)
        }
        if (defaults.platform) {
          console.log('[DeviceSyncModal] Setting platform to:', defaults.platform)
          form.setValue('selectedPlatform', defaults.platform)
        }
        
        // Apply interface status to all interfaces
        if (defaults.interface_status) {
          console.log('[DeviceSyncModal] Setting interface_status to:', defaults.interface_status)
          const currentInterfaces = form.getValues('interfaces')
          if (currentInterfaces && currentInterfaces.length > 0) {
            currentInterfaces.forEach((_, index) => {
              form.setValue(`interfaces.${index}.status`, defaults.interface_status!)
            })
            console.log('[DeviceSyncModal] Updated interface statuses for', currentInterfaces.length, 'interfaces')
          }
        }
        
        console.log('[DeviceSyncModal] Form values after setting:', {
          selectedRole: form.getValues('selectedRole'),
          selectedStatus: form.getValues('selectedStatus'),
          selectedLocation: form.getValues('selectedLocation'),
          selectedPlatform: form.getValues('selectedPlatform'),
        })
        
        toast({
          title: 'Default Values Applied',
          description: 'Nautobot default values have been applied to the form',
        })
      }
    } catch (error) {
      console.error('Failed to load default values:', error)
      toast({
        title: 'Error',
        description: 'Failed to load default values from settings',
        variant: 'destructive',
      })
    }
  }, [apiCall, form, toast])

  // Handle Get Primary IP
  const handleGetPrimaryIP = useCallback(async () => {
    try {
      const deviceName = form.getValues('deviceName')
      if (!deviceName) {
        toast({
          title: 'Error',
          description: 'Device name is required to fetch primary IP',
          variant: 'destructive',
        })
        return
      }

      // Fetch device info from Nautobot
      const response = await apiCall<{
        devices: Array<{
          id: string
          name: string
          primary_ip4: {
            address: string
          } | null
        }>
        count: number
      }>(`nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(deviceName)}`)

      if (!response?.devices || response.devices.length === 0) {
        toast({
          title: 'Device Not Found',
          description: `No device named "${deviceName}" found in Nautobot`,
          variant: 'destructive',
        })
        return
      }

      const device = response.devices[0]
      const primaryIP = device?.primary_ip4?.address

      if (!primaryIP) {
        toast({
          title: 'No Primary IP',
          description: `Device "${deviceName}" has no primary IPv4 address in Nautobot`,
          variant: 'destructive',
        })
        return
      }

      // Find the primary interface in the form
      const interfaces = form.getValues('interfaces') || []
      let primaryInterfaceIndex = -1
      let primaryIpIndex = -1

      interfaces.forEach((iface, ifaceIdx) => {
        iface.ip_addresses?.forEach((ip, ipIdx) => {
          if (ip.is_primary) {
            primaryInterfaceIndex = ifaceIdx
            primaryIpIndex = ipIdx
          }
        })
      })

      if (primaryInterfaceIndex === -1 || primaryIpIndex === -1) {
        toast({
          title: 'No Primary Interface',
          description: 'Please select a primary interface first by checking the "Primary" checkbox',
          variant: 'destructive',
        })
        return
      }

      // Update the primary interface's IP address
      form.setValue(
        `interfaces.${primaryInterfaceIndex}.ip_addresses.${primaryIpIndex}.address`,
        primaryIP
      )

      toast({
        title: 'Primary IP Updated',
        description: `Set primary interface IP to ${primaryIP}`,
      })
    } catch (error) {
      console.error('Failed to fetch primary IP:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch primary IP from Nautobot',
        variant: 'destructive',
      })
    }
  }, [apiCall, form, toast])

  // Determine if device exists
  const isUpdate = Boolean(deviceId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Sync Device to Nautobot</DialogTitle>
          <DialogDescription>Review and sync device to Nautobot</DialogDescription>
        </DialogHeader>

        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold">Sync Device to Nautobot</h2>
                <p className="text-blue-100 text-sm">{form.watch('deviceName') || 'CheckMK Device'}</p>
              </div>
              {isUpdate && (
                <Badge className="bg-red-600 text-white border-red-700 font-semibold px-3 py-1 shadow-lg">
                  Update Existing Device
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {loadingMetadata ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading metadata...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSync} className="p-6 space-y-6">
              {!isUpdate && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertDescription className="text-sm text-amber-800">
                    Device does not exist in Nautobot. A new device will be created.
                  </AlertDescription>
                </Alert>
              )}

              {/* Device Information Form */}
              <DeviceInfoForm
                form={form}
                dropdownData={dropdownData}
                locationDropdown={locationDropdown}
                deviceTypeDropdown={deviceTypeDropdown}
                softwareVersionDropdown={softwareVersionDropdown}
                isLoading={isSyncing}
                onOpenTags={tagsManager.openModal}
                onOpenCustomFields={customFieldsManager.openModal}
                onUseDefaultValues={handleUseDefaultValues}
                selectedTagsCount={tagsManager.selectedTags.length}
              />

              {/* Prefix Configuration */}
              <PrefixConfiguration form={form} isLoading={isSyncing} />

              {/* Network Interfaces */}
              <InterfaceTable
                form={form}
                dropdownData={dropdownData}
                onOpenProperties={(id) => {
                  const location = dropdownData.locations.find(
                    (l) => l.id === watch('selectedLocation')
                  )
                  propertiesModal.openModal(id, location?.name)
                }}
                isLoading={isSyncing}
                onGetPrimaryIP={isUpdate ? handleGetPrimaryIP : undefined}
                interfaceSource={interfaceSource}
                onInterfaceSourceChange={onInterfaceSourceChange}
              />

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSyncing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleValidate}
                  className="min-w-[120px] hover:bg-blue-100 hover:border-blue-400 active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validate
                </Button>
                <Button
                  type="submit"
                  disabled={isSyncing}
                  className="min-w-[140px]"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync to Nautobot
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Modals */}
        <TagsModal
          show={tagsManager.showModal}
          onClose={tagsManager.closeModal}
          availableTags={tagsManager.availableTags}
          selectedTags={tagsManager.selectedTags}
          onToggleTag={tagsManager.toggleTag}
          isLoading={tagsManager.isLoading}
        />

        <CustomFieldsModal
          show={customFieldsManager.showModal}
          onClose={customFieldsManager.closeModal}
          customFields={customFieldsManager.customFields}
          customFieldValues={customFieldsManager.customFieldValues}
          onUpdateField={customFieldsManager.updateFieldValue}
          isLoading={customFieldsManager.isLoading}
          customFieldChoices={customFieldsManager.customFieldChoices}
        />

        <InterfacePropertiesModal
          show={propertiesModal.showModal}
          onClose={propertiesModal.closeModal}
          interfaceId={propertiesModal.currentInterfaceId}
          form={form}
          vlans={propertiesModal.vlans}
          isLoadingVlans={propertiesModal.isLoadingVlans}
        />
      </DialogContent>

      {/* Validation Results Modal */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validationResults.isValid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Validation Passed</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span>Validation Failed</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {validationResults.isValid 
                ? 'All required fields are properly configured.'
                : 'Some required fields are missing or invalid.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Device Role */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.deviceRole ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Device Role</span>
              </div>
              <Badge variant={validationResults.deviceRole ? "default" : "destructive"}>
                {validationResults.deviceRole ? 'Valid' : 'Required'}
              </Badge>
            </div>

            {/* Device Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.deviceStatus ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Device Status</span>
              </div>
              <Badge variant={validationResults.deviceStatus ? "default" : "destructive"}>
                {validationResults.deviceStatus ? 'Valid' : 'Required'}
              </Badge>
            </div>

            {/* Device Type */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.deviceType ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Device Type</span>
              </div>
              <Badge variant={validationResults.deviceType ? "default" : "destructive"}>
                {validationResults.deviceType ? 'Valid' : 'Required'}
              </Badge>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.location ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Location</span>
              </div>
              <Badge variant={validationResults.location ? "default" : "destructive"}>
                {validationResults.location ? 'Valid' : 'Required'}
              </Badge>
            </div>

            {/* Interface Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.interfaceStatus ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Interface Status</span>
              </div>
              <Badge variant={validationResults.interfaceStatus ? "default" : "destructive"}>
                {validationResults.interfaceStatus 
                  ? 'All Valid' 
                  : `${validationResults.interfaceIssues} Missing`}
              </Badge>
            </div>

            {/* IP Addresses */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.ipAddresses ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">IP Addresses (CIDR)</span>
              </div>
              <Badge variant={validationResults.ipAddresses ? "default" : "destructive"}>
                {validationResults.ipAddresses 
                  ? 'All Valid' 
                  : `${validationResults.ipAddressIssues} Invalid`}
              </Badge>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowValidationModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
