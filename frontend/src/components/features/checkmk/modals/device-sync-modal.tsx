/**
 * Device Sync Modal - Replaces sync-to-nautobot-modal.tsx
 * Uses shared form components from add-device for consistent UX
 */

import React, { useEffect, useMemo } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Shared form components from add-device
import {
  DeviceInfoForm,
  InterfaceList,
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

interface DeviceSyncModalProps {
  open: boolean
  deviceId?: string
  propertyMappings: Record<string, PropertyMapping>
  nautobotMetadata: NautobotMetadata | null
  loadingMetadata: boolean
  interfaceMappings: Record<string, InterfaceMappingData>
  ipAddressStatuses: Array<{ id: string; name: string }> | null
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
  onSync,
  onClose,
  isSyncing,
}: DeviceSyncModalProps) {
  
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

  const { watch, reset, handleSubmit: formHandleSubmit } = form

  // Reset form when initial data changes
  useEffect(() => {
    if (initialFormData && open) {
      reset(initialFormData as DeviceFormValues)
    }
  }, [initialFormData, open, reset])

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

  // Handle form submission
  const onSubmit = React.useCallback(
    async (data: DeviceFormValues) => {
      await onSync(data, deviceId)
    },
    [deviceId, onSync]
  )

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
            <div>
              <h2 className="text-lg font-semibold">Sync Device to Nautobot</h2>
              <p className="text-blue-100 text-sm">{form.watch('deviceName') || 'CheckMK Device'}</p>
            </div>
            {isUpdate && (
              <Badge className="bg-white/20 text-white border-white/30">
                Update Existing Device
              </Badge>
            )}
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
            <form onSubmit={formHandleSubmit(onSubmit)} className="p-6 space-y-6">
              {/* Device Status */}
              {isUpdate && (
                <Card className="border-blue-200/60 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-blue-500">Exists in Nautobot</Badge>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 mb-2">
                          This device exists in Nautobot. Review the form and click &ldquo;Sync&rdquo; to update.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                selectedTagsCount={tagsManager.selectedTags.length}
              />

              {/* Prefix Configuration */}
              <PrefixConfiguration form={form} isLoading={isSyncing} />

              {/* Network Interfaces */}
              <InterfaceList
                form={form}
                dropdownData={dropdownData}
                onOpenProperties={(id) => {
                  const location = dropdownData.locations.find(
                    (l) => l.id === watch('selectedLocation')
                  )
                  propertiesModal.openModal(id, location?.name)
                }}
                isLoading={isSyncing}
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
    </Dialog>
  )
}
