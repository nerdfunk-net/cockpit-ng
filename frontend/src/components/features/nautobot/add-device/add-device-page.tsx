'use client'

import { useState, useCallback, useMemo } from 'react'
import { FieldErrors, useWatch } from 'react-hook-form'
import { Server, Loader2 } from 'lucide-react'

// TanStack Query Hooks
import { useNautobotDropdownsQuery, useDeviceMutations } from './hooks/queries'

// Custom Hooks
import { useDeviceForm } from './hooks/use-device-form'
import { useSearchableDropdown } from './hooks/use-searchable-dropdown'
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { usePropertiesModal } from './hooks/use-properties-modal'
import { useCsvImport } from './hooks/use-csv-import'
import type { FormDefaults } from './hooks/use-csv-import'
import { useDeviceImport } from './hooks/use-device-import'
import { useValidateDevice } from './hooks/use-validate-device'

// Components
import {
  DeviceInfoForm,
  PrefixConfiguration,
  InterfaceList,
  InterfacePropertiesModal,
  TagsModal,
  CustomFieldsModal,
  CsvImportWizard,
  PageHeader,
  StatusAlert,
  ErrorModal,
  ValidationErrorModal,
  HelpModal,
  ValidationSummaryModal,
  FormActions,
} from './components'
import { buildLocationHierarchy, formatDeviceSubmissionData } from './utils'
import {
  EMPTY_DROPDOWN_OPTIONS,
  EMPTY_INTERFACE_TYPES,
  EMPTY_LOCATIONS,
  EMPTY_DEVICE_TYPES,
  EMPTY_SOFTWARE_VERSIONS,
  EMPTY_PLATFORMS,
} from './constants'
import type { StatusMessage, LocationItem, DeviceType, SoftwareVersion } from './types'
import type { DeviceFormValues } from './validation'

export function AddDevicePage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState<string>('')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showHelpModal, setShowHelpModal] = useState(false)

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
      ipRoles: EMPTY_DROPDOWN_OPTIONS,
      nautobotDefaults: null,
    },
    isLoading: isLoadingDropdowns,
  } = useNautobotDropdownsQuery()

  // Device form with react-hook-form + Zod
  const form = useDeviceForm({ defaults: dropdownData.nautobotDefaults })
  const { watch, reset, handleSubmit: formHandleSubmit } = form

  // Device mutation
  const { createDevice } = useDeviceMutations()
  const { handleImportDevice } = useDeviceImport()
  const {
    handleValidate,
    showValidationSummary,
    setShowValidationSummary,
    validationResults,
  } = useValidateDevice(form)

  // Searchable dropdowns with memoized predicates
  const locationFilterPredicate = useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const deviceTypeFilterPredicate = useCallback(
    (dt: DeviceType, query: string) =>
      (dt.display || dt.model).toLowerCase().includes(query),
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
    onSelect: id => form.setValue('selectedLocation', id),
    getDisplayText: loc => loc.hierarchicalPath || loc.name,
    filterPredicate: locationFilterPredicate,
  })

  const deviceTypeDropdown = useSearchableDropdown({
    items: dropdownData.deviceTypes,
    selectedId: watch('selectedDeviceType'),
    onSelect: id => form.setValue('selectedDeviceType', id),
    getDisplayText: dt => dt.display || dt.model,
    filterPredicate: deviceTypeFilterPredicate,
  })

  const softwareVersionDropdown = useSearchableDropdown({
    items: dropdownData.softwareVersions,
    selectedId: watch('selectedSoftwareVersion') || '',
    onSelect: id => form.setValue('selectedSoftwareVersion', id),
    getDisplayText: sv => `${sv.platform?.name || ''} ${sv.version}`.trim(),
    filterPredicate: softwareVersionFilterPredicate,
  })

  // Modal managers
  const tagsManager = useTagsManager()
  const customFieldsManager = useCustomFieldsManager()
  const propertiesModal = usePropertiesModal()

  // Build form defaults for CSV import wizard — useWatch creates reactive subscriptions
  const [
    selectedRole,
    selectedStatus,
    selectedLocation,
    selectedDeviceType,
    selectedPlatform,
  ] = useWatch({
    control: form.control,
    name: [
      'selectedRole',
      'selectedStatus',
      'selectedLocation',
      'selectedDeviceType',
      'selectedPlatform',
    ],
  })

  const csvFormDefaults = useMemo((): FormDefaults => {
    return {
      role: selectedRole || undefined,
      roleName: dropdownData.roles.find(r => r.id === selectedRole)?.name,
      status: selectedStatus || undefined,
      statusName: dropdownData.statuses.find(s => s.id === selectedStatus)?.name,
      location: selectedLocation || undefined,
      locationName: dropdownData.locations.find(l => l.id === selectedLocation)?.name,
      deviceType: selectedDeviceType || undefined,
      deviceTypeName:
        dropdownData.deviceTypes.find(dt => dt.id === selectedDeviceType)?.display ||
        dropdownData.deviceTypes.find(dt => dt.id === selectedDeviceType)?.model,
      platform: selectedPlatform || undefined,
      platformName: dropdownData.platforms.find(p => p.id === selectedPlatform)?.name,
      selectedTags:
        tagsManager.selectedTags.length > 0 ? tagsManager.selectedTags : undefined,
      customFieldValues:
        Object.keys(customFieldsManager.customFieldValues).length > 0
          ? customFieldsManager.customFieldValues
          : undefined,
    }
  }, [
    selectedRole,
    selectedStatus,
    selectedLocation,
    selectedDeviceType,
    selectedPlatform,
    dropdownData,
    tagsManager.selectedTags,
    customFieldsManager.customFieldValues,
  ])

  // CSV Import wizard
  const csvImport = useCsvImport({
    nautobotDefaults: dropdownData.nautobotDefaults,
    formDefaults: csvFormDefaults,
    onImportDevice: handleImportDevice,
  })

  // Handle form validation errors
  const onInvalid = useCallback((validationErrors: FieldErrors<DeviceFormValues>) => {
    const errors: string[] = []

    // Collect all validation errors
    if (validationErrors.deviceName) {
      errors.push(`Device Name: ${validationErrors.deviceName.message}`)
    }
    if (validationErrors.selectedRole) {
      errors.push(`Device Role: ${validationErrors.selectedRole.message}`)
    }
    if (validationErrors.selectedStatus) {
      errors.push(`Device Status: ${validationErrors.selectedStatus.message}`)
    }
    if (validationErrors.selectedLocation) {
      errors.push(`Location: ${validationErrors.selectedLocation.message}`)
    }
    if (validationErrors.selectedDeviceType) {
      errors.push(`Device Type: ${validationErrors.selectedDeviceType.message}`)
    }

    // Check interface errors
    if (validationErrors.interfaces) {
      if (Array.isArray(validationErrors.interfaces)) {
        validationErrors.interfaces.forEach((interfaceError, index) => {
          if (!interfaceError) return

          // Iterate through all error fields in the interface
          Object.keys(interfaceError).forEach(fieldName => {
            const fieldError = interfaceError[fieldName as keyof typeof interfaceError]

            // Handle ip_addresses specially since it's an array
            if (fieldName === 'ip_addresses') {
              // Check if it's a root-level array error
              const fieldErrorWithMsg = fieldError as { message?: string }
              if (fieldErrorWithMsg?.message) {
                errors.push(
                  `Interface ${index + 1} IP Addresses: ${fieldErrorWithMsg.message}`
                )
              }
              // Check individual IP address errors
              else if (Array.isArray(fieldError)) {
                fieldError.forEach(
                  (
                    ipError: {
                      address?: { message?: string }
                      namespace?: { message?: string }
                    },
                    ipIndex: number
                  ) => {
                    if (ipError?.address) {
                      errors.push(
                        `Interface ${index + 1}, IP ${ipIndex + 1} Address: ${ipError.address.message}`
                      )
                    }
                    if (ipError?.namespace) {
                      errors.push(
                        `Interface ${index + 1}, IP ${ipIndex + 1} Namespace: ${ipError.namespace.message}`
                      )
                    }
                  }
                )
              }
            } else {
              // Handle all other field errors
              const message = (fieldError as { message?: string })?.message
              if (message) {
                const fieldLabel =
                  fieldName.charAt(0).toUpperCase() +
                  fieldName.slice(1).replace(/_/g, ' ')
                errors.push(`Interface ${index + 1} ${fieldLabel}: ${message}`)
              }
            }
          })
        })
      } else if (validationErrors.interfaces.message) {
        errors.push(`Interfaces: ${validationErrors.interfaces.message}`)
      }
    }

    // Only show modal if there are actual errors
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidationModal(true)
    }
  }, [])

  // Handle manual validation
  // Form submission
  const onSubmit = useCallback(
    async (data: DeviceFormValues) => {
      setStatusMessage({
        type: 'info',
        message: 'Starting device addition workflow...',
      })

      form.setValue('selectedTags', tagsManager.selectedTags)
      form.setValue('customFieldValues', customFieldsManager.customFieldValues)

      const submissionData = formatDeviceSubmissionData({
        ...data,
        selectedTags: tagsManager.selectedTags,
        customFieldValues: customFieldsManager.customFieldValues,
      })
      const result = await createDevice.mutateAsync(submissionData)

      if (result.messageType === 'error') {
        setErrorModalMessage(result.message)
        setShowErrorModal(true)
      } else {
        setStatusMessage({
          type: result.messageType,
          message: result.message,
        })

        if (result.success) {
          setTimeout(() => setStatusMessage(null), 3000)
        }
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Server className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Add Device to Nautobot
              </h1>
              <p className="text-muted-foreground mt-2">
                Add a new network device or bare metal server
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        isLoading={createDevice.isPending}
        onOpenCsvImport={() => csvImport.setShowModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      <form onSubmit={formHandleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <StatusAlert statusMessage={statusMessage} />

        <ErrorModal
          open={showErrorModal}
          onOpenChange={setShowErrorModal}
          message={errorModalMessage}
        />

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

        <PrefixConfiguration form={form} isLoading={createDevice.isPending} />

        <InterfaceList
          form={form}
          dropdownData={dropdownData}
          onOpenProperties={id => {
            const location = dropdownData.locations.find(
              l => l.id === watch('selectedLocation')
            )
            propertiesModal.openModal(id, location?.name)
          }}
          isLoading={createDevice.isPending}
        />

        <FormActions
          isLoading={createDevice.isPending}
          onClear={handleClearForm}
          onValidate={handleValidate}
        />

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

        <CsvImportWizard
          open={csvImport.showModal}
          onClose={csvImport.closeModal}
          step={csvImport.step}
          csvFile={csvImport.csvFile}
          isParsing={csvImport.isParsing}
          parseError={csvImport.parseError}
          delimiter={csvImport.delimiter}
          onDelimiterChange={csvImport.setDelimiter}
          importFormat={csvImport.importFormat}
          onImportFormatChange={csvImport.setImportFormat}
          onFileSelect={csvImport.handleFileSelect}
          headers={csvImport.headers}
          columnMapping={csvImport.columnMapping}
          onMappingChange={csvImport.setColumnMapping}
          unmappedMandatoryFields={csvImport.unmappedMandatoryFields}
          unmappedMandatoryInterfaceFields={csvImport.unmappedMandatoryInterfaceFields}
          defaults={csvImport.defaults}
          onDefaultsChange={csvImport.setDefaults}
          formDefaults={csvFormDefaults}
          dropdownData={dropdownData}
          prefixConfig={csvImport.prefixConfig}
          onPrefixConfigChange={csvImport.setPrefixConfig}
          applyFormTags={csvImport.applyFormTags}
          onApplyFormTagsChange={csvImport.setApplyFormTags}
          applyFormCustomFields={csvImport.applyFormCustomFields}
          onApplyFormCustomFieldsChange={csvImport.setApplyFormCustomFields}
          parseResult={csvImport.parseResult}
          dryRunErrors={csvImport.dryRunErrors}
          isDryRun={csvImport.isDryRun}
          dryRunCompleted={csvImport.dryRunCompleted}
          onDryRun={csvImport.runDryRun}
          importProgress={csvImport.importProgress}
          importSummary={csvImport.importSummary}
          onImport={csvImport.importDevices}
          onGoToStep={csvImport.goToStep}
          onReset={csvImport.reset}
        />
      </form>

      <ValidationErrorModal
        open={showValidationModal}
        onOpenChange={setShowValidationModal}
        errors={validationErrors}
      />

      <HelpModal open={showHelpModal} onOpenChange={setShowHelpModal} />

      <ValidationSummaryModal
        open={showValidationSummary}
        onOpenChange={setShowValidationSummary}
        results={validationResults}
      />
    </div>
  )
}
