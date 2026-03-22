'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useOnboardingData } from './hooks/use-onboarding-data'
import { useOnboardingForm } from './hooks/use-onboarding-form'
import { useJobTracking } from './hooks/use-job-tracking'
import { useCSVUpload } from './hooks/use-csv-upload'
import { ValidationMessage } from './components/validation-message'
import { DeviceSearchResults } from './components/device-search-results'
import { JobStatusDisplay } from './components/job-status-display'
import { PageHeader } from './steps/page-header'
import { HelpModal } from './steps/help-modal'
import { ConfirmationModal } from './steps/confirmation-modal'
import { FormSection } from './steps/form-section'
import { ModalsHost } from './steps/modals-host'
import type { StatusMessage, LocationItem, OnboardFormData, CSVLookupData } from './types'
import { useApi } from '@/hooks/use-api'

interface TagItem {
  id: string
  name: string
  color?: string
}

interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
}

interface DeviceSearchResult {
  id: string
  name: string
  device_type?: {
    display?: string
    manufacturer?: { name?: string }
  }
  status?: { name?: string; color?: string }
  location?: { name?: string }
  primary_ip4?: { address?: string }
}

const EMPTY_SEARCH_RESULTS: DeviceSearchResult[] = []

export function OnboardDevicePage() {
  // Load all dropdown data
  const {
    locations,
    namespaces,
    deviceRoles,
    platforms,
    deviceStatuses,
    interfaceStatuses,
    ipAddressStatuses,
    prefixStatuses,
    secretGroups,
    nautobotDefaults,
    isLoading: isLoadingData,
    loadData,
    getDefaultFormValues,
    getDefaultLocationDisplay
  } = useOnboardingData()

  // Form management
  const {
    formData,
    ipValidation,
    isValidatingIP,
    isSearchingDevice,
    updateFormData,
    handleIPChange,
    checkIPInNautobot,
    searchDevice,
    validateForm,
    // submitOnboarding - unused, using apiCall directly for Celery tasks
  } = useOnboardingForm()

  // Job tracking
  const {
    jobId,
    jobStatus,
    onboardedIPAddress,
    isCheckingJob,
    checkJob,
    // startTracking - unused, using Celery task tracking instead
    resetTracking
  } = useJobTracking()

  // CSV upload
  const csvUpload = useCSVUpload()

  // Local state
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>(EMPTY_SEARCH_RESULTS)
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')

  // Tags state
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [availableTags, setAvailableTags] = useState<TagItem[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  // Custom fields state
  const [showCustomFieldsModal, setShowCustomFieldsModal] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldChoices, setCustomFieldChoices] = useState<Record<string, string[]>>({})
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false)

  // Onboarding progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [onboardingTaskId, setOnboardingTaskId] = useState<string | null>(null)
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false)

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Network scan modal state
  const [showNetworkScanModal, setShowNetworkScanModal] = useState(false)

  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  // Track if we've initialized form defaults
  const hasInitialized = useRef(false)

  // API hook for Celery task submission
  const { apiCall } = useApi()

  // Load data on mount
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Apply defaults when nautobotDefaults loads
  useEffect(() => {
    if (!hasInitialized.current && !isLoadingData && nautobotDefaults) {
      hasInitialized.current = true

      // Set location display
      const display = getDefaultLocationDisplay(nautobotDefaults)
      if (display) {
        setLocationSearchValue(display)
      }

      // Set form defaults
      const defaults = getDefaultFormValues(nautobotDefaults)
      updateFormData(defaults)
    }
  }, [isLoadingData, nautobotDefaults, getDefaultLocationDisplay, getDefaultFormValues, updateFormData])

  // Perform the actual onboarding submission
  const performOnboarding = async () => {
    setIsSubmittingOnboard(true)

    try {
      // Prepare request body with form data, tags, and custom fields
      const requestBody = {
        ...formData,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined
      }

      // Submit to Celery task endpoint
      const response = await apiCall<{
        task_id: string
        status: string
        message: string
      }>('celery/tasks/onboard-device', {
        method: 'POST',
        body: requestBody
      })

      if (response.task_id) {
        // Show progress modal and start tracking
        setOnboardingTaskId(response.task_id)
        setShowProgressModal(true)
        setStatusMessage({
          type: 'success',
          message: `✅ Onboarding task started successfully!`
        })
      } else {
        setStatusMessage({
          type: 'error',
          message: '❌ Failed to start onboarding task: No task ID returned.'
        })
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      setStatusMessage({
        type: 'error',
        message: `❌ Failed to start onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSubmittingOnboard(false)
    }
  }

  // Handle form submission with confirmation check
  const handleSubmit = async () => {
    // Clear previous messages
    setStatusMessage(null)
    resetTracking()

    // Validate form
    const validation = validateForm()
    if (!validation.isValid) {
      setStatusMessage({ type: 'error', message: validation.message || 'Form validation failed' })
      return
    }

    // Check if tags or custom fields are missing
    const hasNoTags = selectedTags.length === 0
    const hasNoCustomFields = Object.keys(customFieldValues).length === 0

    if (hasNoTags && hasNoCustomFields) {
      // Show confirmation modal
      setShowConfirmationModal(true)
    } else {
      // Proceed with onboarding directly
      await performOnboarding()
    }
  }

  // Handle confirmation to start onboarding
  const handleConfirmOnboarding = async () => {
    setShowConfirmationModal(false)
    await performOnboarding()
  }

  // Handle abort onboarding
  const handleAbortOnboarding = () => {
    setShowConfirmationModal(false)
    setStatusMessage({
      type: 'info',
      message: 'Onboarding cancelled.'
    })
    // Clear message after 3 seconds
    setTimeout(() => {
      setStatusMessage(null)
    }, 3000)
  }

  // Handle device search
  const handleSearchDevice = async () => {
    if (!deviceSearchQuery.trim()) {
      setStatusMessage({ type: 'error', message: 'Please enter a device name to search.' })
      return
    }

    setStatusMessage(null)
    setSearchResults(EMPTY_SEARCH_RESULTS)

    try {
      const result = await searchDevice(deviceSearchQuery)
      setStatusMessage(result)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to search devices'
      })
    }
  }

  // Handle location selection
  const handleLocationSelect = (location: LocationItem) => {
    updateFormData({ location_id: location.id })
    setLocationSearchValue(location.hierarchicalPath || location.name)
  }

  // Wrapper for form field changes
  const handleFormFieldChange = (field: keyof OnboardFormData, value: string | number) => {
    updateFormData({ [field]: value })
  }

  // Handle IP check
  const handleCheckIP = async () => {
    setStatusMessage(null)
    try {
      const result = await checkIPInNautobot(formData.ip_address)
      setStatusMessage(result)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to check IP address'
      })
    }
  }

  // Handle sync option change
  const handleSyncOptionChange = useCallback((option: string, checked: boolean) => {
    updateFormData({
      sync_options: checked
        ? [...formData.sync_options, option]
        : formData.sync_options.filter(o => o !== option)
    })
  }, [formData.sync_options, updateFormData])

  // Toggle tag selection
  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
      return newTags
    })
  }, [])

  // Update custom field value
  const handleUpdateCustomField = useCallback((key: string, value: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  // Load tags for CSV upload (if not already loaded)
  const loadTagsForCSV = useCallback(async () => {
    if (availableTags.length === 0 && !isLoadingTags) {
      setIsLoadingTags(true)
      try {
        const tagsData = await apiCall<TagItem[]>('nautobot/tags/devices', { method: 'GET' })
        if (tagsData && Array.isArray(tagsData)) {
          setAvailableTags(tagsData)
        }
      } catch (error) {
        console.error('Error loading tags for CSV:', error)
      } finally {
        setIsLoadingTags(false)
      }
    }
  }, [apiCall, availableTags.length, isLoadingTags])

  // Open CSV modal and load tags
  const handleOpenCSVModal = useCallback(() => {
    csvUpload.openModal()
    loadTagsForCSV()
  }, [csvUpload, loadTagsForCSV])

  // Handle CSV bulk onboarding with lookup data for name-to-ID conversion
  const handleCSVUpload = useCallback(async (): Promise<string | null> => {
    // Use current form selections as defaults (user's choices in the UI)
    // These override the backend settings for CSV uploads
    const formDefaults: CSVLookupData['defaults'] = {
      location: formData.location_id,
      namespace: formData.namespace_id,
      device_role: formData.role_id,
      device_status: formData.status_id,
      platform: formData.platform_id,
      secret_group: formData.secret_groups_id,
      interface_status: formData.interface_status_id,
      ip_address_status: formData.ip_address_status_id,
      ip_prefix_status: formData.prefix_status_id,
      csv_delimiter: nautobotDefaults?.csv_delimiter || ',',
    }

    const lookupData: CSVLookupData = {
      locations,
      namespaces,
      deviceRoles,
      platforms,
      deviceStatuses,
      interfaceStatuses,
      ipAddressStatuses,
      prefixStatuses,
      secretGroups,
      availableTags: availableTags.map(tag => ({ id: tag.id, name: tag.name })),
      // Use form selections as defaults, fall back to backend settings
      defaults: formDefaults
    }
    return csvUpload.performBulkOnboarding(csvUpload.parsedData, lookupData)
  }, [
    csvUpload,
    formData,
    locations,
    namespaces,
    deviceRoles,
    platforms,
    deviceStatuses,
    interfaceStatuses,
    ipAddressStatuses,
    prefixStatuses,
    secretGroups,
    availableTags,
    nautobotDefaults,
  ])

  // Handle network scan IPs selection
  const handleNetworkScanIPsSelected = useCallback((ips: string[]) => {
    // Add IPs to the existing IP address field as comma-separated
    const currentIPs = formData.ip_address.trim()
    const newIPs = ips.join(', ')
    const combinedIPs = currentIPs ? `${currentIPs}, ${newIPs}` : newIPs

    updateFormData({ ip_address: combinedIPs })
    handleIPChange(combinedIPs)
  }, [formData.ip_address, updateFormData, handleIPChange])

  return (
    <div className="space-y-6">
      <PageHeader
        isLoadingData={isLoadingData}
        onScanNetwork={() => setShowNetworkScanModal(true)}
        onOpenCSVModal={handleOpenCSVModal}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      <HelpModal open={showHelpModal} onOpenChange={setShowHelpModal} />

      {/* Status Message */}
      {statusMessage && (
        <ValidationMessage
          message={statusMessage}
          className="animate-in fade-in slide-in-from-top-2"
          onDismiss={() => setStatusMessage(null)}
        />
      )}

      {/* Main Onboarding Form */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-slate-600">Loading configuration...</span>
        </div>
      ) : (
        <FormSection
          formData={formData}
          ipValidation={ipValidation}
          locations={locations}
          namespaces={namespaces}
          deviceRoles={deviceRoles}
          platforms={platforms}
          deviceStatuses={deviceStatuses}
          interfaceStatuses={interfaceStatuses}
          ipAddressStatuses={ipAddressStatuses}
          prefixStatuses={prefixStatuses}
          secretGroups={secretGroups}
          locationSearchValue={locationSearchValue}
          deviceSearchQuery={deviceSearchQuery}
          selectedTagsCount={selectedTags.length}
          isValidatingIP={isValidatingIP}
          isSearchingDevice={isSearchingDevice}
          isSubmittingOnboard={isSubmittingOnboard}
          onIPChange={handleIPChange}
          onFormDataChange={handleFormFieldChange}
          onSyncOptionChange={handleSyncOptionChange}
          onLocationSelect={handleLocationSelect}
          onCheckIP={handleCheckIP}
          onSearchDevice={handleSearchDevice}
          onDeviceSearchQueryChange={setDeviceSearchQuery}
          onShowTagsModal={() => setShowTagsModal(true)}
          onShowCustomFieldsModal={() => setShowCustomFieldsModal(true)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Device Search Results */}
      {searchResults.length > 0 && (
        <DeviceSearchResults results={searchResults} searchQuery={deviceSearchQuery} />
      )}

      {/* Job Status Display */}
      {jobId && (
        <JobStatusDisplay
          jobId={jobId}
          jobStatus={jobStatus}
          onboardedIPAddress={onboardedIPAddress}
          isCheckingJob={isCheckingJob}
          onCheckStatus={() => jobId && checkJob(jobId)}
        />
      )}

      <ConfirmationModal
        open={showConfirmationModal}
        onOpenChange={setShowConfirmationModal}
        onConfirm={handleConfirmOnboarding}
        onAbort={handleAbortOnboarding}
      />

      <ModalsHost
        csvUpload={csvUpload}
        onCSVUpload={handleCSVUpload}
        showTagsModal={showTagsModal}
        onTagsModalOpenChange={setShowTagsModal}
        selectedTags={selectedTags}
        availableTags={availableTags}
        isLoadingTags={isLoadingTags}
        onToggleTag={handleToggleTag}
        setAvailableTags={setAvailableTags}
        setIsLoadingTags={setIsLoadingTags}
        showCustomFieldsModal={showCustomFieldsModal}
        onCustomFieldsModalOpenChange={setShowCustomFieldsModal}
        customFieldValues={customFieldValues}
        customFields={customFields}
        customFieldChoices={customFieldChoices}
        isLoadingCustomFields={isLoadingCustomFields}
        onUpdateCustomField={handleUpdateCustomField}
        setCustomFields={setCustomFields}
        setCustomFieldChoices={setCustomFieldChoices}
        setIsLoadingCustomFields={setIsLoadingCustomFields}
        showProgressModal={showProgressModal}
        onProgressModalOpenChange={setShowProgressModal}
        onboardingTaskId={onboardingTaskId}
        ipAddress={formData.ip_address}
        showNetworkScanModal={showNetworkScanModal}
        onNetworkScanClose={() => setShowNetworkScanModal(false)}
        onNetworkScanIPsSelected={handleNetworkScanIPsSelected}
      />
    </div>
  )
}
