'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { FileUp, Plus, RefreshCw } from 'lucide-react'
import { useOnboardingData } from './hooks/use-onboarding-data'
import { useOnboardingForm } from './hooks/use-onboarding-form'
import { useJobTracking } from './hooks/use-job-tracking'
import { useCSVUpload } from './hooks/use-csv-upload'
import { OnboardingFormFields } from './components/onboarding-form-fields'
import { ValidationMessage } from './components/validation-message'
import { DeviceSearchResults } from './components/device-search-results'
import { JobStatusDisplay } from './components/job-status-display'
import { CSVUploadModal } from './components/csv-upload-modal'
import { TagsModal } from '@/components/shared/tags-modal'
import { CustomFieldsModal } from '@/components/shared/custom-fields-modal'
import { OnboardingProgressModal } from './components/onboarding-progress-modal'
import type { StatusMessage, LocationItem, OnboardFormData } from './types'
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

  // Handle form submission
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
  const handleCSVUpload = useCallback(() => {
    const lookupData = {
      locations,
      namespaces,
      deviceRoles,
      platforms,
      deviceStatuses,
      interfaceStatuses,
      ipAddressStatuses,
      prefixStatuses,
      secretGroups,
      availableTags: availableTags.map(tag => ({ id: tag.id, name: tag.name }))
    }
    csvUpload.performBulkOnboarding(csvUpload.parsedData, lookupData)
  }, [
    csvUpload,
    locations,
    namespaces,
    deviceRoles,
    platforms,
    deviceStatuses,
    interfaceStatuses,
    ipAddressStatuses,
    prefixStatuses,
    secretGroups,
    availableTags
  ])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Onboard Network Device</h1>
          <p className="text-slate-600 mt-2">
            Add new network devices to Nautobot and configure them for management
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleOpenCSVModal} disabled={isLoadingData}>
            <FileUp className="h-4 w-4 mr-2" />
            Bulk Upload CSV
          </Button>
        </div>
      </div>

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
        <>
          <OnboardingFormFields
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
            onIPChange={handleIPChange}
            onFormDataChange={handleFormFieldChange}
            onSyncOptionChange={handleSyncOptionChange}
            onLocationSelect={handleLocationSelect}
            onCheckIP={handleCheckIP}
            onSearchDevice={handleSearchDevice}
            onDeviceSearchQueryChange={setDeviceSearchQuery}
            onShowTagsModal={() => setShowTagsModal(true)}
            onShowCustomFieldsModal={() => setShowCustomFieldsModal(true)}
            isValidatingIP={isValidatingIP}
            isSearchingDevice={isSearchingDevice}
          />

          <div className="flex items-center space-x-4 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmittingOnboard || !ipValidation.isValid}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 text-sm"
            >
              {isSubmittingOnboard ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting Onboarding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Onboard Device
                </>
              )}
            </Button>
            <p className="text-sm text-slate-500">
              Required fields are marked with <span className="text-red-500">*</span>
            </p>
          </div>
        </>
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

      {/* CSV Upload Modal */}
      <CSVUploadModal
        open={csvUpload.showModal}
        onClose={csvUpload.closeModal}
        csvFile={csvUpload.csvFile}
        parsedData={csvUpload.parsedData}
        isParsing={csvUpload.isParsing}
        isUploading={csvUpload.isUploading}
        bulkResults={csvUpload.bulkResults}
        parseError={csvUpload.parseError}
        onFileSelect={csvUpload.parseCSV}
        onUpload={handleCSVUpload}
      />

      {/* Tags Modal */}
      <TagsModal
        open={showTagsModal}
        onOpenChange={setShowTagsModal}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
        availableTags={availableTags}
        setAvailableTags={setAvailableTags}
        isLoadingTags={isLoadingTags}
        setIsLoadingTags={setIsLoadingTags}
      />

      {/* Custom Fields Modal */}
      <CustomFieldsModal
        open={showCustomFieldsModal}
        onOpenChange={setShowCustomFieldsModal}
        customFieldValues={customFieldValues}
        onUpdateCustomField={handleUpdateCustomField}
        customFields={customFields}
        setCustomFields={setCustomFields}
        customFieldChoices={customFieldChoices}
        setCustomFieldChoices={setCustomFieldChoices}
        isLoadingCustomFields={isLoadingCustomFields}
        setIsLoadingCustomFields={setIsLoadingCustomFields}
      />

      {/* Onboarding Progress Modal */}
      <OnboardingProgressModal
        open={showProgressModal}
        onOpenChange={setShowProgressModal}
        taskId={onboardingTaskId}
        ipAddress={formData.ip_address}
      />
    </div>
  )
}
