'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw, Search, Eye, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle, AlertCircle, Info, Plus, ChevronDown, BarChart3, Download, Trash2, Shield } from 'lucide-react'
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
import { SearchableDropdown } from '@/components/shared/searchable-dropdown'

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
  ignored_attributes?: string[]
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
      ignored_attributes?: string[]
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
    ignored_attributes?: string[]
  }
  error_message?: string
  processed_at?: string
  role?: { name: string } | string
  location?: { name: string } | string
  device_type?: { model: string }
  primary_ip4?: { address: string }
  device_status?: { name: string }
  device_id?: string
  checkmk_status?: string
  normalized_config?: {
    folder?: string
    attributes?: Record<string, unknown>
    internal?: {
      hostname?: string
      role?: string
      status?: string
      location?: string
    }
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
  ignored_attributes?: string[]
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
  const [siteFilters, setSiteFilters] = useState<Record<string, boolean>>({})

  // Location filter state - searchable dropdown
  const [selectedLocation, setSelectedLocation] = useState<string>('')
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

  // Background job state (Celery)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [celeryTaskId, setCeleryTaskId] = useState<string | null>(null)
  const [_isJobRunning, setIsJobRunning] = useState(false)
  const [jobProgress, setJobProgress] = useState<{
    processed: number
    total: number
    message: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    current?: number
    success?: number
    failed?: number
  } | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

  // Sync device function - uses Celery background task for non-blocking operation
  const handleSync = async (device: Device) => {
    try {
      showMessage(`Queuing sync for ${device.name}...`, 'info')

      // Use the Celery batch sync endpoint (works for single device too)
      const response = await apiCall<{ task_id: string; job_id?: string; status: string; message: string }>('celery/tasks/sync-devices-to-checkmk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [device.id],
          activate_changes_after_sync: true
        })
      })

      if (response?.task_id) {
        if (response.job_id) {
          showMessage(`Sync job queued for ${device.name}. Job ID: ${response.job_id}. Refresh job list to see progress.`, 'success')
        } else {
          showMessage(`Sync job queued for ${device.name}. Task ID: ${response.task_id}`, 'success')
        }
        // Refresh job list to show the new job
        await fetchAvailableJobs()
      } else {
        showMessage(`Failed to queue sync for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue sync job'

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

  // Fetch available completed jobs from backend (NB2CMK database)
  const fetchAvailableJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/nb2cmk/jobs?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Filter only completed COMPARE jobs (exclude sync jobs) with processed devices
        // Compare job IDs start with "scheduled_compare_", sync job IDs start with "sync_devices_"
        const completedJobs = data.jobs.filter((job: { id: string; status: string; processed_devices: number }) =>
          job.status === 'completed' && 
          (job.processed_devices || 0) > 0 &&
          !job.id.startsWith('sync_devices_')  // Exclude sync jobs
        ).map((job: { id: string; status: string; started_at: string; processed_devices: number }) => ({
          id: job.id,
          status: job.status,
          created_at: job.started_at,
          processed_devices: job.processed_devices || 0
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
      // Use NB2CMK jobs endpoint for comparison results
      const response = await fetch(`/api/proxy/nb2cmk/jobs/${selectedJobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Extract device results from the NB2CMK job format
        const deviceResults = data.job?.device_results || []
        // Convert device results to the expected devices format
        const devices = deviceResults.map((result: DeviceResult, index: number) => {
          // Get internal data from normalized_config for device metadata
          const internalData = result.normalized_config?.internal || {}

          return {
            id: result.device_id || result.device_name || `device_${index}`, // Use device UUID as ID, fallback to device name or index
            name: internalData.hostname || result.device_name || result.device || `device_${index}`, // Use hostname from internal data
            role: internalData.role || (typeof result.role === 'object' && result.role?.name) || result.role || 'Unknown', // Get role from internal data
            status: internalData.status || result.device_status?.name || result.status || 'Unknown', // Get status from internal data
            location: internalData.location || (typeof result.location === 'object' && result.location?.name) || result.location || 'Unknown', // Get location from internal data
            result_data: result.result_data,
            error_message: result.error_message,
            processed_at: result.processed_at,
            // For NB2CMK format, checkmk_status is directly on the result
            checkmk_status: result.checkmk_status || result.result_data?.data?.result || result.result_data?.comparison_result || result.result_data?.status || 'unknown',
            // normalized_config and checkmk_config are directly on the result for NB2CMK format
            normalized_config: result.normalized_config || result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
            checkmk_config: result.checkmk_config || result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
            diff: result.diff || result.result_data?.data?.diff || result.result_data?.diff,
            // Include ignored_attributes from the API response
            ignored_attributes: result.ignored_attributes || result.result_data?.data?.ignored_attributes || result.result_data?.ignored_attributes || []
          }
        })
        
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

  // Clear all comparison results from the database
  const handleClearResults = async () => {
    if (!token) return
    
    // Confirm before clearing
    if (!confirm('Are you sure you want to delete all comparison results? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch('/api/proxy/nb2cmk/jobs/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Refresh the job list
        await fetchAvailableJobs()
        
        // Clear current selection and devices if they were from a deleted job
        setSelectedJobId('')
        setDevices([])
        setCurrentJobId(null)
        
        setStatusMessage({
          type: 'success',
          message: data.message || 'All comparison results cleared'
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
          message: `Failed to clear results: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error clearing results:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error clearing comparison results'
      })
      setShowStatusModal(true)
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
      setSelectedLocation('')
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
    }
  }, [token, fetchAvailableJobs, fetchDefaultSite])

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

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
      // Only select devices on the current page
      setSelectedDevices(new Set(currentDevices.map(device => device.id)))
    } else {
      // Deselect all devices (not just current page)
      setSelectedDevices(new Set())
    }
  }

  // Select all devices matching the current filter (not just current page)
  const handleSelectAllFiltered = () => {
    setSelectedDevices(new Set(filteredDevices.map(device => device.id)))
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


  // Poll Celery task status
  const pollCeleryTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/proxy/celery/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()

        // Update progress from Celery task state
        if (data.progress || data.result) {
          const progress = data.progress || {}
          const result = data.result || {}

          setJobProgress({
            processed: progress.current || result.completed || 0,
            total: progress.total || result.total || 0,
            message: progress.status || result.message || 'Processing...',
            status: data.status === 'SUCCESS' ? 'completed' :
                   data.status === 'FAILURE' ? 'failed' :
                   data.status === 'PROGRESS' ? 'running' : 'pending',
            current: progress.current,
            success: progress.completed || result.completed,
            failed: progress.failed || result.failed
          })
        }

        // If task completed or failed, stop polling
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsJobRunning(false)

          // Get the job_id from the result for reference
          if (data.status === 'SUCCESS' && data.result?.job_id) {
            setCurrentJobId(data.result.job_id)
            // Set the selected job so user can click "Load Results" to view
            setSelectedJobId(data.result.job_id)
          }

          // Refresh available jobs
          fetchAvailableJobs()

          showMessage(
            data.status === 'SUCCESS'
              ? `Comparison completed: ${data.result?.message || 'All devices processed'}`
              : `Comparison failed: ${data.error || 'Unknown error'}`,
            data.status === 'SUCCESS' ? 'success' : 'error'
          )
        }
      }
    } catch (error) {
      console.error('Error polling Celery task:', error)
    }
  }, [token, fetchAvailableJobs])

  // Cancel running Celery task
  const cancelCeleryTask = useCallback(async () => {
    if (!celeryTaskId || !token) return

    try {
      const response = await fetch(`/api/proxy/celery/tasks/${celeryTaskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        setIsJobRunning(false)
        setCeleryTaskId(null)
        setJobProgress(null)
        showMessage('Job cancelled successfully', 'info')
      } else {
        showMessage('Failed to cancel job', 'error')
      }
    } catch (error) {
      console.error('Error cancelling task:', error)
      showMessage('Error cancelling job', 'error')
    }
  }, [celeryTaskId, token])

  // Background job functions
  // Start new device comparison job using Celery
  const startNewJob = async () => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    try {
      // Start a Celery comparison task for all devices
      const response = await fetch('/api/proxy/celery/tasks/compare-nautobot-and-checkmk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(null) // null = compare all devices
      })

      if (response.ok) {
        const result = await response.json()
        setCeleryTaskId(result.task_id)
        setIsJobRunning(true)
        setJobProgress({
          processed: 0,
          total: 0,
          message: 'Starting comparison...',
          status: 'pending'
        })
        setShowProgressModal(true)

        // Start polling for task status
        pollingIntervalRef.current = setInterval(() => {
          pollCeleryTask(result.task_id)
        }, 2000) // Poll every 2 seconds

        // Initial poll
        pollCeleryTask(result.task_id)

        setStatusMessage({
          type: 'success',
          message: `Device comparison task started: ${result.task_id.slice(0, 8)}...`
        })
        setShowStatusModal(true)

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

  // handleGetProgress removed - now using pollCeleryTask for real-time progress tracking

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
      // Use NB2CMK jobs endpoint for comparison results
      const response = await fetch(`/api/proxy/nb2cmk/jobs/${targetJobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()

        // Extract device results from the NB2CMK job format and convert to expected format
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
          // For NB2CMK format, checkmk_status is directly on the result
          checkmk_status: result.checkmk_status || result.result_data?.data?.result || result.result_data?.comparison_result || result.result_data?.status || 'unknown',
          // normalized_config and checkmk_config are directly on the result for NB2CMK format
          normalized_config: result.normalized_config || result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
          checkmk_config: result.checkmk_config || result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
          diff: result.diff || result.result_data?.data?.diff || result.result_data?.diff,
          // Include ignored_attributes from the API response
          ignored_attributes: result.ignored_attributes || result.result_data?.data?.ignored_attributes || result.result_data?.ignored_attributes || []
        }))

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

      // Use the Celery batch sync endpoint for background processing
      const response = await fetch('/api/proxy/celery/tasks/sync-devices-to-checkmk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: selectedDeviceList,
          activate_changes_after_sync: true
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Clear selection after queueing
        setSelectedDevices(new Set())

        // Show success message with job info
        if (result.job_id) {
          setStatusMessage({
            type: 'success',
            message: `Sync job queued for ${selectedDeviceList.length} device${selectedDeviceList.length === 1 ? '' : 's'}. Job ID: ${result.job_id}. Refresh the job list to see progress.`
          })
        } else {
          setStatusMessage({
            type: 'success',
            message: `Sync job queued for ${selectedDeviceList.length} device${selectedDeviceList.length === 1 ? '' : 's'}. Task ID: ${result.task_id}`
          })
        }
        setShowStatusModal(true)

        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 5000)

        // Refresh job list to show the new job
        await fetchAvailableJobs()

      } else {
        const errorData = await response.json()
        setStatusMessage({
          type: 'error',
          message: `Failed to queue sync job: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }

    } catch (error) {
      console.error('Error syncing devices:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error queuing sync job'
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

      // Check location search filter (text-based searchable dropdown)
      const locationMatch = !selectedLocation || device.location === selectedLocation

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
  }, [devices, filters, checkmkStatusFilters, roleFilters, statusFilters, selectedLocation, siteFilters, defaultSite])

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
    // Reset location search
    setSelectedLocation('')
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
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Error</Badge>
      case 'unknown':
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">{checkmkStatus}</Badge>
    }
  }

  // Always render the full interface - don't show separate loading page

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
            <p className="text-gray-600 mt-1">Compare and synchronize devices between Nautobot and CheckMK</p>
          </div>
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

                    {/* Location Filter - searchable dropdown */}
                    <td className="px-4 py-3 w-40">
                      <SearchableDropdown
                        label="Location"
                        placeholder="Filter by location..."
                        options={availableLocations}
                        value={selectedLocation}
                        onSelect={setSelectedLocation}
                        onClear={() => setSelectedLocation('')}
                      />
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
                        <div className="flex items-center gap-1">
                          {getCheckMKStatusBadge(device.checkmk_status)}
                          {device.checkmk_status === 'error' && device.diff && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDeviceForView(device)}
                              title="View error details"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
                <Button 
                  onClick={handleClearResults}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Clear all comparison results"
                  disabled={availableJobs.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Results
                </Button>
              </div>
            </div>
          </div>

          {/* Device Actions */}
          <div className="bg-white p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                {selectedDevices.size > 0 && (
                  <span>{selectedDevices.size} of {filteredDevices.length} device(s) selected</span>
                )}
                {/* Show "Select All Filtered" button when there are more filtered devices than selected */}
                {selectedDevices.size > 0 && selectedDevices.size < filteredDevices.length && (
                  <Button
                    onClick={handleSelectAllFiltered}
                    variant="link"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                  >
                    Select all {filteredDevices.length} filtered devices
                  </Button>
                )}
                {selectedDevices.size > 0 && selectedDevices.size === filteredDevices.length && (
                  <span className="text-green-600">(all filtered devices selected)</span>
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

            {selectedDeviceForView?.diff && selectedDeviceForView?.checkmk_status === 'error' && (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Error Details</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded text-sm">
                  {(() => {
                    try {
                      // Try to parse as JSON for detailed error info
                      const errorData = JSON.parse(selectedDeviceForView.diff)
                      return (
                        <div className="space-y-3">
                          {errorData.error && (
                            <div>
                              <span className="font-semibold text-red-700">Error: </span>
                              <span className="text-red-800">{errorData.error}</span>
                            </div>
                          )}
                          {errorData.status_code && (
                            <div>
                              <span className="font-semibold text-red-700">Status Code: </span>
                              <span className="text-red-800">{errorData.status_code}</span>
                            </div>
                          )}
                          {errorData.detail && (
                            <div>
                              <span className="font-semibold text-red-700">Detail: </span>
                              <span className="text-red-800">{errorData.detail}</span>
                            </div>
                          )}
                          {errorData.title && (
                            <div>
                              <span className="font-semibold text-red-700">Title: </span>
                              <span className="text-red-800">{errorData.title}</span>
                            </div>
                          )}
                          {errorData.fields && (
                            <div>
                              <div className="font-semibold text-red-700 mb-2">Field Problems:</div>
                              <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                                {Object.entries(errorData.fields).map(([field, errors]: [string, unknown]) => {
                                  // Recursive function to render nested field errors
                                  const renderErrors = (value: unknown, depth: number = 0): React.ReactElement => {
                                    if (Array.isArray(value)) {
                                      return (
                                        <ul className="list-disc list-inside text-red-600 mt-1 space-y-1">
                                          {value.map((error: string) => (
                                            <li key={error} className="text-sm">{error}</li>
                                          ))}
                                        </ul>
                                      )
                                    } else if (typeof value === 'object' && value !== null) {
                                      return (
                                        <div className={depth > 0 ? "ml-4 mt-1" : ""}>
                                          {Object.entries(value as Record<string, unknown>).map(([subField, subErrors]) => (
                                            <div key={subField} className="border-l-2 border-red-300 pl-3 mt-1">
                                              <div className="font-medium text-red-700 text-sm">{subField}:</div>
                                              {renderErrors(subErrors, depth + 1)}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    } else {
                                      return <div className="text-sm text-red-600">{String(value)}</div>
                                    }
                                  }

                                  return (
                                    <div key={field} className="border-l-2 border-red-400 pl-3">
                                      <div className="font-medium text-red-700">{field}:</div>
                                      {renderErrors(errors)}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    } catch {
                      // If not JSON, display as plain text
                      return <div className="text-red-800 whitespace-pre-wrap">{selectedDeviceForView.diff}</div>
                    }
                  })()}
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
                                selectedDeviceForDiff.ignored_attributes || []
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

                  {/* Detailed Progress Stats */}
                  {(jobProgress.success !== undefined || jobProgress.failed !== undefined) && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>
                        {jobProgress.success !== undefined && (
                          <span className="text-green-600">✓ {jobProgress.success} succeeded</span>
                        )}
                      </span>
                      <span>
                        {jobProgress.failed !== undefined && jobProgress.failed > 0 && (
                          <span className="text-red-600">✗ {jobProgress.failed} failed</span>
                        )}
                      </span>
                    </div>
                  )}

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

                  {/* Task ID */}
                  {celeryTaskId && (
                    <div className="text-xs text-gray-500 font-mono">
                      Task ID: {celeryTaskId.slice(0, 16)}...
                    </div>
                  )}

                  {/* Job ID (once available) */}
                  {currentJobId && (
                    <div className="text-xs text-gray-500 font-mono">
                      Job ID: {currentJobId.slice(0, 16)}...
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex space-x-2 pt-2">
                  {/* Cancel button for running tasks */}
                  {(jobProgress.status === 'running' || jobProgress.status === 'pending') && (
                    <Button
                      onClick={cancelCeleryTask}
                      variant="outline"
                      className="flex-1 border-orange-400 text-orange-700 hover:bg-orange-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Cancel Job
                    </Button>
                  )}

                  {/* View Results button for completed tasks */}
                  {jobProgress.status === 'completed' && (
                    <Button
                      onClick={() => {
                        setShowProgressModal(false)
                        if (currentJobId) {
                          handleViewDiff(currentJobId)
                        }
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  )}

                  {/* Close button */}
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

