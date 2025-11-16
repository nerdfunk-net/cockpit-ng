'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw, Search, Eye, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle, AlertCircle, Info, Plus, ChevronDown, BarChart3, Download } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'

interface Device {
  id: string
  name: string
  role: string
  status: string
  location: string
  checkmk_status: string
  diff?: string
  normalized_config?: {
    folder?: string
    attributes?: Record<string, unknown>
  }
  checkmk_config?: {
    folder?: string
    attributes?: Record<string, unknown>
    effective_attributes?: Record<string, unknown> | null
    is_cluster?: boolean
    is_offline?: boolean
    cluster_nodes?: unknown[] | null
  }
  result_data?: Record<string, unknown>
  error_message?: string
  processed_at?: string
}

interface NautobotDeviceRecord {
  id?: string
  name?: string
  role?: { name?: string } | null
  status?: { name?: string } | null
  location?: { name?: string } | null
  primary_ip4?: { address?: string } | null
  device_type?: { model?: string } | null
}

interface JobResult {
  id: string
  type: string
  status: string
  started_at: string
  created_at: string
  processed_devices: number
  progress?: {
    processed: number
    total: number
  }
}

interface DeviceResult {
  id?: number
  job_id?: string
  device_name: string
  device?: string
  status: string
  result_data?: {
    data?: {
      result?: unknown
      normalized_config?: {
        folder?: string
        attributes?: Record<string, unknown>
      }
      checkmk_config?: {
        folder?: string
        attributes?: Record<string, unknown>
        effective_attributes?: Record<string, unknown> | null
        is_cluster?: boolean
        is_offline?: boolean
        cluster_nodes?: unknown[] | null
      }
      diff?: string
    }
    comparison_result?: unknown
    status?: string
    normalized_config?: {
      folder?: string
      attributes?: Record<string, unknown>
    }
    checkmk_config?: {
      folder?: string
      attributes?: Record<string, unknown>
      effective_attributes?: Record<string, unknown> | null
      is_cluster?: boolean
      is_offline?: boolean
      cluster_nodes?: unknown[] | null
    }
    diff?: string
  }
  error_message?: string
  processed_at?: string
  role?: { name: string } | string
  location?: { name: string } | string
  device_type?: { model: string }
  primary_ip4?: { address: string }
  device_status?: { name: string }
  device_id?: string
}

interface AttributeConfig {
  site?: string
}

// Helper function to extract site value from device configuration
const getSiteFromDevice = (device: Device, defaultSite: string = 'cmk'): string => {
  // First try to get site from normalized_config.attributes.site
  const normalizedSite = (device.normalized_config?.attributes as AttributeConfig)?.site
  if (normalizedSite) {
    return normalizedSite
  }
  
  // Then try checkmk_config.attributes.site
  const checkmkSite = (device.checkmk_config?.attributes as AttributeConfig)?.site
  if (checkmkSite) {
    return checkmkSite
  }
  
  // If no site found, return the default site
  return defaultSite
}

const EMPTY_IGNORED_ATTRIBUTES: string[] = []

// Helper function to render config comparison
const renderConfigComparison = (nautobot: { attributes?: Record<string, unknown> }, checkmk: { attributes?: Record<string, unknown> }, ignoredAttributes: string[] = EMPTY_IGNORED_ATTRIBUTES) => {
  const allKeys = new Set([
    ...Object.keys(nautobot?.attributes || {}),
    ...Object.keys(checkmk?.attributes || {})
  ])

  return Array.from(allKeys).map(key => {
    const nautobotValue = nautobot?.attributes?.[key]
    const checkmkValue = checkmk?.attributes?.[key]
    const isDifferent = JSON.stringify(nautobotValue) !== JSON.stringify(checkmkValue)
    const nautobotMissing = nautobotValue === undefined
    const checkmkMissing = checkmkValue === undefined
    const isIgnored = ignoredAttributes.includes(key)

    return {
      key,
      nautobotValue,
      checkmkValue,
      isDifferent,
      nautobotMissing,
      checkmkMissing,
      isIgnored
    }
  })
}

// Helper to format value for display
const formatValue = (value: unknown): string => {
  if (value === undefined) return '(missing)'
  if (value === null) return '(null)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function CheckMKSyncDevicesPage() {
  const { token } = useAuthStore()
  const { apiCall } = useApi()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [addingDevices, setAddingDevices] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    status: '',
    location: '',
    site: '',
    checkmk_status: ''
  })
  const [checkmkStatusFilters, setCheckmkStatusFilters] = useState({
    equal: true,
    diff: true,
    missing: true
  })
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({})
  const [locationFilters, setLocationFilters] = useState<Record<string, boolean>>({})
  const [siteFilters, setSiteFilters] = useState<Record<string, boolean>>({})
  const [defaultSite, setDefaultSite] = useState<string>('cmk')
  const [selectedDeviceForView, setSelectedDeviceForView] = useState<Device | null>(null)
  const [selectedDeviceForDiff, setSelectedDeviceForDiff] = useState<Device | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)

  // Add device confirmation modal state
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  
  // Job results state
  const [availableJobs, setAvailableJobs] = useState<Array<{id: string, status: string, created_at: string, processed_devices: number}>>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [loadingResults, setLoadingResults] = useState(false)
  const [isReloadingDevices, setIsReloadingDevices] = useState(false)

  // Background job state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const [jobProgress, setJobProgress] = useState<{
    processed: number
    total: number
    message: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  } | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // Show status message helper
  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ type, message: text })
    setShowStatusModal(true)
    // Auto-hide after 3 seconds for success and info
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setStatusMessage(null)
        setShowStatusModal(false)
      }, 3000)
    }
  }

  // Add device confirmation handlers
  const handleAddDeviceConfirmation = (device: Device) => {
    setDeviceToAdd(device)
    setShowAddDeviceModal(true)
  }

  const handleAddDeviceCancel = () => {
    setShowAddDeviceModal(false)
    setDeviceToAdd(null)
  }

  // Sync device function from live-update-page.tsx
  const handleSync = async (device: Device) => {
    try {
      showMessage(`Syncing ${device.name}...`, 'info')

      const response = await apiCall(`nb2cmk/device/${device.id}/update`, {
        method: 'POST'
      })

      if (response) {
        showMessage(`Successfully synced ${device.name} in CheckMK`, 'success')
        // Update device status to 'equal' since it's now synced
        setDevices(prevDevices =>
          prevDevices.map(d =>
            d.id === device.id
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
      } else {
        showMessage(`Failed to sync ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync device'

      // Check if it's a 404 error (device not found in CheckMK)
      if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
        // Ask user if they want to add the device to CheckMK
        handleAddDeviceConfirmation(device)
      } else {
        showMessage(`Failed to sync ${device.name}: ${message}`, 'error')
      }
    }
  }

  const handleAddDeviceFromModal = async (device: Device) => {
    try {
      setIsAddingDevice(true)
      showMessage(`Adding ${device.name} to CheckMK...`, 'info')

      const response = await apiCall(`nb2cmk/device/${device.id}/add`, {
        method: 'POST'
      })

      if (response) {
        showMessage(`Successfully added ${device.name} to CheckMK`, 'success')
        setShowAddDeviceModal(false) // Close the modal
        setDeviceToAdd(null)
        // Update device status to 'equal' since it's now added
        setDevices(prevDevices =>
          prevDevices.map(d =>
            d.id === device.id
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
      } else {
        showMessage(`Failed to add ${device.name} to CheckMK`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add device'
      showMessage(`Failed to add ${device.name}: ${message}`, 'error')
    } finally {
      setIsAddingDevice(false)
    }
  }

  // Job persistence functions
  const saveJobStateToStorage = (jobId: string | null, isRunning: boolean) => {
    if (jobId) {
      localStorage.setItem('nb2cmk_current_job_id', jobId)
      localStorage.setItem('nb2cmk_is_job_running', isRunning.toString())
    } else {
      localStorage.removeItem('nb2cmk_current_job_id')
      localStorage.removeItem('nb2cmk_is_job_running')
    }
  }

  const loadJobStateFromStorage = () => {
    const savedJobId = localStorage.getItem('nb2cmk_current_job_id')
    const savedIsRunning = localStorage.getItem('nb2cmk_is_job_running') === 'true'
    return { savedJobId, savedIsRunning }
  }

  // Fetch available completed jobs from backend
  const fetchAvailableJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/jobs/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Filter only completed Device Comparison jobs with device results
        const completedJobs = data.jobs.filter((job: JobResult) =>
          job.status === 'completed' && 
          job.type === 'device-comparison' &&
          (job.progress?.processed || 0) > 0
        ).map((job: JobResult) => ({
          id: job.id,
          status: job.status,
          created_at: job.started_at,
          processed_devices: job.progress?.processed || 0
        }))
        setAvailableJobs(completedJobs)
      }
    } catch (error) {
      console.error('Error fetching available jobs:', error)
    }
  }, [token])

  const loadJobResults = async () => {
    if (!selectedJobId || !token || selectedJobId === 'no-jobs') return
    
    setLoadingResults(true)
    try {
      const response = await fetch(`/api/proxy/jobs/${selectedJobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        console.log('=== CHECKMK JOB RESULT DEBUG ===')
        console.log('RAW API RESPONSE:', data)
        console.log('Full job result:', data.job)
        console.log('Device results count:', data.job?.device_results?.length || 0)
        if (data.job?.device_results && data.job.device_results.length > 0) {
          console.log('First device result sample:', data.job.device_results[0])
          console.log('Device result keys:', Object.keys(data.job.device_results[0]))
          
          // Check for enhanced data
          const firstDevice = data.job.device_results[0]
          console.log('Enhanced data check:')
          console.log('  - role:', firstDevice.role, typeof firstDevice.role)
          console.log('  - location:', firstDevice.location, typeof firstDevice.location) 
          console.log('  - device_status:', firstDevice.device_status, typeof firstDevice.device_status)
          console.log('  - primary_ip4:', firstDevice.primary_ip4, typeof firstDevice.primary_ip4)
          console.log('  - result_data:', firstDevice.result_data, typeof firstDevice.result_data)
          if (firstDevice.result_data) {
            console.log('  - result_data keys:', Object.keys(firstDevice.result_data))
            console.log('  - result_data.data?.result:', firstDevice.result_data.data?.result)
            console.log('  - result_data.comparison_result:', firstDevice.result_data.comparison_result)
            console.log('  - result_data.status:', firstDevice.result_data.status)
          }
        }
        console.log('=== END DEBUG ===')
        
        // Extract device results from the new job format
        const deviceResults = data.job?.device_results || []
        // Convert device results to the expected devices format
        const devices = deviceResults.map((result: DeviceResult, index: number) => ({
          id: result.device_id || result.device_name || `device_${index}`, // Use device UUID as ID, fallback to device name or index
          name: result.device_name || result.device || `device_${index}`, // Use device name for display, fallback to device UUID
          role: (typeof result.role === 'object' && result.role?.name) || result.role || 'Unknown', // Extract name from object or use string directly
          status: result.device_status?.name || result.status || 'Unknown', // Use device_status for device status, fallback to job status
          location: (typeof result.location === 'object' && result.location?.name) || result.location || 'Unknown', // Extract name from object or use string directly
          result_data: result.result_data,
          error_message: result.error_message,
          processed_at: result.processed_at,
          checkmk_status: result.result_data?.data?.result || result.result_data?.comparison_result || result.result_data?.status || 'unknown', // Extract result from data.result
          // Extract normalized_config and checkmk_config from result_data
          normalized_config: result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
          checkmk_config: result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
          diff: result.result_data?.data?.diff || result.result_data?.diff
        }))
        
        console.log('Converted devices sample:', devices[0])
        console.log('Converted device keys:', devices.length > 0 ? Object.keys(devices[0]) : 'No devices')
        setDevices(devices)
        setStatusMessage({
          type: 'success',
          message: `Loaded ${devices.length} device comparison results from job ${selectedJobId.slice(0, 8)}...`
        })
        setShowStatusModal(true)
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({
          type: 'error',
          message: `Failed to load job results: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error loading job results:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error loading job results'
      })
      setShowStatusModal(true)
    } finally {
      setLoadingResults(false)
    }
  }

  const handleReloadDevices = async () => {
    try {
      setIsReloadingDevices(true)

      const data = await apiCall<{ devices?: NautobotDeviceRecord[] }>('nautobot/devices?reload=true')

      if (!data?.devices) {
        throw new Error('Invalid response format')
      }

      const reloadedDevices: Device[] = data.devices.map((device, index) => ({
        id: device.id || device.name || `device_${index}`,
        name: device.name || device.id || `Device ${index + 1}`,
        role: device.role?.name || 'Unknown',
        status: device.status?.name || 'Unknown',
        location: device.location?.name || 'Unknown',
        checkmk_status: 'missing',
        diff: undefined,
        normalized_config: undefined,
        checkmk_config: undefined,
        result_data: undefined,
        error_message: undefined,
        processed_at: undefined
      }))

      setDevices(reloadedDevices)
      setSelectedDevices(new Set())
      setFilters({
        name: '',
        role: '',
        status: '',
        location: '',
        site: '',
        checkmk_status: ''
      })
      setCheckmkStatusFilters({ equal: true, diff: true, missing: true })
      setRoleFilters({})
      setStatusFilters({})
      setLocationFilters({})
      setSiteFilters({})
      setSelectedDeviceForView(null)
      setSelectedDeviceForDiff(null)
      setCurrentJobId(null)
      setIsJobRunning(false)
      setJobProgress(null)
      saveJobStateToStorage(null, false)
      setSelectedJobId('')

      showMessage(`Reloaded ${reloadedDevices.length} devices directly from Nautobot`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload devices'
      showMessage(`Failed to reload devices: ${message}`, 'error')
    } finally {
      setIsReloadingDevices(false)
    }
  }

  // Fetch default site from backend
  const fetchDefaultSite = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/nb2cmk/get_default_site', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDefaultSite(data.default_site || 'cmk')
      }
    } catch (error) {
      console.error('Error fetching default site:', error)
      // Keep default value 'cmk' if fetch fails
    }
  }, [token])

  // Load job state and default site when component mounts
  useEffect(() => {
    if (token) {
      fetchDefaultSite()
      fetchAvailableJobs() // Fetch available job results
      
      // Load previous job state from localStorage
      const { savedJobId, savedIsRunning } = loadJobStateFromStorage()
      if (savedJobId) {
        setCurrentJobId(savedJobId)
        setIsJobRunning(savedIsRunning)
        
        // Check if the job is still actually running by getting its current status
        // Do this after a short delay to ensure the component is fully loaded
        const checkJobStatus = async () => {
          try {
            const response = await fetch(`/api/proxy/nb2cmk/job/${savedJobId}/progress`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const data = await response.json()
              const jobStillRunning = data.status === 'running' || data.status === 'pending'
              setIsJobRunning(jobStillRunning)
              saveJobStateToStorage(savedJobId, jobStillRunning)
              
              setJobProgress({
                processed: data.processed_devices,
                total: data.total_devices,
                message: data.progress_message,
                status: data.status
              })
              
              // If completed, silently load results
              if (data.status === 'completed') {
                const resultResponse = await fetch(`/api/proxy/jobs/${savedJobId}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                
                if (resultResponse.ok) {
                  const resultData = await resultResponse.json()
                  
                  console.log('=== CHECKMK useEffect storage load DEBUG ===')
                  if (resultData.job?.device_results && resultData.job.device_results.length > 0) {
                    console.log('First device result from storage load:', resultData.job.device_results[0])
                    const firstDevice = resultData.job.device_results[0]
                    console.log('Enhanced data in useEffect storage load:')
                    console.log('  - role:', firstDevice.role, typeof firstDevice.role)
                    console.log('  - location:', firstDevice.location, typeof firstDevice.location) 
                    console.log('  - device_status:', firstDevice.device_status, typeof firstDevice.device_status)
                  }
                  console.log('=== END useEffect storage load DEBUG ===')
                  
                  // Extract device results from the new job format and convert to expected format
                  const deviceResults = resultData.job?.device_results || []
                  const devices = deviceResults.map((result: DeviceResult, index: number) => ({
                    id: result.device_id || result.device_name || `device_${index}`, // Use device UUID as ID, fallback to device name or index
                    name: result.device_name,
                    role: (typeof result.role === 'object' && result.role?.name) || result.role || 'Unknown', // Extract name from object or use string directly
                    status: result.device_status?.name || result.status || 'Unknown', // Use device_status for device status
                    location: (typeof result.location === 'object' && result.location?.name) || result.location || 'Unknown', // Extract name from object or use string directly
                    result_data: result.result_data,
                    error_message: result.error_message,
                    processed_at: result.processed_at,
                    checkmk_status: result.result_data?.data?.result || result.result_data?.comparison_result || result.result_data?.status || 'unknown' // Extract result from data.result
                  }))
                  
                  console.log('Converted devices in useEffect storage load sample:', devices[0])
                  setDevices(devices)
                }
              }
            }
          } catch (error) {
            console.error('Error checking restored job status:', error)
          }
        }
        
        setTimeout(checkJobStatus, 100)
      }
    }
  }, [token, fetchAvailableJobs, fetchDefaultSite])

  // Auto-check progress for running jobs every 5 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (currentJobId && isJobRunning) {
      interval = setInterval(() => {
        handleGetProgress(currentJobId, true) // Silent check
      }, 5000)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, isJobRunning]) // handleGetProgress is stable due to useCallback

  // Extract unique roles and statuses from the current device data
  const availableRoles = useMemo(() => {
    const roles = new Set(devices.map(device => device.role).filter(Boolean))
    return Array.from(roles).sort()
  }, [devices])

  const availableStatuses = useMemo(() => {
    const statuses = new Set(devices.map(device => device.status).filter(Boolean))
    return Array.from(statuses).sort()
  }, [devices])

  const availableLocations = useMemo(() => {
    const locations = new Set(devices.map(device => device.location).filter(Boolean))
    return Array.from(locations).sort()
  }, [devices])

  const availableSites = useMemo(() => {
    const sites = new Set(devices.map(device => getSiteFromDevice(device, defaultSite)).filter(Boolean))
    return Array.from(sites).sort()
  }, [devices, defaultSite])

  // Initialize filters when available roles/statuses change
  useEffect(() => {
    if (availableRoles.length > 0) {
      setRoleFilters(prev => {
        const newFilters = { ...prev }
        availableRoles.forEach(role => {
          if (!(role in newFilters)) {
            newFilters[role] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableRoles])

  useEffect(() => {
    if (availableStatuses.length > 0) {
      setStatusFilters(prev => {
        const newFilters = { ...prev }
        availableStatuses.forEach(status => {
          if (!(status in newFilters)) {
            newFilters[status] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableStatuses])

  useEffect(() => {
    if (availableLocations.length > 0) {
      setLocationFilters(prev => {
        const newFilters = { ...prev }
        availableLocations.forEach(location => {
          if (!(location in newFilters)) {
            newFilters[location] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableLocations])

  useEffect(() => {
    if (availableSites.length > 0) {
      setSiteFilters(prev => {
        const newFilters = { ...prev }
        availableSites.forEach(site => {
          if (!(site in newFilters)) {
            newFilters[site] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableSites])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(filteredDevices.map(device => device.id)))
    } else {
      setSelectedDevices(new Set())
    }
  }

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices)
    if (checked) {
      newSelected.add(deviceId)
    } else {
      newSelected.delete(deviceId)
    }
    setSelectedDevices(newSelected)
  }

  // Background job functions
  // Start new device comparison job using the APScheduler service
  const startNewJob = async () => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }
    
    try {
      // Start a complete device comparison job that processes ALL devices
      const response = await fetch('/api/proxy/jobs/compare-devices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Empty devices list means "process all devices"
          devices: [],
          max_concurrent: 3  // Default concurrency for device processing
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Job started:', result)
        setStatusMessage({
          type: 'success',
          message: `Device comparison job started with ID: ${result.job_id}`
        })
        setShowStatusModal(true)
        
        // Refresh available jobs list
        fetchAvailableJobs()
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const error = await response.json()
        console.error('Error starting job:', error)
        setStatusMessage({
          type: 'error',
          message: `Failed to start job: ${error.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error starting job:', error)
      setStatusMessage({
        type: 'error',
        message: 'Failed to start job: Network error'
      })
      setShowStatusModal(true)
    }
  }

  const handleGetProgress = useCallback(async (jobId?: string, silent = false) => {
    const targetJobId = jobId || currentJobId
    
    if (!targetJobId || !token) {
      if (!silent) {
        setStatusMessage({ type: 'error', message: 'No active job found' })
        setShowStatusModal(true)
      }
      return
    }

    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${targetJobId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const newProgress = {
          processed: data.processed_devices,
          total: data.total_devices,
          message: data.progress_message,
          status: data.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
        }
        
        setJobProgress(newProgress)
        
        // Update job running state and save to storage
        const jobStillRunning = data.status === 'running' || data.status === 'pending'
        
        setIsJobRunning(jobStillRunning)
        saveJobStateToStorage(targetJobId, jobStillRunning)
        
        // If this is not a silent check, show the modal
        if (!silent) {
          setShowProgressModal(true)
        }
        
        // If job is completed and we have results, we can automatically load them
        if (data.status === 'completed' && devices.length === 0) {
          // Silently load the results
          handleViewDiff(targetJobId, true)
        }
      } else {
        const errorData = await response.json()
        if (!silent) {
          setStatusMessage({
            type: 'error',
            message: `Failed to get job progress: ${errorData.detail || 'Unknown error'}`
          })
          setShowStatusModal(true)
        }
      }
    } catch (error) {
      console.error('Error getting job progress:', error)
      if (!silent) {
        setStatusMessage({
          type: 'error',
          message: 'Error getting job progress'
        })
        setShowStatusModal(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, token, devices.length, saveJobStateToStorage]) // handleViewDiff would cause circular dependency

  const handleViewDiff = async (jobId?: string, silent = false) => {
    const targetJobId = jobId || currentJobId
    
    if (!targetJobId || !token) {
      if (!silent) {
        setStatusMessage({ type: 'error', message: 'No completed job found' })
        setShowStatusModal(true)
      }
      return
    }

    try {
      const response = await fetch(`/api/proxy/jobs/${targetJobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        console.log('=== CHECKMK handleViewDiff DEBUG ===')
        console.log('Full job result:', data.job)
        if (data.job?.device_results && data.job.device_results.length > 0) {
          console.log('First device result sample:', data.job.device_results[0])
          const firstDevice = data.job.device_results[0]
          console.log('Enhanced data in handleViewDiff:')
          console.log('  - role:', firstDevice.role, typeof firstDevice.role)
          console.log('  - location:', firstDevice.location, typeof firstDevice.location) 
          console.log('  - device_status:', firstDevice.device_status, typeof firstDevice.device_status)
        }
        console.log('=== END handleViewDiff DEBUG ===')
        
        // Extract device results from the new job format and convert to expected format
        const deviceResults = data.job?.device_results || []
        const devices = deviceResults.map((result: DeviceResult, index: number) => ({
          id: result.device_id || result.device_name || `device_${index}`, // Use device UUID as ID, fallback to device name or index
          name: result.device_name,
          role: (typeof result.role === 'object' && result.role?.name) || result.role || 'Unknown', // Extract name from object or use string directly
          status: result.device_status?.name || result.status || 'Unknown', // Use device_status for device status
          location: (typeof result.location === 'object' && result.location?.name) || result.location || 'Unknown', // Extract name from object or use string directly
          result_data: result.result_data,
          error_message: result.error_message,
          processed_at: result.processed_at,
          checkmk_status: result.result_data?.data?.result || result.result_data?.comparison_result || result.result_data?.status || 'unknown', // Extract result from data.result
          // Extract normalized_config and checkmk_config from result_data
          normalized_config: result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
          checkmk_config: result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
          diff: result.result_data?.data?.diff || result.result_data?.diff
        }))
        
        console.log('Converted devices in handleViewDiff sample:', devices[0])
        setDevices(devices)
        
        if (!silent) {
          setStatusMessage({
            type: 'success',
            message: `Loaded ${data.devices?.length || 0} device comparison results`
          })
          setShowStatusModal(true)
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setStatusMessage(null)
            setShowStatusModal(false)
          }, 3000)
        }
      } else {
        const errorData = await response.json()
        if (!silent) {
          setStatusMessage({
            type: 'error',
            message: `Failed to get job results: ${errorData.detail || 'Unknown error'}`
          })
          setShowStatusModal(true)
        }
      }
    } catch (error) {
      console.error('Error getting job results:', error)
      if (!silent) {
        setStatusMessage({
          type: 'error',
          message: 'Error getting job results'
        })
        setShowStatusModal(true)
      }
    }
  }

  const handleSyncDevices = async () => {
    if (selectedDevices.size === 0) {
      setStatusMessage({
        type: 'error',
        message: 'Please select devices to sync'
      })
      setShowStatusModal(true)
      return
    }

    if (!token) {
      setStatusMessage({
        type: 'error',
        message: 'Authentication required'
      })
      setShowStatusModal(true)
      return
    }

    try {
      const selectedDeviceList = Array.from(selectedDevices)
      const selectedDeviceData = devices.filter(device => selectedDeviceList.includes(device.id))
      const deviceNames = selectedDeviceData.map(device => device.name)

      setStatusMessage({
        type: 'info',
        message: `Syncing ${selectedDevices.size} devices: ${deviceNames.join(', ')}...`
      })
      setShowStatusModal(true)

      let syncedCount = 0
      let errorCount = 0
      const syncErrors: string[] = []

      // Sync each device individually
      for (const deviceId of selectedDeviceList) {
        const device = devices.find(d => d.id === deviceId)
        if (!device) continue


        try {
          const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/update`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            syncedCount++
            // Update device status to 'equal' since it's now synced
            setDevices(prevDevices => 
              prevDevices.map(d => 
                d.id === device.id 
                  ? { ...d, checkmk_status: 'equal' }
                  : d
              )
            )
          } else {
            const errorData = await response.json()
            errorCount++
            syncErrors.push(`${device.name}: ${errorData.detail || 'Unknown error'}`)
          }
        } catch (error) {
          errorCount++
          const message = error instanceof Error ? error.message : 'Unknown error'
          
          // Check if it's a 404 error (device not found in CheckMK)
          if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
            syncErrors.push(`${device.name}: Device not found in CheckMK (use Add instead of Sync)`)
          } else {
            syncErrors.push(`${device.name}: ${message}`)
          }
        }
      }

      // Clear selection after sync attempt
      setSelectedDevices(new Set())

      // Show final result
      if (syncedCount > 0 && errorCount === 0) {
        setStatusMessage({
          type: 'success',
          message: `Successfully synced all ${syncedCount} selected devices`
        })
      } else if (syncedCount > 0 && errorCount > 0) {
        setStatusMessage({
          type: 'warning',
          message: `Synced ${syncedCount} devices, ${errorCount} failed. Errors: ${syncErrors.join('; ')}`
        })
      } else {
        setStatusMessage({
          type: 'error',
          message: `Failed to sync devices. Errors: ${syncErrors.join('; ')}`
        })
      }
      setShowStatusModal(true)

      // Auto-hide success message after 5 seconds
      if (syncedCount > 0) {
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 5000)
      }

    } catch (error) {
      console.error('Error syncing devices:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error syncing devices'
      })
      setShowStatusModal(true)
    }
  }

  const handleAddDevice = async (device: Device) => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    // Add device to loading set
    setAddingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setStatusMessage({ 
          type: 'success', 
          message: `Successfully added ${result.hostname} to CheckMK`
        })
        setShowStatusModal(true)
        
        // Update device status to 'equal' since it's now added
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.id === device.id 
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to add device: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error adding device:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error adding device to CheckMK'
      })
      setShowStatusModal(true)
    } finally {
      // Remove device from loading set
      setAddingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  // Filter devices based on column filters
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Check CheckMK status checkbox filters
      const hasAnyCheckmkStatusFilter = checkmkStatusFilters.equal || checkmkStatusFilters.diff || checkmkStatusFilters.missing
      const checkmkStatusMatch = hasAnyCheckmkStatusFilter && (
        (checkmkStatusFilters.equal && device.checkmk_status === 'equal') ||
        (checkmkStatusFilters.diff && device.checkmk_status === 'diff') ||
        (checkmkStatusFilters.missing && (device.checkmk_status === 'missing' || device.checkmk_status === 'host_not_found'))
      )
      
      // Check role checkbox filters
      const roleMatch = Object.keys(roleFilters).length === 0 || roleFilters[device.role] === true
      
      // Check status checkbox filters
      const statusMatch = Object.keys(statusFilters).length === 0 || statusFilters[device.status] === true
      
      // Check location checkbox filters
      const locationMatch = Object.keys(locationFilters).length === 0 || locationFilters[device.location] === true
      
      // Check site checkbox filters
      const deviceSite = getSiteFromDevice(device, defaultSite)
      const siteMatch = Object.keys(siteFilters).length === 0 || siteFilters[deviceSite] === true
      
      return (
        device.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        roleMatch &&
        statusMatch &&
        locationMatch &&
        siteMatch &&
        checkmkStatusMatch
      )
    })
  }, [devices, filters, checkmkStatusFilters, roleFilters, statusFilters, locationFilters, siteFilters, defaultSite])

  // Pagination logic (use filtered devices)
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentDevices = filteredDevices.slice(startIndex, endIndex)

  // Reset to first page when filters change
  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }))
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setFilters({
      name: '',
      role: '',
      status: '',
      location: '',
      site: '',
      checkmk_status: ''
    })
    setCheckmkStatusFilters({
      equal: true,
      diff: true,
      missing: true
    })
    // Reset role filters to all true
    const resetRoleFilters = availableRoles.reduce((acc: Record<string, boolean>, role: string) => {
      acc[role] = true
      return acc
    }, {})
    setRoleFilters(resetRoleFilters)
    // Reset status filters to all true
    const resetStatusFilters = availableStatuses.reduce((acc: Record<string, boolean>, status: string) => {
      acc[status] = true
      return acc
    }, {})
    setStatusFilters(resetStatusFilters)
    // Reset location filters to all true
    const resetLocationFilters = availableLocations.reduce((acc: Record<string, boolean>, location: string) => {
      acc[location] = true
      return acc
    }, {})
    setLocationFilters(resetLocationFilters)
    // Reset site filters to all true
    const resetSiteFilters = availableSites.reduce((acc: Record<string, boolean>, site: string) => {
      acc[site] = true
      return acc
    }, {})
    setSiteFilters(resetSiteFilters)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (newSize: string) => {
    setItemsPerPage(parseInt(newSize))
    setCurrentPage(1)
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'staged':
        return <Badge variant="outline">Staged</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getCheckMKStatusBadge = (checkmkStatus: string | undefined) => {
    if (!checkmkStatus) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
    switch (checkmkStatus.toLowerCase()) {
      case 'equal':
        return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>
      case 'diff':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Different</Badge>
      case 'host_not_found':
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>
      case 'error':
        return <Badge variant="secondary">Error</Badge>
      case 'unknown':
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">{checkmkStatus}</Badge>
    }
  }

  // Always render the full interface - don't show separate loading page

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
          <p className="text-gray-600 mt-1">Compare and synchronize devices between Nautobot and CheckMK</p>
        </div>
      </div>


      {/* Main Content */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">CheckMK Device Comparison</h3>
                <p className="text-blue-100 text-xs">Compare Nautobot devices with CheckMK hosts</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-white hover:bg-white/20 text-xs h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReloadDevices}
                className="text-white hover:bg-white/20 text-xs h-6"
                disabled={isReloadingDevices}
              >
                {isReloadingDevices ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Load Devices
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {/* Filters Row */}
          <div className="bg-gray-50 border-b">
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <tr>
                    {/* Empty cell for checkbox column */}
                    <td className="pl-4 pr-2 py-3 w-8 text-left"></td>

                    {/* Device Name Filter */}
                    <td className="pl-4 pr-2 py-3 w-48">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Device Name</Label>
                        <Input
                          placeholder="Filter by name..."
                          value={filters.name}
                          onChange={(e) => handleFilterChange('name', e.target.value)}
                          className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                        />
                      </div>
                    </td>

                    {/* Role Filter */}
                    <td className="px-4 py-3 w-32">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Role</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Role Filter
                              {Object.values(roleFilters).filter(Boolean).length < availableRoles.length && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(roleFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 hover:bg-red-50"
                              onSelect={() => {
                                const resetRoleFilters = availableRoles.reduce((acc: Record<string, boolean>, role: string) => {
                                  acc[role] = false
                                  return acc
                                }, {})
                                setRoleFilters(resetRoleFilters)
                                setCurrentPage(1)
                              }}
                            >
                              Deselect all
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableRoles.map((role) => (
                              <DropdownMenuCheckboxItem
                                key={role}
                                checked={roleFilters[role] || false}
                                onCheckedChange={(checked) =>
                                  setRoleFilters(prev => ({ ...prev, [role]: !!checked }))
                                }
                              >
                                {role}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                    {/* Status Filter */}
                    <td className="px-4 py-3 w-28">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Status</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Status Filter
                              {Object.values(statusFilters).filter(Boolean).length < availableStatuses.length && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(statusFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 hover:bg-red-50"
                              onSelect={() => {
                                const resetStatusFilters = availableStatuses.reduce((acc: Record<string, boolean>, status: string) => {
                                  acc[status] = false
                                  return acc
                                }, {})
                                setStatusFilters(resetStatusFilters)
                                setCurrentPage(1)
                              }}
                            >
                              Deselect all
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableStatuses.map((status) => (
                              <DropdownMenuCheckboxItem
                                key={status}
                                checked={statusFilters[status] || false}
                                onCheckedChange={(checked) =>
                                  setStatusFilters(prev => ({ ...prev, [status]: !!checked }))
                                }
                              >
                                {status}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                    {/* Location Filter */}
                    <td className="px-4 py-3 w-40">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Location</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Location Filter
                              {Object.values(locationFilters).filter(Boolean).length < availableLocations.length && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(locationFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">Filter by Location</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 hover:bg-red-50"
                              onSelect={() => {
                                const resetLocationFilters = availableLocations.reduce((acc: Record<string, boolean>, location: string) => {
                                  acc[location] = false
                                  return acc
                                }, {})
                                setLocationFilters(resetLocationFilters)
                                setCurrentPage(1)
                              }}
                            >
                              Deselect all
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableLocations.map((location) => (
                              <DropdownMenuCheckboxItem
                                key={location}
                                checked={locationFilters[location] || false}
                                onCheckedChange={(checked) =>
                                  setLocationFilters(prev => ({ ...prev, [location]: !!checked }))
                                }
                              >
                                {location}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                    {/* CheckMK Status Filter */}
                    <td className="px-4 py-3 w-32">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">CheckMK Status</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Status Filter
                              {Object.values(checkmkStatusFilters).filter(Boolean).length < 3 && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(checkmkStatusFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                              checked={checkmkStatusFilters.equal}
                              onCheckedChange={(checked) =>
                                setCheckmkStatusFilters(prev => ({ ...prev, equal: !!checked }))
                              }
                            >
                              Equal
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={checkmkStatusFilters.diff}
                              onCheckedChange={(checked) =>
                                setCheckmkStatusFilters(prev => ({ ...prev, diff: !!checked }))
                              }
                            >
                              Diff
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={checkmkStatusFilters.missing}
                              onCheckedChange={(checked) =>
                                setCheckmkStatusFilters(prev => ({ ...prev, missing: !!checked }))
                              }
                            >
                              Missing
                            </DropdownMenuCheckboxItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                    {/* Empty cell for actions column */}
                    <td className="px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="pl-4 pr-2 py-3 w-8 text-left">
                    <Checkbox
                      checked={currentDevices.length > 0 && currentDevices.every(device => selectedDevices.has(device.id))}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
                  <th className="px-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 w-28 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="pl-12 pr-4 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
                  <th className="pl-12 pr-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">CheckMK</th>
                  <th className="pl-16 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">{devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No devices found. Select a job from the dropdown above and click &ldquo;Load&rdquo; to view comparison results.
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No devices match the current filters.
                    </td>
                  </tr>
                ) : (
                  currentDevices.map((device, index) => (
                    <tr key={device.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="pl-4 pr-2 py-3 w-8 text-left">
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={(checked) => 
                            handleSelectDevice(device.id, checked as boolean)
                          }
                        />
                      </td>
                      <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-gray-900">
                        {device.name}
                      </td>
                      <td className="px-4 py-3 w-32 text-sm text-gray-600">
                        {device.role}
                      </td>
                      <td className="px-4 py-3 w-28 text-sm text-gray-600">
                        {getStatusBadge(device.status)}
                      </td>
                      <td className="pl-12 pr-4 py-3 w-40 text-sm text-gray-600">
                        {device.location}
                      </td>
                      <td className="pl-12 pr-4 py-3 w-32">
                        {getCheckMKStatusBadge(device.checkmk_status)}
                      </td>
                      <td className="pl-16 pr-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Eye Button - Always visible for diff comparison */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDeviceForDiff(device)}
                            title="Show device comparison"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Sync Device Button - Always visible next to View button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(device)}
                            title="Sync Device"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>

                          {/* Add Button - Only for missing devices */}
                          {device.checkmk_status === 'missing' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddDevice(device)}
                              disabled={addingDevices.has(device.id)}
                              title="Add device to CheckMK"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            >
                              {addingDevices.has(device.id) ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDevices.length)} of {filteredDevices.length} devices
                {filteredDevices.length !== devices.length && (
                  <span className="text-gray-500"> (filtered from {devices.length} total)</span>
                )}
              </span>
              <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">per page</span>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2)
                const pageNum = startPage + i
                if (pageNum > totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum}
                  </Button>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Device Comparison Job Controls */}
          <div className="bg-blue-50 p-4 border-t border-blue-200">
            <div className="flex items-center gap-4">
              <Button
                onClick={startNewJob}
                className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Start Device Comparison Job
              </Button>
              <p className="text-sm text-gray-600">
                Start a new comprehensive device comparison job that processes all devices
              </p>
            </div>
          </div>

          {/* Job Results Selection */}
          <div className="bg-gray-50 p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Label className="text-sm font-medium text-gray-700">Load Job Results:</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="h-10 text-sm min-w-[300px]">
                    <SelectValue placeholder="Select a completed job to load results..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {new Date(job.created_at).toLocaleDateString()} - {job.processed_devices} devices ({job.id.slice(0, 8)}...)
                      </SelectItem>
                    ))}
                    {availableJobs.length === 0 && (
                      <SelectItem value="no-jobs" disabled>No completed jobs found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={loadJobResults} 
                  disabled={!selectedJobId || selectedJobId === 'no-jobs' || loadingResults}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                >
                  {loadingResults ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Load Results
                </Button>
                <Button 
                  onClick={fetchAvailableJobs} 
                  variant="outline"
                  size="sm"
                  title="Refresh Job List"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Jobs
                </Button>
              </div>
            </div>
          </div>

          {/* Device Actions */}
          <div className="bg-white p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {selectedDevices.size > 0 && (
                  <span>{selectedDevices.size} device(s) selected</span>
                )}
                {selectedJobId && devices.length > 0 && (
                  <span className="ml-4 text-blue-600">
                    Showing results from job: {selectedJobId.slice(0, 8)}...
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSyncDevices}
                  disabled={selectedDevices.size === 0}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync Devices ({selectedDevices.size})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Device Dialog */}
      <Dialog open={!!selectedDeviceForView} onOpenChange={(open) => !open && setSelectedDeviceForView(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Device Details: {selectedDeviceForView?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Device Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> {selectedDeviceForView?.name}</div>
                <div><strong>Role:</strong> {selectedDeviceForView?.role}</div>
                <div><strong>Status:</strong> {selectedDeviceForView?.status}</div>
                <div><strong>Location:</strong> {selectedDeviceForView?.location}</div>
                <div><strong>CheckMK Status:</strong> {selectedDeviceForView && getCheckMKStatusBadge(selectedDeviceForView.checkmk_status)}</div>
                <div><strong>Processed At:</strong> {selectedDeviceForView?.processed_at ? new Date(selectedDeviceForView.processed_at).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
            
            {selectedDeviceForView?.error_message && (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Error Message</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded text-sm text-red-800">
                  {selectedDeviceForView.error_message}
                </div>
              </div>
            )}
            
            {selectedDeviceForView?.result_data && (
              <div>
                <h3 className="font-semibold mb-2">Job Result Details</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(selectedDeviceForView.result_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Message Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {statusMessage?.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
              {statusMessage?.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {statusMessage?.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
              {statusMessage?.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
              <span>
                {statusMessage?.type === 'error' ? 'Error' :
                 statusMessage?.type === 'success' ? 'Success' :
                 statusMessage?.type === 'warning' ? 'Warning' :
                 'Information'}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{statusMessage?.message}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Diff Dialog */}
      <Dialog open={!!selectedDeviceForDiff} onOpenChange={(open) => {
        if (!open) setSelectedDeviceForDiff(null);
        if (open && selectedDeviceForDiff) {
          console.log('=== DIFF MODAL DEBUG ===', {
            device: selectedDeviceForDiff,
            normalized_config: selectedDeviceForDiff.normalized_config,
            checkmk_config: selectedDeviceForDiff.checkmk_config,
            diff: selectedDeviceForDiff.diff,
            result_data: selectedDeviceForDiff.result_data
          });
        }
      }}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ resize: 'both', minWidth: '800px', minHeight: '500px' }}>
          <DialogHeader>
            <DialogTitle>
              Device Comparison - {selectedDeviceForDiff?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {selectedDeviceForDiff ? (
              <div className="space-y-4">
                {/* Header with status */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Generated: {selectedDeviceForDiff.processed_at ? new Date(selectedDeviceForDiff.processed_at).toLocaleString() : 'Now'}
                  </div>
                  <Badge 
                    variant={selectedDeviceForDiff.checkmk_status === 'equal' ? 'default' : 'secondary'}
                    className={
                      selectedDeviceForDiff.checkmk_status === 'equal' ? 'bg-green-100 text-green-800' : 
                      selectedDeviceForDiff.checkmk_status === 'missing' || selectedDeviceForDiff.checkmk_status === 'host_not_found' ? 'bg-red-100 text-red-800' :
                      'bg-orange-100 text-orange-800'
                    }
                  >
                    {selectedDeviceForDiff.checkmk_status === 'equal' ? '✓ Configs Match' : 
                     selectedDeviceForDiff.checkmk_status === 'missing' || selectedDeviceForDiff.checkmk_status === 'host_not_found' ? '❌ Host Not Found in CheckMK' :
                     '⚠ Differences Found'}
                  </Badge>
                </div>

                {/* Handle host not found case */}
                {(selectedDeviceForDiff.checkmk_status === 'missing' || selectedDeviceForDiff.checkmk_status === 'host_not_found') ? (
                  <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                    <div className="text-center">
                      <div className="text-red-600 text-lg mb-3">🚫 Host Not Found</div>
                      <p className="text-red-800 mb-4">{selectedDeviceForDiff.error_message || 'This device exists in Nautobot but has not been synchronized to CheckMK yet.'}</p>
                      
                      <div className="bg-white rounded-lg p-4 border border-red-200 text-left">
                        <h4 className="font-semibold mb-2 text-red-800">Expected Configuration (Nautobot)</h4>
                        <div className="space-y-2 text-sm">
                          {selectedDeviceForDiff.normalized_config && (
                            <>
                              <div><strong>Folder:</strong> <code className="bg-red-100 px-2 py-1 rounded">{selectedDeviceForDiff.normalized_config.folder || 'N/A'}</code></div>
                              <div><strong>Attributes:</strong></div>
                              <pre className="bg-red-100 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                                {JSON.stringify(selectedDeviceForDiff.normalized_config.attributes || {}, null, 2)}
                              </pre>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-red-700 text-sm mt-4">
                        Use the Add button to create this host in CheckMK.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Folder Comparison */}
                    {selectedDeviceForDiff.normalized_config && selectedDeviceForDiff.checkmk_config && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-3">Folder Configuration</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-medium text-blue-600 mb-1">Nautobot (Expected)</div>
                            <div className="bg-blue-50 p-2 rounded text-sm font-mono">
                              {selectedDeviceForDiff.normalized_config?.folder || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-purple-600 mb-1">CheckMK (Actual)</div>
                            <div className="bg-purple-50 p-2 rounded text-sm font-mono">
                              {selectedDeviceForDiff.checkmk_config?.folder || '(not found)'}
                            </div>
                          </div>
                        </div>
                        {selectedDeviceForDiff.normalized_config?.folder !== selectedDeviceForDiff.checkmk_config?.folder && (
                          <div className="mt-2 text-xs text-orange-600">⚠ Folder paths differ</div>
                        )}
                      </div>
                    )}

                    {/* Attributes Comparison */}
                    {selectedDeviceForDiff.normalized_config && selectedDeviceForDiff.checkmk_config && (
                      <div className="bg-white border rounded-lg">
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <h4 className="font-semibold">Attributes Comparison</h4>
                          <div className="text-xs text-gray-600 mt-1">Side-by-side comparison of device attributes</div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b bg-gray-25">
                                <th className="text-left p-3 font-medium text-gray-700 w-48">Attribute</th>
                                <th className="text-left p-3 font-medium text-blue-600 w-1/3">Nautobot (Expected)</th>
                                <th className="text-left p-3 font-medium text-purple-600 w-1/3">CheckMK (Actual)</th>
                                <th className="text-left p-3 font-medium text-gray-700 w-32">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderConfigComparison(
                                selectedDeviceForDiff.normalized_config,
                                selectedDeviceForDiff.checkmk_config,
                                [] // No ignored attributes available in this context
                              ).map(({ key, nautobotValue, checkmkValue, isDifferent, nautobotMissing, checkmkMissing, isIgnored }) => (
                                <tr 
                                  key={key} 
                                  className={`border-b transition-colors ${
                                    isIgnored
                                      ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200'
                                      : nautobotMissing || checkmkMissing || isDifferent 
                                        ? 'bg-red-50 hover:bg-red-100 border-red-200' 
                                        : 'bg-green-50 hover:bg-green-100 border-green-200'
                                  }`}
                                >
                                  <td className="p-3 font-mono text-sm font-medium w-48">{key}</td>
                                  <td className={`p-3 text-sm w-1/3 ${nautobotMissing ? 'text-gray-400 italic' : ''}`}>
                                    <div className="bg-blue-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                      <pre className="whitespace-pre-wrap break-words">
                                        {formatValue(nautobotValue)}
                                      </pre>
                                    </div>
                                  </td>
                                  <td className={`p-3 text-sm w-1/3 ${checkmkMissing ? 'text-gray-400 italic' : ''}`}>
                                    <div className="bg-purple-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                      <pre className="whitespace-pre-wrap break-words">
                                        {formatValue(checkmkValue)}
                                      </pre>
                                    </div>
                                  </td>
                                  <td className="p-3 text-xs">
                                    {isIgnored ? (
                                      <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-100">Ignored</Badge>
                                    ) : nautobotMissing ? (
                                      <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Only in CheckMK</Badge>
                                    ) : checkmkMissing ? (
                                      <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Missing in CheckMK</Badge>
                                    ) : isDifferent ? (
                                      <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Different</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-green-700 border-green-400 bg-green-100">Equal</Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Fallback: Show raw data if structured comparison is not available */}
                    {(!selectedDeviceForDiff.normalized_config || !selectedDeviceForDiff.checkmk_config) && (
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <h4 className="font-semibold mb-2 text-yellow-800">Raw Comparison Data</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>Status:</strong> {selectedDeviceForDiff.checkmk_status}
                          </div>
                          {selectedDeviceForDiff.result_data && (
                            <div>
                              <strong>Result Data:</strong>
                              <pre className="bg-white p-3 rounded text-xs font-mono overflow-auto max-h-40 mt-1">
                                {JSON.stringify(selectedDeviceForDiff.result_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CheckMK Additional Info */}
                    {selectedDeviceForDiff.checkmk_config && (
                      selectedDeviceForDiff.checkmk_config.is_cluster || 
                      selectedDeviceForDiff.checkmk_config.is_offline || 
                      selectedDeviceForDiff.checkmk_config.cluster_nodes
                    ) && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-purple-800">CheckMK Additional Information</h4>
                        <div className="space-y-1 text-sm">
                          <div>Is Cluster: {selectedDeviceForDiff.checkmk_config.is_cluster ? 'Yes' : 'No'}</div>
                          <div>Is Offline: {selectedDeviceForDiff.checkmk_config.is_offline ? 'Yes' : 'No'}</div>
                          {selectedDeviceForDiff.checkmk_config.cluster_nodes && (
                            <div>Cluster Nodes: {JSON.stringify(selectedDeviceForDiff.checkmk_config.cluster_nodes)}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Raw diff text fallback */}
                    {selectedDeviceForDiff.diff && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-gray-800">Raw Differences</h4>
                        <pre className="bg-white p-3 rounded text-xs font-mono overflow-auto max-h-40 border">
                          {selectedDeviceForDiff.diff}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No diff data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span>Job Progress</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {jobProgress && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <Badge 
                      variant={
                        jobProgress.status === 'completed' ? 'default' : 
                        jobProgress.status === 'running' ? 'secondary' :
                        jobProgress.status === 'failed' ? 'destructive' :
                        'outline'
                      }
                    >
                      {jobProgress.status.charAt(0).toUpperCase() + jobProgress.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Progress:</span>
                    <span>{jobProgress.processed} of {jobProgress.total} devices</span>
                  </div>
                  
                  {/* Progress Bar */}
                  {jobProgress.total > 0 && (
                    <div className="space-y-1">
                      <Progress 
                        value={(jobProgress.processed / jobProgress.total) * 100}
                        className="w-full"
                      />
                      <div className="text-xs text-center text-gray-500">
                        {Math.round((jobProgress.processed / jobProgress.total) * 100)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Progress Message */}
                  {jobProgress.message && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      {jobProgress.message}
                    </div>
                  )}
                  
                  {/* Job ID */}
                  {currentJobId && (
                    <div className="text-xs text-gray-500 font-mono">
                      Job ID: {currentJobId}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex space-x-2 pt-2">
                  {jobProgress.status === 'completed' && (
                    <Button 
                      onClick={() => {
                        setShowProgressModal(false)
                        handleViewDiff()
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  )}
                  <Button 
                    onClick={() => setShowProgressModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Device Confirmation Modal */}
      <Dialog open={showAddDeviceModal} onOpenChange={(open) => !open && handleAddDeviceCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Device Not Found in CheckMK</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The device <strong>{deviceToAdd?.name}</strong> was not found in CheckMK.
              Would you like to add it to CheckMK?
            </p>
            <div className="flex items-center justify-end space-x-2">
              <Button
                variant="outline"
                onClick={handleAddDeviceCancel}
                disabled={isAddingDevice}
              >
                No
              </Button>
              <Button
                onClick={() => deviceToAdd && handleAddDeviceFromModal(deviceToAdd)}
                disabled={isAddingDevice}
                className="bg-green-600 hover:bg-green-700"
              >
                {isAddingDevice ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Yes, Add Device'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

