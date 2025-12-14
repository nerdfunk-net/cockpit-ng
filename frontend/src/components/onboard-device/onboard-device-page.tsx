'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileUp, Plus, RefreshCw, HelpCircle, Search } from 'lucide-react'
import { useOnboardingData } from './hooks/use-onboarding-data'
import { useOnboardingForm } from './hooks/use-onboarding-form'
import { useJobTracking } from './hooks/use-job-tracking'
import { useCSVUpload } from './hooks/use-csv-upload'
import { OnboardingFormFields } from './components/onboarding-form-fields'
import { ValidationMessage } from './components/validation-message'
import { DeviceSearchResults } from './components/device-search-results'
import { JobStatusDisplay } from './components/job-status-display'
import { CSVUploadModal } from './components/csv-upload-modal'
import { NetworkScanModal } from './components/network-scan-modal'
import { TagsModal } from '@/components/shared/tags-modal'
import { CustomFieldsModal } from '@/components/shared/custom-fields-modal'
import { OnboardingProgressModal } from './components/onboarding-progress-modal'
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <Plus className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Onboard Network Device</h1>
            <p className="text-slate-600 mt-2">
              Add new network devices to Nautobot and configure them for management
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowNetworkScanModal(true)} disabled={isLoadingData}>
            <Search className="h-4 w-4 mr-2" />
            Scan Network
          </Button>
          <Button variant="outline" onClick={handleOpenCSVModal} disabled={isLoadingData}>
            <FileUp className="h-4 w-4 mr-2" />
            Bulk Upload CSV
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowHelpModal(true)}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Help Modal */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              Device Onboarding Help
            </DialogTitle>
            <DialogDescription>
              Learn how to onboard network devices to Nautobot
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 text-sm">
            {/* Overview */}
            <section>
              <h3 className="font-semibold text-base mb-2">What is Device Onboarding?</h3>
              <p className="text-muted-foreground">
                Device onboarding is the process of automatically discovering and adding network devices 
                to Nautobot. The system connects to devices via SSH, retrieves their configuration, 
                and creates the device record along with its interfaces, IP addresses, and network data.
              </p>
            </section>

            {/* Process */}
            <section>
              <h3 className="font-semibold text-base mb-2">Onboarding Process</h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Enter the device IP address(es) and select configuration options</li>
                <li>The system triggers Nautobot&apos;s &quot;Sync Devices From Network&quot; job</li>
                <li>Nautobot connects to the device via SSH using the specified credentials</li>
                <li>Device information is discovered (hostname, platform, interfaces, etc.)</li>
                <li>Tags and custom fields are applied to the new device</li>
                <li>Network data sync retrieves additional information (VLANs, VRFs, cables, software)</li>
              </ol>
            </section>

            {/* Network Scanning */}
            <section>
              <h3 className="font-semibold text-base mb-2">Network Scanning</h3>
              <p className="text-muted-foreground mb-2">
                Use the &quot;Scan Network&quot; button to discover reachable hosts before onboarding:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-sm">
                <li>Click &quot;Scan Network&quot; in the top right corner</li>
                <li>Enter one or more network addresses using CIDR notation (e.g., <code className="bg-muted px-1 rounded">192.168.1.0/24</code>)</li>
                <li>The system uses fping to quickly scan for reachable hosts</li>
                <li>Select the IP addresses you want to onboard from the results</li>
                <li>Click &quot;Add to Onboarding&quot; to populate the IP addresses field</li>
              </ol>
              <p className="text-muted-foreground text-sm mt-2">
                Note: Network scanning only checks host reachability via ping. It does not attempt device authentication.
              </p>
            </section>

            {/* Multiple IPs */}
            <section>
              <h3 className="font-semibold text-base mb-2">Multiple Device Onboarding</h3>
              <p className="text-muted-foreground">
                You can onboard multiple devices at once by entering comma-separated IP addresses
                (e.g., <code className="bg-muted px-1 rounded">192.168.1.1, 192.168.1.2, 192.168.1.3</code>).
                All devices will be onboarded with the same configuration settings.
              </p>
            </section>

            {/* Required Fields */}
            <section>
              <h3 className="font-semibold text-base mb-2">Required Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>IP Address(es)</strong> — Management IP of the device(s)</li>
                <li><strong>Location</strong> — Physical location in Nautobot hierarchy</li>
                <li><strong>Namespace</strong> — IP namespace for address management</li>
                <li><strong>Device Role</strong> — Function of the device (e.g., Router, Switch)</li>
                <li><strong>Device Status</strong> — Operational status (e.g., Active, Planned)</li>
                <li><strong>Secret Group</strong> — Credentials for SSH access</li>
                <li><strong>Interface Status</strong> — Default status for discovered interfaces</li>
                <li><strong>IP Address Status</strong> — Status for discovered IP addresses</li>
                <li><strong>Prefix Status</strong> — Status for discovered prefixes</li>
              </ul>
            </section>

            {/* Optional Features */}
            <section>
              <h3 className="font-semibold text-base mb-2">Optional Features</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Platform</strong> — Auto-detect or specify device OS (Cisco IOS, Junos, etc.)</li>
                <li><strong>Tags</strong> — Apply Nautobot tags to categorize devices</li>
                <li><strong>Custom Fields</strong> — Set custom field values for additional metadata</li>
                <li><strong>SSH Port</strong> — Non-standard SSH port (default: 22)</li>
                <li><strong>Timeout</strong> — Connection timeout in seconds (default: 30)</li>
              </ul>
            </section>

            {/* Sync Options */}
            <section>
              <h3 className="font-semibold text-base mb-2">Sync Options</h3>
              <p className="text-muted-foreground mb-2">
                After onboarding, additional network data can be synchronized:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Cables</strong> — Discover cable connections via LLDP/CDP</li>
                <li><strong>Software</strong> — Retrieve software version information</li>
                <li><strong>VLANs</strong> — Import VLAN configurations</li>
                <li><strong>VRFs</strong> — Import VRF routing instances</li>
              </ul>
            </section>

            {/* Bulk Upload */}
            <section>
              <h3 className="font-semibold text-base mb-2">Bulk CSV Upload</h3>
              <p className="text-muted-foreground">
                For onboarding many devices, use the &quot;Bulk Upload CSV&quot; feature. The CSV file 
                should contain columns for IP addresses and optionally override settings per device. 
                Supported columns include: <code className="bg-muted px-1 rounded">ipaddress</code>, 
                <code className="bg-muted px-1 rounded">location</code>, 
                <code className="bg-muted px-1 rounded">device_role</code>, 
                <code className="bg-muted px-1 rounded">tags</code> (semicolon-separated), 
                and custom fields with <code className="bg-muted px-1 rounded">cf_</code> prefix.
              </p>
            </section>

            {/* Supported Platforms */}
            <section>
              <h3 className="font-semibold text-base mb-2">Supported Platforms</h3>
              <p className="text-muted-foreground">
                The onboarding process supports devices that can be accessed via SSH and are compatible 
                with Nautobot&apos;s network automation. Common platforms include:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Cisco IOS', 'Cisco IOS-XE', 'Cisco NX-OS', 'Arista EOS', 'Juniper Junos', 
                  'Palo Alto PAN-OS', 'Linux', 'Fortinet FortiOS'].map(platform => (
                  <span key={platform} className="bg-muted px-2 py-1 rounded text-xs">
                    {platform}
                  </span>
                ))}
              </div>
            </section>

            {/* Tips */}
            <section className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <h3 className="font-semibold text-base mb-2 text-blue-900 dark:text-blue-100">💡 Tips</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200 text-xs">
                <li>Use &quot;Check IP&quot; to verify if an IP address already exists in Nautobot</li>
                <li>Use &quot;Device Name Search&quot; to check if a device name is already taken</li>
                <li>Platform auto-detection works for most common network devices</li>
                <li>Ensure the Secret Group has valid SSH credentials for the target devices</li>
                <li>For devices behind NAT, specify the correct reachable IP address</li>
              </ul>
            </section>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowHelpModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
        isSubmitting={csvUpload.isSubmitting}
        taskId={csvUpload.taskId}
        submitError={csvUpload.submitError}
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

      {/* Network Scan Modal */}
      <NetworkScanModal
        open={showNetworkScanModal}
        onClose={() => setShowNetworkScanModal(false)}
        onIPsSelected={handleNetworkScanIPsSelected}
      />
    </div>
  )
}
