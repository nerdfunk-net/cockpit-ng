'use client'

import { useState, useCallback, useMemo } from 'react'
import { FieldErrors, useWatch } from 'react-hook-form'
import { Server, Loader2 } from 'lucide-react'

// TanStack Query Hooks
import { useNautobotDropdownsQuery, useDeviceMutations } from './hooks/queries'
import { useApi } from '@/hooks/use-api'

// Custom Hooks
import { useDeviceForm } from './hooks/use-device-form'
import { useSearchableDropdown } from './hooks/use-searchable-dropdown'
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { usePropertiesModal } from './hooks/use-properties-modal'
import { useCsvImport } from './hooks/use-csv-import'
import type { FormDefaults } from './hooks/use-csv-import'
import type { PrefixConfig } from './hooks/use-csv-import'

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
import type { ValidationResults } from './components'

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
import type {
  StatusMessage,
  LocationItem,
  DeviceType,
  SoftwareVersion,
  ParsedDevice,
  DeviceSubmissionData,
  InterfaceData,
  DeviceImportResult,
} from './types'
import type { DeviceFormValues } from './validation'

const DEFAULT_VALIDATION_RESULTS: ValidationResults = {
  isValid: true,
  deviceName: true,
  deviceRole: true,
  deviceStatus: true,
  deviceType: true,
  location: true,
  interfaceStatus: true,
  interfaceIssues: 0,
  ipAddresses: true,
  ipAddressIssues: 0,
}

export function AddDevicePage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState<string>('')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showValidationSummary, setShowValidationSummary] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationResults>(
    DEFAULT_VALIDATION_RESULTS
  )

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
  const { apiCall } = useApi()

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

  // Convert a parsed CSV device into the format the backend expects and submit it
  const handleImportDevice = useCallback(
    async (device: ParsedDevice, prefixConfig: PrefixConfig): Promise<DeviceImportResult> => {
      try {
        const interfaces: InterfaceData[] = device.interfaces.map(iface => ({
          id: crypto.randomUUID(),
          name: iface.name,
          type: iface.type || '',
          status: iface.status || '',
          enabled: iface.enabled,
          mgmt_only: iface.mgmt_only,
          description: iface.description,
          mac_address: iface.mac_address,
          mtu: iface.mtu,
          mode: iface.mode,
          untagged_vlan: iface.untagged_vlan,
          tagged_vlans: iface.tagged_vlans,
          parent_interface: iface.parent_interface,
          bridge: iface.bridge,
          lag: iface.lag,
          tags: iface.tags,
          ip_addresses: iface.ip_address
            ? [
                {
                  id: crypto.randomUUID(),
                  address: iface.ip_address,
                  namespace: iface.namespace || '',
                  ip_role: '',
                  is_primary: iface.is_primary_ipv4,
                },
              ]
            : [],
        }))

        const submissionData: DeviceSubmissionData = {
          name: device.name,
          serial: device.serial,
          role: device.role || '',
          status: device.status || '',
          location: device.location || '',
          device_type: device.device_type || '',
          platform: device.platform,
          software_version: device.software_version,
          tags: device.tags,
          custom_fields: device.custom_fields,
          interfaces,
          add_prefix: prefixConfig.addPrefix,
          default_prefix_length: prefixConfig.addPrefix ? prefixConfig.defaultPrefixLength : '',
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await apiCall<any>('nautobot/add-device', {
          method: 'POST',
          body: JSON.stringify(submissionData),
        })

        const success = response.success === true
        return {
          deviceName: device.name,
          status: success ? 'success' : 'error',
          message: success
            ? `Device "${device.name}" created successfully`
            : `Failed to create device "${device.name}": ${response.error ?? response.detail ?? response.message ?? 'Unknown error'}`,
          deviceId: response.device_id,
        }
      } catch (error) {
        return {
          deviceName: device.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    [apiCall]
  )

  // Build form defaults for CSV import wizard — useWatch creates reactive subscriptions
  const [selectedRole, selectedStatus, selectedLocation, selectedDeviceType, selectedPlatform] =
    useWatch({
      control: form.control,
      name: ['selectedRole', 'selectedStatus', 'selectedLocation', 'selectedDeviceType', 'selectedPlatform'],
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
    }
  }, [selectedRole, selectedStatus, selectedLocation, selectedDeviceType, selectedPlatform, dropdownData])

  // CSV Import wizard
  const csvImport = useCsvImport({
    nautobotDefaults: dropdownData.nautobotDefaults,
    formDefaults: csvFormDefaults,
    onImportDevice: handleImportDevice,
  })

  // Handle form validation errors
  const onInvalid = useCallback((validationErrors: FieldErrors<DeviceFormValues>) => {
    console.error('Form validation failed. All errors:', validationErrors)
    console.error('Interfaces errors:', validationErrors.interfaces)
    console.error('Is interfaces array?', Array.isArray(validationErrors.interfaces))

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
      console.error('Processing interface errors...')
      if (Array.isArray(validationErrors.interfaces)) {
        console.error(
          'Interface errors is an array with length:',
          validationErrors.interfaces.length
        )
        validationErrors.interfaces.forEach((interfaceError, index) => {
          console.error(`Interface ${index} error:`, interfaceError)

          if (!interfaceError) return

          // Iterate through all error fields in the interface
          Object.keys(interfaceError).forEach(fieldName => {
            const fieldError = interfaceError[fieldName as keyof typeof interfaceError]
            console.error(`Interface ${index} field '${fieldName}' error:`, fieldError)

            // Handle ip_addresses specially since it's an array
            if (fieldName === 'ip_addresses') {
              // Check if it's a root-level array error
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((fieldError as any)?.message) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                console.error(
                  `Interface ${index} has root ip_addresses message:`,
                  (fieldError as any).message
                )
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                errors.push(
                  `Interface ${index + 1} IP Addresses: ${(fieldError as any).message}`
                )
              }
              // Check individual IP address errors
              else if (Array.isArray(fieldError)) {
                console.error(
                  `Interface ${index} ip_addresses is array with length:`,
                  fieldError.length
                )
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fieldError.forEach((ipError: any, ipIndex: number) => {
                  console.error(`Interface ${index}, IP ${ipIndex} error:`, ipError)
                  if (ipError?.address) {
                    console.error(
                      `Interface ${index}, IP ${ipIndex} address error:`,
                      ipError.address.message
                    )
                    errors.push(
                      `Interface ${index + 1}, IP ${ipIndex + 1} Address: ${ipError.address.message}`
                    )
                  }
                  if (ipError?.namespace) {
                    console.error(
                      `Interface ${index}, IP ${ipIndex} namespace error:`,
                      ipError.namespace.message
                    )
                    errors.push(
                      `Interface ${index + 1}, IP ${ipIndex + 1} Namespace: ${ipError.namespace.message}`
                    )
                  }
                })
              }
            } else {
              // Handle all other field errors
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const message = (fieldError as any)?.message
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
        console.error('Interfaces has a message:', validationErrors.interfaces.message)
        errors.push(`Interfaces: ${validationErrors.interfaces.message}`)
      }
    }

    console.error('Collected errors:', errors)

    // Only show modal if there are actual errors
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidationModal(true)
    }
  }, [])

  // Handle manual validation
  const handleValidate = useCallback(() => {
    const values = form.getValues()

    const deviceName = !!values.deviceName?.trim()
    const deviceRole = !!values.selectedRole
    const deviceStatus = !!values.selectedStatus
    const deviceType = !!values.selectedDeviceType
    const location = !!values.selectedLocation

    const interfaces = values.interfaces || []
    let interfaceIssues = 0
    let allInterfacesValid = true
    let ipAddressIssues = 0
    let allIpAddressesValid = true

    const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/

    interfaces.forEach(iface => {
      if (!iface.name || !iface.name.trim()) {
        allInterfacesValid = false
        interfaceIssues++
      }
      if (!iface.type) {
        allInterfacesValid = false
        interfaceIssues++
      }
      if (!iface.status) {
        allInterfacesValid = false
        interfaceIssues++
      }

      const ipAddresses = iface.ip_addresses || []
      ipAddresses.forEach(ip => {
        if (!ip.address || !ip.address.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
          return
        }

        const isValidCidr =
          ipv4CidrRegex.test(ip.address) || ipv6CidrRegex.test(ip.address)
        if (!isValidCidr) {
          allIpAddressesValid = false
          ipAddressIssues++
        }

        if (!ip.namespace || !ip.namespace.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
        }
      })
    })

    const isValid =
      deviceName &&
      deviceRole &&
      deviceStatus &&
      deviceType &&
      location &&
      allInterfacesValid &&
      allIpAddressesValid

    setValidationResults({
      isValid,
      deviceName,
      deviceRole,
      deviceStatus,
      deviceType,
      location,
      interfaceStatus: allInterfacesValid,
      interfaceIssues,
      ipAddresses: allIpAddressesValid,
      ipAddressIssues,
    })

    setShowValidationSummary(true)
  }, [form])

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
          parseResult={csvImport.parseResult}
          dryRunErrors={csvImport.dryRunErrors}
          isDryRun={csvImport.isDryRun}
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
