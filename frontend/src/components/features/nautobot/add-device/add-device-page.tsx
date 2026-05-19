'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { FieldErrors, useWatch } from 'react-hook-form'
import { Server, Loader2 } from 'lucide-react'

// TanStack Query Hooks
import {
  useNautobotDropdownsQuery,
  useDeviceMutations,
  useVirtualChassisQuery,
  useVirtualChassisDetailQuery,
} from './hooks/queries'

// Custom Hooks
import { useDeviceForm } from './hooks/use-device-form'
import { useSearchableDropdown } from './hooks/use-searchable-dropdown'
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { useRackManager } from './hooks/use-rack-manager'
import { useVirtualChassisManager } from './hooks/use-virtual-chassis-manager'
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
  PageHeader,
  FormActions,
} from './components'
import {
  InterfacePropertiesModal,
  TagsModal,
  CustomFieldsModal,
  RackModal,
  VirtualChassisModal,
  CsvImportWizard,
  ErrorModal,
  ValidationErrorModal,
  HelpModal,
  ValidationSummaryModal,
} from './dialogs'
import { buildLocationHierarchy, formatDeviceSubmissionData } from './utils'
import {
  EMPTY_DROPDOWN_OPTIONS,
  EMPTY_INTERFACE_TYPES,
  EMPTY_LOCATIONS,
  EMPTY_DEVICE_TYPES,
  EMPTY_SOFTWARE_VERSIONS,
  EMPTY_PLATFORMS,
  EMPTY_VIRTUAL_CHASSIS_LIST,
} from './constants'
import type { LocationItem, DeviceType, SoftwareVersion } from './types'
import type { DeviceFormValues } from './utils/validation'

export function AddDevicePage() {
  const { toast } = useToast()
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
  const rackManager = useRackManager()
  const vcManager = useVirtualChassisManager()
  const {
    data: virtualChassisList = EMPTY_VIRTUAL_CHASSIS_LIST,
    isLoading: isLoadingVirtualChassis,
  } = useVirtualChassisQuery()
  const { data: vcDetail } = useVirtualChassisDetailQuery(vcManager.selectedVcId)
  const propertiesModal = usePropertiesModal()

  // Keep selectedVirtualChassisId in form state so Zod can see it during validation.
  // When VC is selected, clear interfaces so the interfaceSchema field validations don't
  // fire on the default empty interface (Zod runs field schemas before superRefine).
  useEffect(() => {
    const id = vcManager.selectedVcId || undefined
    form.setValue('selectedVirtualChassisId', id)
    if (id) {
      form.setValue('interfaces', [])
    }
  }, [vcManager.selectedVcId, form])

  // Auto-populate Device Information fields from the master device of the selected VC.
  useEffect(() => {
    const master = vcDetail?.master
    if (!master) return

    if (master.role?.id) form.setValue('selectedRole', master.role.id)
    if (master.status?.id) form.setValue('selectedStatus', master.status.id)
    if (master.location?.id) form.setValue('selectedLocation', master.location.id)
    if (master.device_type?.id)
      form.setValue('selectedDeviceType', master.device_type.id)
    if (master.platform?.id) form.setValue('selectedPlatform', master.platform.id)
    if (master.software_version?.id)
      form.setValue('selectedSoftwareVersion', master.software_version.id)
  }, [vcDetail, form])

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

  // Form submission
  const onSubmit = useCallback(
    async (data: DeviceFormValues) => {
      toast({
        title: 'Adding device',
        description: 'Starting device addition workflow...',
      })

      form.setValue('selectedTags', tagsManager.selectedTags)
      form.setValue('customFieldValues', customFieldsManager.customFieldValues)

      const submissionData = formatDeviceSubmissionData({
        ...data,
        selectedTags: tagsManager.selectedTags,
        customFieldValues: customFieldsManager.customFieldValues,
        selectedRack: rackManager.selectedRack || undefined,
        selectedFace: rackManager.selectedFace || undefined,
        rackPosition: rackManager.position !== '' ? rackManager.position : undefined,
        selectedVirtualChassisId: vcManager.selectedVcId || undefined,
        newVirtualChassisName: vcManager.newVcName.trim() || undefined,
      })
      const result = await createDevice.mutateAsync(submissionData)

      if (result.messageType === 'error') {
        setErrorModalMessage(result.message)
        setShowErrorModal(true)
      } else {
        toast({
          title: result.success ? 'Device added' : 'Warning',
          description: result.message,
          variant: 'default',
        })
      }
    },
    [
      createDevice,
      form,
      tagsManager,
      customFieldsManager,
      rackManager,
      vcManager,
      toast,
    ]
  )

  const handleUseDefaults = useCallback(() => {
    const defaults = dropdownData.nautobotDefaults
    if (!defaults) return

    if (defaults.device_role) form.setValue('selectedRole', defaults.device_role)
    if (defaults.device_status) form.setValue('selectedStatus', defaults.device_status)
    if (defaults.location) form.setValue('selectedLocation', defaults.location)
    if (defaults.platform) form.setValue('selectedPlatform', defaults.platform)

    const interfaces = form.getValues('interfaces')
    const firstInterface = interfaces[0]
    if (firstInterface) {
      if (defaults.interface_status)
        form.setValue('interfaces.0.status', defaults.interface_status)
      if (defaults.namespace && firstInterface.ip_addresses.length > 0)
        form.setValue('interfaces.0.ip_addresses.0.namespace', defaults.namespace)
    }

    toast({ title: 'Defaults applied', description: 'Default values loaded from settings.' })
  }, [dropdownData.nautobotDefaults, form, toast])

  const handleClearForm = useCallback(() => {
    reset()
    tagsManager.clearSelectedTags()
    customFieldsManager.clearFieldValues()
    rackManager.clearRack()
    vcManager.clearSelection()
  }, [reset, tagsManager, customFieldsManager, rackManager, vcManager])

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
        onUseDefaults={handleUseDefaults}
        hasDefaults={!!dropdownData.nautobotDefaults}
      />

      <form onSubmit={formHandleSubmit(onSubmit, onInvalid)} className="space-y-6">
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
          onOpenStack={vcManager.openModal}
          isStackConfigured={vcManager.isConfigured}
          onOpenRack={() =>
            rackManager.openModal(watch('selectedLocation') || undefined)
          }
          selectedTagsCount={tagsManager.selectedTags.length}
          isRackConfigured={rackManager.isConfigured}
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

        <RackModal
          show={rackManager.showModal}
          onClose={rackManager.closeModal}
          availableRacks={rackManager.availableRacks}
          availableRackGroups={rackManager.availableRackGroups}
          availablePositions={rackManager.availablePositions}
          selectedRackGroup={rackManager.selectedRackGroup}
          onSelectRackGroup={rackManager.setSelectedRackGroup}
          selectedRack={rackManager.selectedRack}
          onSelectRack={rackManager.setSelectedRack}
          selectedFace={rackManager.selectedFace}
          onSelectFace={face =>
            rackManager.setSelectedFace(face as 'front' | 'rear' | '')
          }
          position={rackManager.position}
          onSetPosition={rackManager.setPosition}
          isLoading={rackManager.isLoading}
        />

        <VirtualChassisModal
          show={vcManager.showModal}
          onClose={vcManager.closeModal}
          items={virtualChassisList}
          isLoading={isLoadingVirtualChassis}
          selectedVcId={vcManager.selectedVcId}
          newVcName={vcManager.newVcName}
          mode={vcManager.mode}
          onSelect={vcManager.selectVirtualChassis}
          onNewVcNameChange={vcManager.updateNewVcName}
          onClear={vcManager.clearSelection}
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
