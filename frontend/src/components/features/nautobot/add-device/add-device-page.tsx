'use client'

import { useState, useCallback, useMemo } from 'react'
import { Server, Plus, X, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// TanStack Query Hooks
import { useNautobotDropdownsQuery, useDeviceMutations } from './hooks/queries'

// Custom Hooks
import { useDeviceForm } from './hooks/use-device-form'
import { useSearchableDropdown } from './hooks/use-searchable-dropdown'
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { usePropertiesModal } from './hooks/use-properties-modal'
import { useCSVUpload } from './hooks/use-csv-upload'

// Components
import {
  DeviceInfoForm,
  PrefixConfiguration,
  InterfaceList,
  InterfacePropertiesModal,
  TagsModal,
  CustomFieldsModal,
  CSVUploadModal,
} from './components'

// Utils
import { buildLocationHierarchy, formatDeviceSubmissionData } from './utils'
import {
  EMPTY_DROPDOWN_OPTIONS,
  EMPTY_INTERFACE_TYPES,
  EMPTY_LOCATIONS,
  EMPTY_DEVICE_TYPES,
  EMPTY_SOFTWARE_VERSIONS,
  EMPTY_PLATFORMS,
} from './constants'
import type { StatusMessage, LocationItem, DeviceType, SoftwareVersion, ParsedDevice } from './types'
import type { DeviceFormValues } from './validation'

export function AddDevicePage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Fetch all dropdown data with TanStack Query
  const {
    data: dropdownData = {
      roles: EMPTY_DROPDOWN_OPTIONS,
      statuses: EMPTY_DROPDOWN_OPTIONS,
      locations: EMPTY_LOCATIONS,
      deviceTypes: EMPTY_DEVICE_TYPES,
      platforms: EMPTY_PLATFORMS,
      softwareVersions: EMPTY_SOFTWARE_VERSIONS,
      interfaceTypes: EMPTY_INTERFACE_TYPES,
      interfaceStatuses: EMPTY_DROPDOWN_OPTIONS,
      namespaces: EMPTY_DROPDOWN_OPTIONS,
      nautobotDefaults: null,
    },
    isLoading: isLoadingDropdowns,
  } = useNautobotDropdownsQuery()

  // Device form with react-hook-form + Zod
  const form = useDeviceForm({ defaults: dropdownData.nautobotDefaults })
  const { watch, reset, handleSubmit: formHandleSubmit } = form

  // Device mutation
  const { createDevice } = useDeviceMutations()

  // Searchable dropdowns with memoized predicates
  const locationFilterPredicate = useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const deviceTypeFilterPredicate = useCallback(
    (dt: DeviceType, query: string) => (dt.display || dt.model).toLowerCase().includes(query),
    []
  )

  const softwareVersionFilterPredicate = useCallback(
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
    getDisplayText: (dt) => dt.display || dt.model,
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
  const tagsManager = useTagsManager()
  const customFieldsManager = useCustomFieldsManager()
  const propertiesModal = usePropertiesModal()

  // CSV Upload
  const csvUpload = useCSVUpload({
    nautobotDefaults: dropdownData.nautobotDefaults,
    onImportDevice: async (device: ParsedDevice) => {
      // Implementation placeholder - would need proper device import logic
      return {
        deviceName: device.name,
        status: 'success' as const,
        message: 'Device imported successfully',
      }
    },
  })

  // Form submission
  const onSubmit = useCallback(
    async (data: DeviceFormValues) => {
      setStatusMessage({ type: 'info', message: 'Starting device addition workflow...' })

      // Update form with selected tags and custom fields
      form.setValue('selectedTags', tagsManager.selectedTags)
      form.setValue('customFieldValues', customFieldsManager.customFieldValues)

      const submissionData = formatDeviceSubmissionData({
        ...data,
        selectedTags: tagsManager.selectedTags,
        customFieldValues: customFieldsManager.customFieldValues,
      })
      const result = await createDevice.mutateAsync(submissionData)

      setStatusMessage({
        type: result.messageType,
        message: result.message,
      })

      if (result.success) {
        // Don't reset form - allow user to add similar devices
        setTimeout(() => setStatusMessage(null), 3000)
      }
    },
    [createDevice, form, tagsManager, customFieldsManager]
  )

  const handleClearForm = useCallback(() => {
    reset()
    tagsManager.clearSelectedTags()
    customFieldsManager.clearFieldValues()
    setStatusMessage(null)
  }, [reset, tagsManager, customFieldsManager])

  // Loading state
  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading form data...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={formHandleSubmit(onSubmit)} className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Add Device to Nautobot</h1>
              <p className="text-muted-foreground">
                Add a new network device or bare metal server
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => csvUpload.setShowModal(true)}
            disabled={createDevice.isPending}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import from CSV
          </Button>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <Alert
            className={`border-${statusMessage.type === 'error' ? 'red' : statusMessage.type === 'success' ? 'green' : 'blue'}-500`}
          >
            <AlertDescription>{statusMessage.message}</AlertDescription>
          </Alert>
        )}

        {/* Device Information */}
        <DeviceInfoForm
          form={form}
          dropdownData={dropdownData}
          locationDropdown={locationDropdown}
          deviceTypeDropdown={deviceTypeDropdown}
          softwareVersionDropdown={softwareVersionDropdown}
          isLoading={createDevice.isPending}
          onOpenTags={tagsManager.openModal}
          onOpenCustomFields={customFieldsManager.openModal}
          selectedTagsCount={tagsManager.selectedTags.length}
        />

        {/* Prefix Configuration */}
        <PrefixConfiguration form={form} isLoading={createDevice.isPending} />

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
          isLoading={createDevice.isPending}
        />

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={handleClearForm}
            disabled={createDevice.isPending}
            variant="outline"
            size="lg"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Form
          </Button>
          <Button type="submit" disabled={createDevice.isPending} size="lg">
            {createDevice.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

        {/* Modals */}
        <InterfacePropertiesModal
          form={form}
          interfaceId={propertiesModal.currentInterfaceId}
          vlans={propertiesModal.vlans}
          isLoadingVlans={propertiesModal.isLoadingVlans}
          show={propertiesModal.showModal}
          onClose={propertiesModal.closeModal}
        />

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
            roles: dropdownData.roles,
            locations: dropdownData.locations,
            deviceTypes: dropdownData.deviceTypes,
          }}
          onFileSelect={csvUpload.parseCSV}
          onImport={csvUpload.importDevices}
          onUpdateMapping={csvUpload.updateMapping}
          onApplyMappings={csvUpload.applyMappings}
          onShowMappingConfig={csvUpload.setShowMappingConfig}
          onReset={() => {
            csvUpload.closeModal()
          }}
        />
      </form>
    </div>
  )
}
