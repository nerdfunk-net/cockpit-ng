'use client'

import { useState, useEffect, useRef } from 'react'
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
import type { StatusMessage, LocationItem, OnboardFormData } from './types'

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
    isSubmitting,
    isValidatingIP,
    isSearchingDevice,
    updateFormData,
    handleIPChange,
    checkIPInNautobot,
    searchDevice,
    validateForm,
    submitOnboarding
  } = useOnboardingForm()

  // Job tracking
  const {
    jobId,
    jobStatus,
    onboardedIPAddress,
    isCheckingJob,
    checkJob,
    startTracking,
    resetTracking
  } = useJobTracking()

  // CSV upload
  const csvUpload = useCSVUpload()

  // Local state
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>(EMPTY_SEARCH_RESULTS)
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')

  // Track if we've initialized form defaults
  const hasInitialized = useRef(false)

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

    try {
      const response = await submitOnboarding()
      setStatusMessage({
        type: 'success',
        message: 'Device onboarding initiated successfully!'
      })
      startTracking(response.job_id, formData.ip_address)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to onboard device'
      })
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
          <Button variant="outline" onClick={csvUpload.openModal} disabled={isLoadingData}>
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
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1.5 px-3">
          <div className="flex items-center space-x-1.5">
            <Plus className="h-3.5 w-3.5" />
            <div>
              <h3 className="text-xs font-semibold">Device Information</h3>
              <p className="text-blue-100 text-[10px]">Enter IP address and verify availability</p>
            </div>
          </div>
        </div>
        <div className="p-3 bg-white">
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
                secretGroups={secretGroups}
                locationSearchValue={locationSearchValue}
                deviceSearchQuery={deviceSearchQuery}
                onIPChange={handleIPChange}
                onFormDataChange={handleFormFieldChange}
                onLocationSelect={handleLocationSelect}
                onCheckIP={handleCheckIP}
                onSearchDevice={handleSearchDevice}
                onDeviceSearchQueryChange={setDeviceSearchQuery}
                isValidatingIP={isValidatingIP}
                isSearchingDevice={isSearchingDevice}
              />

              <div className="mt-4 flex items-center space-x-4 pt-4 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !ipValidation.isValid}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Onboarding Device...
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
        </div>
      </div>

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
        onUpload={csvUpload.performBulkOnboarding}
      />
    </div>
  )
}
