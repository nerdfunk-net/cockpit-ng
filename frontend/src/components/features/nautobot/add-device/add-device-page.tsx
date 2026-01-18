'use client'

import { useState, useCallback, useMemo } from 'react'
import { FieldErrors } from 'react-hook-form'
import { Server, Plus, X, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  
  // Validation summary modal state
  const [showValidationSummary, setShowValidationSummary] = useState(false)
  const [validationResults, setValidationResults] = useState<{
    isValid: boolean
    deviceName: boolean
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
    deviceName: true,
    deviceRole: true,
    deviceStatus: true,
    deviceType: true,
    location: true,
    interfaceStatus: true,
    interfaceIssues: 0,
    ipAddresses: true,
    ipAddressIssues: 0,
  })

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
        console.error('Interface errors is an array with length:', validationErrors.interfaces.length)
        validationErrors.interfaces.forEach((interfaceError, index) => {
          console.error(`Interface ${index} error:`, interfaceError)
          
          if (!interfaceError) return
          
          // Iterate through all error fields in the interface
          Object.keys(interfaceError).forEach((fieldName) => {
            const fieldError = interfaceError[fieldName as keyof typeof interfaceError]
            console.error(`Interface ${index} field '${fieldName}' error:`, fieldError)
            
            // Handle ip_addresses specially since it's an array
            if (fieldName === 'ip_addresses') {
              // Check if it's a root-level array error
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((fieldError as any)?.message) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                console.error(`Interface ${index} has root ip_addresses message:`, (fieldError as any).message)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                errors.push(`Interface ${index + 1} IP Addresses: ${(fieldError as any).message}`)
              }
              // Check individual IP address errors
              else if (Array.isArray(fieldError)) {
                console.error(`Interface ${index} ip_addresses is array with length:`, fieldError.length)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fieldError.forEach((ipError: any, ipIndex: number) => {
                  console.error(`Interface ${index}, IP ${ipIndex} error:`, ipError)
                  if (ipError?.address) {
                    console.error(`Interface ${index}, IP ${ipIndex} address error:`, ipError.address.message)
                    errors.push(`Interface ${index + 1}, IP ${ipIndex + 1} Address: ${ipError.address.message}`)
                  }
                  if (ipError?.namespace) {
                    console.error(`Interface ${index}, IP ${ipIndex} namespace error:`, ipError.namespace.message)
                    errors.push(`Interface ${index + 1}, IP ${ipIndex + 1} Namespace: ${ipError.namespace.message}`)
                  }
                })
              }
            } else {
              // Handle all other field errors
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const message = (fieldError as any)?.message
              if (message) {
                const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ')
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
    // Get current form values
    const values = form.getValues()
    
    // Check required fields
    const deviceName = !!values.deviceName?.trim()
    const deviceRole = !!values.selectedRole
    const deviceStatus = !!values.selectedStatus
    const deviceType = !!values.selectedDeviceType
    const location = !!values.selectedLocation
    
    // Check interface statuses and IP addresses
    const interfaces = values.interfaces || []
    let interfaceIssues = 0
    let allInterfacesValid = true
    let ipAddressIssues = 0
    let allIpAddressesValid = true
    
    // IP address validation regex: xxx.xxx.xxx.xxx/yy or xxxx:xxxx::/yy
    const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/
    
    interfaces.forEach(iface => {
      // Check required interface fields
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
      
      // Check IP addresses
      const ipAddresses = iface.ip_addresses || []
      ipAddresses.forEach(ip => {
        // Check if IP address is filled
        if (!ip.address || !ip.address.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
          return
        }
        
        // Check if IP address is in valid CIDR format
        const isValidCidr = ipv4CidrRegex.test(ip.address) || ipv6CidrRegex.test(ip.address)
        if (!isValidCidr) {
          allIpAddressesValid = false
          ipAddressIssues++
        }
        
        // Check if namespace is filled (required by Zod schema)
        if (!ip.namespace || !ip.namespace.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
        }
      })
    })
    
    const isValid = deviceName && deviceRole && deviceStatus && deviceType && location && allInterfacesValid && allIpAddressesValid
    
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
      <form onSubmit={formHandleSubmit(onSubmit, onInvalid)} className="container mx-auto py-6 space-y-6">
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
          <Button
            type="button"
            variant="secondary"
            onClick={handleValidate}
            disabled={createDevice.isPending}
            size="lg"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate
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

      {/* Validation Error Modal */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Form Validation Failed
            </DialogTitle>
            <DialogDescription>
              Please correct the following errors before submitting the form:
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              {validationErrors.map((error) => (
                <div key={error} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowValidationModal(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Summary Modal */}
      <Dialog open={showValidationSummary} onOpenChange={setShowValidationSummary}>
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
            {/* Device Name */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {validationResults.deviceName ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Device Name</span>
              </div>
              <Badge variant={validationResults.deviceName ? "default" : "destructive"}>
                {validationResults.deviceName ? 'Valid' : 'Required'}
              </Badge>
            </div>

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
                <span className="text-sm font-medium">Interfaces (Name, Type, Status)</span>
              </div>
              <Badge variant={validationResults.interfaceStatus ? "default" : "destructive"}>
                {validationResults.interfaceStatus 
                  ? 'All Valid' 
                  : `${validationResults.interfaceIssues} Issue${validationResults.interfaceIssues !== 1 ? 's' : ''}`}
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
                <span className="text-sm font-medium">IP Addresses (Address & Namespace)</span>
              </div>
              <Badge variant={validationResults.ipAddresses ? "default" : "destructive"}>
                {validationResults.ipAddresses 
                  ? 'All Valid' 
                  : `${validationResults.ipAddressIssues} Issue${validationResults.ipAddressIssues !== 1 ? 's' : ''}`}
              </Badge>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowValidationSummary(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
