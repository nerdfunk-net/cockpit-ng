'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, X, ChevronLeft, ChevronRight, RotateCcw, GitCompare, RefreshCw, ChevronDown, Radar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { SearchableDropdown } from '@/components/shared/searchable-dropdown'

// Types
interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
}

// Celery task types
interface CeleryTaskResponse {
  task_id: string
  job_id?: string  // Job ID for tracking in Jobs/Views app
  status: string
  message: string
}

interface CeleryTaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED'
  result?: {
    success: boolean
    message: string
    device_id?: string
    hostname?: string
    [key: string]: unknown
  }
  error?: string
  progress?: {
    status?: string
    current?: number
    total?: number
    [key: string]: unknown
  }
}

interface DeviceTask {
  taskId: string
  deviceId: string | string[] // Support single device or array
  deviceName: string
  operation: 'add' | 'update' | 'sync'
  status: CeleryTaskStatus['status']
  message: string
  startedAt: Date
  // Batch operation progress
  batchProgress?: {
    current: number
    total: number
    success: number
    failed: number
  }
}

interface PaginationState {
  isBackendPaginated: boolean
  hasMore: boolean
  totalCount: number
  currentLimit: number | null
  currentOffset: number
  filterType: string | null
  filterValue: string | null
}

interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

interface DiffResult {
  device_id: string
  device_name: string
  differences: {
    result: 'equal' | 'diff' | 'host_not_found'
    diff: string
    normalized_config: {
      folder: string
      attributes: Record<string, unknown>
    }
    checkmk_config: {
      folder: string
      attributes: Record<string, unknown>
      effective_attributes: Record<string, unknown> | null
      is_cluster: boolean
      is_offline: boolean
      cluster_nodes: unknown[] | null
    } | null
    ignored_attributes: string[]
  }
  timestamp: string
}

const EMPTY_IGNORED_ATTRIBUTES: string[] = []

// Helper function to render config comparison
const renderConfigComparison = (nautobot: { attributes?: Record<string, unknown> } | null, checkmk: { attributes?: Record<string, unknown> } | null, ignoredAttributes: string[] = EMPTY_IGNORED_ATTRIBUTES) => {
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

export default function LiveUpdatePage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)
  
  // State
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  
  // Activation state
  const [hasDevicesSynced, setHasDevicesSynced] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  
  // Add device confirmation modal state
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)

  // Selection state
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [isSyncingSelected, setIsSyncingSelected] = useState(false)

  // Celery task tracking state
  const [activeTasks, setActiveTasks] = useState<Map<string, DeviceTask>>(new Map())
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [, setPaginationState] = useState<PaginationState>({
    isBackendPaginated: false,
    hasMore: false,
    totalCount: 0,
    currentLimit: null,
    currentOffset: 0,
    filterType: null,
    filterValue: null,
  })

  // Filter state
  const [deviceNameFilter, setDeviceNameFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Multi-select role filter state (checkbox-based)
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})

  // Location filter state - searchable dropdown
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  // Sorting state
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    roles: new Set(),
    locations: new Set(),
    statuses: new Set(),
  })

  // Modal state
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  // Track diff results for each device
  const [deviceDiffResults, setDeviceDiffResults] = useState<Record<string, 'equal' | 'diff' | 'host_not_found'>>({})

  // Show status message
  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Prevent showing the same message repeatedly
    setStatusMessage(prev => {
      if (prev?.text === text && prev?.type === type) {
        return prev // Don't update if it's the same message
      }
      return { type, text }
    })

    // Auto-hide after 5 seconds for success and info only (not errors)
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setStatusMessage(prev => {
          // Only clear if it's still the same message
          if (prev?.text === text) {
            return null
          }
          return prev
        })
      }, 5000)
    }
  }, [])

  // Poll Celery task status
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await apiCall<CeleryTaskStatus>(`celery/tasks/${taskId}`)

      if (response) {
        let shouldStopPolling = false

        // Update task in activeTasks and check if we should stop polling
        setActiveTasks(prev => {
          const task = prev.get(taskId)
          if (!task) return prev

          const updated = new Map(prev)

          // Extract batch progress if available
          const batchProgress = response.progress?.current && response.progress?.total ? {
            current: response.progress.current,
            total: response.progress.total,
            success: Number(response.progress.success) || 0,
            failed: Number(response.progress.failed) || 0
          } : undefined

          updated.set(taskId, {
            ...task,
            status: response.status,
            message: response.progress?.status || response.result?.message || task.message,
            batchProgress
          })

          // Check if task is complete
          if (response.status === 'SUCCESS' || response.status === 'FAILURE') {
            shouldStopPolling = true
          }

          return updated
        })

        // Handle completion or failure
        if (shouldStopPolling) {
          // Stop polling immediately using ref
          const interval = pollingIntervalsRef.current.get(taskId)
          if (interval) {
            clearInterval(interval)
            pollingIntervalsRef.current.delete(taskId)
          }

          // Handle success/failure states
          if (response.status === 'SUCCESS') {
            setHasDevicesSynced(true)
            // Remove task after 1 second on success
            setTimeout(() => {
              setActiveTasks(prev => {
                const updated = new Map(prev)
                updated.delete(taskId)
                return updated
              })
            }, 1000)
          } else if (response.status === 'FAILURE') {
            // Keep failed tasks visible - don't auto-remove
            // They will stay in the panel showing the error
          }
        }
      }
    } catch (err) {
      console.error(`Error polling task ${taskId}:`, err)
      // Stop polling on error using ref
      const interval = pollingIntervalsRef.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        pollingIntervalsRef.current.delete(taskId)
      }
    }
  }, [apiCall])

  // Start tracking a Celery task
  const trackTask = useCallback((
    taskId: string,
    deviceId: string | string[], // Support single or multiple devices
    deviceName: string,
    operation: 'add' | 'update' | 'sync'
  ) => {
    const task: DeviceTask = {
      taskId,
      deviceId,
      deviceName,
      operation,
      status: 'PENDING',
      message: `${operation === 'add' ? 'Adding' : operation === 'update' ? 'Updating' : 'Syncing'} ${deviceName}...`,
      startedAt: new Date()
    }

    setActiveTasks(prev => new Map(prev).set(taskId, task))

    // Start polling for this task using ref
    const interval = setInterval(() => {
      void pollTaskStatus(taskId)
    }, 2000) // Poll every 2 seconds

    pollingIntervalsRef.current.set(taskId, interval)

    // Initial poll
    void pollTaskStatus(taskId)
  }, [pollTaskStatus])

  // Cancel a running task
  const handleCancelTask = useCallback(async (taskId: string) => {
    try {
      await apiCall(`celery/tasks/${taskId}`, {
        method: 'DELETE'
      })

      // Stop polling
      const interval = pollingIntervalsRef.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        pollingIntervalsRef.current.delete(taskId)
      }

      // Update task state to cancelled
      setActiveTasks(prev => {
        const task = prev.get(taskId)
        if (!task) return prev

        const updated = new Map(prev)
        updated.set(taskId, {
          ...task,
          status: 'REVOKED',
          message: 'Task cancelled by user'
        })
        return updated
      })

      // Remove task after a short delay
      setTimeout(() => {
        setActiveTasks(prev => {
          const updated = new Map(prev)
          updated.delete(taskId)
          return updated
        })
      }, 2000)

    } catch (err) {
      console.error(`Failed to cancel task ${taskId}:`, err)
      showMessage('Failed to cancel task', 'error')
    }
  }, [apiCall, showMessage])

  // Cleanup all polling intervals on unmount
  useEffect(() => {
    const intervals = pollingIntervalsRef.current
    return () => {
      intervals.forEach(interval => clearInterval(interval))
      intervals.clear()
    }
  }, [])

  // Load devices from API
  const loadDevices = useCallback(async (
    deviceNameFilter = '',
    useBackendPagination = false,
    limit: number | null = null,
    offset = 0,
    reload = false
  ) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (useBackendPagination && limit) {
        params.append('limit', limit.toString())
        params.append('offset', offset.toString())
      }
      if (deviceNameFilter) {
        params.append('filter_type', 'name')
        params.append('filter_value', deviceNameFilter)
      }
      if (reload) {
        params.append('reload', 'true')
      }

      const endpoint = `nautobot/devices${params.toString() ? '?' + params.toString() : ''}`
      const response = await apiCall<{
        devices?: Device[];
        is_paginated?: boolean;
        has_more?: boolean;
        count?: number;
        current_limit?: number;
        current_offset?: number;
        sites?: string[];
        locations?: string[];
        device_types?: string[];
      }>(endpoint)

      if (response?.devices) {
        const newDevices = response.devices
        setDevices(newDevices)

        // Update pagination state
        setPaginationState({
          isBackendPaginated: response.is_paginated || false,
          hasMore: response.has_more || false,
          totalCount: response.count || 0,
          currentLimit: response.current_limit || null,
          currentOffset: response.current_offset || 0,
          filterType: deviceNameFilter ? 'name' : null,
          filterValue: deviceNameFilter || null,
        })

        // Extract filter options if not using backend pagination
        if (!useBackendPagination) {
          const newFilterOptions: FilterOptions = {
            roles: new Set(),
            locations: new Set(),
            statuses: new Set(),
          }

          newDevices.forEach((device: Device) => {
            if (device.role?.name) newFilterOptions.roles.add(device.role.name)
            if (device.location?.name) newFilterOptions.locations.add(device.location.name)
            if (device.status?.name) newFilterOptions.statuses.add(device.status.name)
          })

          setFilterOptions(newFilterOptions)

          // Initialize role filters (all selected by default)
          const initialRoleFilters: Record<string, boolean> = {}
          newFilterOptions.roles.forEach(role => {
            initialRoleFilters[role] = true
          })
          setRoleFilters(initialRoleFilters)

        }

        setStatusMessage(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices'
      setError(message)
      showMessage(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiCall, showMessage])

  const handleReloadDevices = useCallback(() => {
    void loadDevices('', false, null, 0, true)
  }, [loadDevices])

  // Apply filters and sorting
  const applyFilters = useCallback(() => {
    let filtered = devices.filter(device => {
      // Device name filter is handled separately via backend pagination or client-side by deviceNameFilter
      // For client-side filtering, apply device name filter here
      if (deviceNameFilter) {
        const deviceName = (device.name || '').toLowerCase()
        if (!deviceName.includes(deviceNameFilter.toLowerCase())) {
          return false
        }
      }

      // Multi-select role filter (checkbox-based)
      if (Object.keys(roleFilters).length > 0) {
        const deviceRole = device.role?.name || ''
        // If the device's role isn't in our filter list, show it (backward compatibility)
        if (!(deviceRole in roleFilters)) return true
        // Otherwise, check if this role is selected
        if (!roleFilters[deviceRole]) return false
      }

      // Location search filter (text-based searchable dropdown)
      if (selectedLocation) {
        const deviceLocation = device.location?.name || ''
        if (deviceLocation !== selectedLocation) return false
      }

      // Header filters (keeping status filter as simple select)
      if (statusFilter && device.status?.name !== statusFilter) return false

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: string, bVal: string

        switch (sortColumn) {
          case 'name':
            aVal = a.name || ''
            bVal = b.name || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    setFilteredDevices(filtered)
    setCurrentPage(0) // Reset to first page when filters change
  }, [devices, deviceNameFilter, roleFilters, selectedLocation, statusFilter, sortColumn, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setRoleFilter('')
    setStatusFilter('')
    setSortColumn('')
    setSortOrder('none')
    setCurrentPage(0)
    setFilteredDevices(devices)

    // Reset role filters to all selected
    const resetRoleFilters: Record<string, boolean> = {}
    filterOptions.roles.forEach(role => {
      resetRoleFilters[role] = true
    })
    setRoleFilters(resetRoleFilters)

    // Reset location search
    setSelectedLocation('')
  }, [devices, filterOptions.roles])

  // Actions
  const handleGetDiff = useCallback(async (device: Device) => {
    try {
      setLoadingDiff(true)
      setSelectedDevice(device)
      setIsDiffModalOpen(true)

      const response = await apiCall<DiffResult['differences']>(`nb2cmk/device/${device.id}/compare`)


      if (response) {
        const diffData = {
          device_id: device.id,
          device_name: device.name,
          differences: response,
          timestamp: new Date().toISOString()
        }
        setDiffResult(diffData)

        // Store the result for table row coloring
        setDeviceDiffResults(prev => ({
          ...prev,
          [device.id]: response.result
        }))
      } else {
        showMessage(`No diff data available for ${device.name}`, 'info')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get diff'
      showMessage(`Failed to get diff for ${device.name}: ${message}`, 'error')
    } finally {
      setLoadingDiff(false)
    }
  }, [apiCall, showMessage])

  const handleAddDeviceConfirmation = useCallback((device: Device) => {
    setDeviceToAdd(device)
    setShowAddDeviceModal(true)
  }, [])

  const handleAddDeviceCancel = useCallback(() => {
    setShowAddDeviceModal(false)
    setDeviceToAdd(null)
  }, [])

  const handleSync = useCallback(async (device: Device) => {
    try {
      // Use batch endpoint with single device for consistency
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/sync-devices-to-checkmk`, {
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
        // Start tracking the task (task panel will show progress)
        trackTask(response.task_id, [device.id], device.name, 'update')
      } else {
        showMessage(`Failed to queue sync task for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync device'

      // Check if it's a 404 error (device not found in CheckMK)
      if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
        // Ask user if they want to add the device to CheckMK
        handleAddDeviceConfirmation(device)
      } else {
        showMessage(`Failed to queue sync for ${device.name}: ${message}`, 'error')
      }
    }
  }, [apiCall, showMessage, handleAddDeviceConfirmation, trackTask])

  const handleStartDiscovery = useCallback(async (device: Device, mode: string = 'fix_all') => {
    const modeLabels: Record<string, string> = {
      'new': 'Monitor undecided services',
      'remove': 'Remove vanished services',
      'fix_all': 'Accept all',
      'refresh': 'Rescan',
      'only_host_labels': 'Update host labels',
      'only_service_labels': 'Update service labels',
      'tabula_rasa': 'Remove all and find new'
    }
    
    try {
      showMessage(`Starting discovery (${modeLabels[mode] || mode}) for ${device.name}...`, 'info')
      
      const response = await apiCall<{ success?: boolean; data?: { redirected?: boolean } }>(`checkmk/service-discovery/host/${device.name}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: mode
        })
      })

      if (response?.success) {
        showMessage(`Service discovery completed for ${device.name}`, 'success')
      } else if (response?.data?.redirected) {
        showMessage(`Discovery started for ${device.name} (running in background)`, 'success')
      } else {
        showMessage(`Failed to start discovery for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start discovery'
      showMessage(`Failed to start discovery for ${device.name}: ${message}`, 'error')
    }
  }, [apiCall, showMessage])

  const handleActivate = useCallback(async () => {
    try {
      setIsActivating(true)
      showMessage('Activating changes in CheckMK...', 'info')
      
      const response = await apiCall('checkmk/changes/activate', {
        method: 'POST'
      })
      
      if (response) {
        showMessage('Successfully activated pending changes in CheckMK', 'success')
        setHasDevicesSynced(false) // Reset the state after activation
      } else {
        showMessage('Failed to activate changes in CheckMK', 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate changes'
      showMessage(`Failed to activate changes: ${message}`, 'error')
    } finally {
      setIsActivating(false)
    }
  }, [apiCall, showMessage])

  const handleAddDevice = useCallback(async (device: Device) => {
    try {
      setIsAddingDevice(true)

      // Call Celery endpoint with device_id as query parameter
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/add-device-to-checkmk?device_id=${device.id}`, {
        method: 'POST'
      })

      if (response?.task_id) {
        // Start tracking the task (task panel will show progress)
        trackTask(response.task_id, device.id, device.name, 'add')
        setShowAddDeviceModal(false) // Close the modal
        setDeviceToAdd(null)
      } else {
        showMessage(`Failed to queue add task for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add device'
      showMessage(`Failed to queue add for ${device.name}: ${message}`, 'error')
    } finally {
      setIsAddingDevice(false)
    }
  }, [apiCall, showMessage, trackTask])

  // Pagination
  const totalPages = Math.ceil(filteredDevices.length / pageSize)
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredDevices.slice(start, end)
  }, [filteredDevices, currentPage, pageSize])

  // Selection handlers
  const handleSelectDevice = useCallback((deviceId: string, checked: boolean) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(deviceId)
      } else {
        newSet.delete(deviceId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(paginatedDevices.map(device => device.id)))
    } else {
      setSelectedDevices(new Set())
    }
  }, [paginatedDevices])

  const handleSyncSelected = useCallback(async () => {
    if (selectedDevices.size === 0) {
      showMessage('No devices selected', 'error')
      return
    }

    try {
      setIsSyncingSelected(true)
      const selectedDeviceList = Array.from(selectedDevices)

      // Use batch sync endpoint
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/sync-devices-to-checkmk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: selectedDeviceList,
          activate_changes_after_sync: true
        })
      })

      if (response?.task_id) {
        // Track the batch task with detailed progress (keep for backward compatibility)
        trackTask(
          response.task_id,
          selectedDeviceList, // Pass array of device IDs
          `${selectedDevices.size} device${selectedDevices.size === 1 ? '' : 's'}`,
          'sync'
        )

        // Show success message with job tracking info
        if (response.job_id) {
          showMessage(
            `Sync job queued for ${selectedDevices.size} device${selectedDevices.size === 1 ? '' : 's'}. Job ID: ${response.job_id}. View progress in Jobs/Views.`,
            'success'
          )
        } else {
          showMessage(
            `Sync job queued for ${selectedDevices.size} device${selectedDevices.size === 1 ? '' : 's'}`,
            'success'
          )
        }
      } else {
        showMessage(`Failed to queue batch sync task`, 'error')
      }

      // Clear selection after queueing
      setSelectedDevices(new Set())

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync selected devices'
      showMessage(message, 'error')
    } finally {
      setIsSyncingSelected(false)
    }
  }, [selectedDevices, apiCall, showMessage, trackTask])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }, [totalPages])

  const handleSort = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortOrder(prev => {
        if (prev === 'none') return 'asc'
        if (prev === 'asc') return 'desc'
        return 'none'
      })
    } else {
      setSortColumn(column)
      setSortOrder('asc')
    }
  }, [sortColumn])

  // Mark handleSort as used to suppress linter warning
  void handleSort

  // Effects
  // Authentication effect - wait for auth before loading data
  useEffect(() => {
    if (isAuthenticated && token) {
      setAuthReady(true)
      loadDevices()
    }
  }, [isAuthenticated, loadDevices, token])

  useEffect(() => {
    applyFilters()
  }, [applyFilters, devices, deviceNameFilter, selectedLocation, roleFilter, sortColumn, sortOrder, statusFilter])

  // Helper functions
  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) {
      return 'default' // Green
    } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
      return 'destructive' // Red
    } else if (statusLower.includes('maintenance')) {
      return 'secondary' // Yellow
    }
    return 'outline' // Gray
  }

  const isDeviceOffline = (status: string) => {
    const statusLower = status.toLowerCase()
    return statusLower.includes('offline') || statusLower.includes('failed')
  }

  const activeFiltersCount = [
    deviceNameFilter,
    roleFilter,
    statusFilter,
    selectedLocation
  ].filter(Boolean).length +
  // Add count for role filters (if any are deselected)
  (Object.keys(roleFilters).length > 0 && Object.values(roleFilters).filter(Boolean).length < filterOptions.roles.size ? 1 : 0)

  // Helper function to get row color based on diff results
  const getRowColorClass = (deviceId: string) => {
    const result = deviceDiffResults[deviceId]
    if (!result) return '' // No test performed yet
    
    switch (result) {
      case 'equal':
        return 'bg-green-50 hover:bg-green-100 border-green-200'
      case 'diff':
      case 'host_not_found':
        return 'bg-red-50 hover:bg-red-100 border-red-200'
      default:
        return ''
    }
  }

  if (!authReady || (loading && devices.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {!authReady ? 'Establishing authentication...' : 'Loading devices...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <RefreshCw className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Update</h1>
            <p className="text-gray-600 mt-1">Monitor and sync device configurations in real-time</p>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => loadDevices()}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Message - Only for non-task related messages */}
      {statusMessage && !statusMessage.text.includes('✓') && !statusMessage.text.includes('✗') && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <Card className={`min-w-[400px] max-w-[600px] shadow-lg ${
            statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
            'border-blue-500 bg-blue-50'
          }`}>
            <CardContent className="p-4">
              <div className={`flex items-start gap-3 ${
                statusMessage.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {statusMessage.type === 'error' && <X className="h-5 w-5" />}
                  {statusMessage.type === 'info' && <span className="text-lg">ℹ</span>}
                </div>
                <span className="flex-1 text-sm font-medium break-words">{statusMessage.text}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusMessage(null)}
                  className="ml-2 h-6 w-6 p-0 flex-shrink-0 hover:bg-transparent"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Tasks Panel */}
      {activeTasks.size > 0 && (
        <div className="space-y-2">
          {Array.from(activeTasks.values()).map((task) => {
            const isSuccess = task.status === 'SUCCESS'
            const isFailure = task.status === 'FAILURE'
            const isRunning = task.status === 'PENDING' || task.status === 'STARTED' || task.status === 'PROGRESS'
            const isBatch = Array.isArray(task.deviceId) && task.deviceId.length > 1

            return (
              <Card
                key={task.taskId}
                className={`${
                  isSuccess ? 'border-green-500 bg-green-50' :
                  isFailure ? 'border-red-500 bg-red-50' :
                  'border-blue-200 bg-blue-50'
                } transition-all duration-300`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isSuccess ? 'border-green-600 text-green-700 bg-green-100' :
                            isFailure ? 'border-red-600 text-red-700 bg-red-100' :
                            'border-blue-600 text-blue-700 bg-blue-100'
                          }`}
                        >
                          {task.operation === 'add' ? 'Adding' : task.operation === 'update' ? 'Updating' : 'Syncing'}
                        </Badge>
                        <span className={`font-medium text-sm ${
                          isSuccess ? 'text-green-800' :
                          isFailure ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                          {task.deviceName}
                        </span>
                      </div>

                      {/* Batch Progress Bar and Details */}
                      {isBatch && task.batchProgress && (
                        <div className="mt-2 space-y-1">
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isSuccess ? 'bg-green-500' :
                                isFailure ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${(task.batchProgress.current / task.batchProgress.total) * 100}%` }}
                            />
                          </div>
                          {/* Progress Stats */}
                          <div className="flex items-center gap-3 text-xs">
                            <span className={
                              isSuccess ? 'text-green-700' :
                              isFailure ? 'text-red-700' :
                              'text-blue-700'
                            }>
                              {task.batchProgress.current}/{task.batchProgress.total} processed
                            </span>
                            {task.batchProgress.success > 0 && (
                              <span className="text-green-600">
                                ✓ {task.batchProgress.success} succeeded
                              </span>
                            )}
                            {task.batchProgress.failed > 0 && (
                              <span className="text-red-600">
                                ✗ {task.batchProgress.failed} failed
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={`text-xs mt-1 ${
                        isSuccess ? 'text-green-700' :
                        isFailure ? 'text-red-700' :
                        'text-gray-600'
                      }`}>
                        {isSuccess ? '✓ Successfully updated' : isFailure ? task.message : task.message}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {/* Cancel button for running batch tasks */}
                        {isRunning && isBatch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelTask(task.taskId)}
                            className="h-7 text-xs border-orange-400 text-orange-700 hover:text-orange-900 hover:bg-orange-50"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {/* Dismiss button for failed tasks */}
                        {isFailure && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveTasks(prev => {
                                const updated = new Map(prev)
                                updated.delete(task.taskId)
                                return updated
                              })
                            }}
                            className="h-7 text-xs text-red-700 hover:text-red-900 hover:bg-red-100"
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      {isRunning ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                      ) : isSuccess ? (
                        <span className="text-green-600 text-2xl">✓</span>
                      ) : isFailure ? (
                        <X className="h-6 w-6 text-red-600" />
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Devices table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Live Update Management</h3>
                {activeFiltersCount > 0 || sortColumn ? (
                  <p className="text-blue-100 text-xs">
                    Showing {filteredDevices.length} of {devices.length} devices
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                    {sortColumn && ` - Sorted by ${sortColumn.replace('_', ' ')} (${sortOrder})`}
                  </p>
                ) : (
                  <p className="text-blue-100 text-xs">
                    Showing all {devices.length} devices
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {activeFiltersCount > 0 && (
                <>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {activeFiltersCount} active
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    title="Clear All Filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReloadDevices}
                className="text-white hover:bg-white/20 text-xs h-7"
                disabled={loading}
                title="Reload devices from Nautobot"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Load Devices
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium w-12">
                    <Checkbox
                      checked={paginatedDevices.length > 0 && paginatedDevices.every(device => selectedDevices.has(device.id))}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all devices"
                    />
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Device Name</div>
                      <div>
                        <Input
                          placeholder="Type 3+ chars for backend search..."
                          value={deviceNameFilter}
                          onChange={(e) => setDeviceNameFilter(e.target.value)}
                          className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">IP Address</th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Role</div>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Role Filter
                              {Object.values(roleFilters).filter(Boolean).length < filterOptions.roles.size && Object.keys(roleFilters).length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(roleFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4 ml-auto" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 hover:bg-red-50"
                              onSelect={() => {
                                const resetRoleFilters: Record<string, boolean> = {}
                                filterOptions.roles.forEach(role => {
                                  resetRoleFilters[role] = false
                                })
                                setRoleFilters(resetRoleFilters)
                                setCurrentPage(0)
                              }}
                            >
                              Deselect all
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {Array.from(filterOptions.roles).sort().map((role) => (
                              <DropdownMenuCheckboxItem
                                key={`live-update-role-${role}`}
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
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <SearchableDropdown
                      label="Location"
                      placeholder="Filter by location..."
                      options={Array.from(filterOptions.locations).sort()}
                      value={selectedLocation}
                      onSelect={setSelectedLocation}
                      onClear={() => setSelectedLocation('')}
                    />
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Status</div>
                      <div>
                        <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {Array.from(filterOptions.statuses).sort().map(status => (
                              <SelectItem key={`live-update-status-${status}`} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map((device) => {
                    const isOffline = isDeviceOffline(device.status?.name || '')
                    
                    return (
                      <tr 
                        key={`live-update-device-${device.id}`} 
                        className={`border-b transition-colors ${getRowColorClass(device.id) || 'hover:bg-muted/50'}`}
                      >
                        <td className="p-2 w-12">
                          <Checkbox
                            checked={selectedDevices.has(device.id)}
                            onCheckedChange={(checked) => handleSelectDevice(device.id, !!checked)}
                            aria-label={`Select ${device.name}`}
                          />
                        </td>
                        <td className="p-2 font-medium">{device.name}</td>
                        <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
                        <td className="p-2">{device.role?.name || 'Unknown'}</td>
                        <td className="p-2">{device.location?.name || 'Unknown'}</td>
                        <td className="p-2">
                          <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                            {device.status?.name || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGetDiff(device)}
                              disabled={isOffline}
                              title="Get Diff"
                            >
                              <GitCompare className="h-3 w-3" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSync(device)}
                              disabled={isOffline}
                              title="Sync Device"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isOffline}
                                  title="Start Discovery"
                                >
                                  <Radar className="h-3 w-3" />
                                  <ChevronDown className="h-2 w-2 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Discovery Mode</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'fix_all')}>
                                  Accept all
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'new')}>
                                  Monitor undecided services
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'remove')}>
                                  Remove vanished services
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'refresh')}>
                                  Rescan (background)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'tabula_rasa')}>
                                  Remove all and find new (background)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'only_host_labels')}>
                                  Update host labels
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'only_service_labels')}>
                                  Update service labels
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredDevices.length)} of {filteredDevices.length} entries
            </div>
            
            <div className="flex items-center gap-1">
              {/* Navigation buttons - only show when there are multiple pages */}
              {totalPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(0)}
                    disabled={currentPage === 0}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + i
                    if (pageNum >= totalPages) return null
                    
                    return (
                      <Button
                        key={`live-update-page-${pageNum}`}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum + 1}
                      </Button>
                    )
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Last
                  </Button>
                </>
              )}
              
              {/* Page Size Selector - always visible */}
              <div className="flex items-center gap-1 ml-2">
                <Label htmlFor="page-size" className="text-xs text-muted-foreground">Show:</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger className="w-20 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {hasDevicesSynced ? (
                <span className="text-green-600">✓ Devices have been synced. Activate changes to apply them in CheckMK.</span>
              ) : (
                <span>Sync one or more devices to enable activation.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSyncSelected}
                disabled={selectedDevices.size === 0 || isSyncingSelected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSyncingSelected ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing {selectedDevices.size} device{selectedDevices.size === 1 ? '' : 's'}...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Selected ({selectedDevices.size})
                  </>
                )}
              </Button>
              <Button
                onClick={handleActivate}
                disabled={!hasDevicesSynced || isActivating}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
              >
                {isActivating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Activate Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      <Dialog open={isDiffModalOpen} onOpenChange={setIsDiffModalOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ resize: 'both', minWidth: '800px', minHeight: '500px' }}>
          <DialogHeader>
            <DialogTitle>
              Device Comparison - {selectedDevice?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {loadingDiff ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading diff...</p>
                </div>
              </div>
            ) : diffResult ? (
              <div className="space-y-4">
                {/* Header with status */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Generated: {new Date(diffResult.timestamp).toLocaleString()}
                  </div>
                  <Badge 
                    variant={diffResult.differences.result === 'equal' ? 'default' : 'secondary'}
                    className={
                      diffResult.differences.result === 'equal' ? 'bg-green-100 text-green-800' : 
                      diffResult.differences.result === 'host_not_found' ? 'bg-red-100 text-red-800' :
                      'bg-orange-100 text-orange-800'
                    }
                  >
                    {diffResult.differences.result === 'equal' ? '✓ Configs Match' : 
                     diffResult.differences.result === 'host_not_found' ? '❌ Host Not Found in CheckMK' :
                     '⚠ Differences Found'}
                  </Badge>
                </div>

{/* Handle host not found case */}
                {diffResult.differences.result === 'host_not_found' ? (
                  <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                    <div className="text-center">
                      <div className="text-red-600 text-lg mb-3">🚫 Host Not Found</div>
                      <p className="text-red-800 mb-4">{diffResult.differences.diff}</p>
                      
                      <div className="bg-white rounded-lg p-4 border border-red-200 text-left">
                        <h4 className="font-semibold mb-2 text-red-800">Expected Configuration (Nautobot)</h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Folder:</strong> <code className="bg-red-100 px-2 py-1 rounded">{diffResult.differences.normalized_config.folder}</code></div>
                          <div><strong>Attributes:</strong></div>
                          <pre className="bg-red-100 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                            {JSON.stringify(diffResult.differences.normalized_config.attributes, null, 2)}
                          </pre>
                        </div>
                      </div>
                      
                      <p className="text-red-700 text-sm mt-4">
                        This device exists in Nautobot but has not been synchronized to CheckMK yet.
                        Use the Sync button to create this host in CheckMK.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Folder Comparison */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Folder Configuration</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-blue-600 mb-1">Nautobot (Expected)</div>
                          <div className="bg-blue-50 p-2 rounded text-sm font-mono">
                            {diffResult.differences.normalized_config.folder}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-purple-600 mb-1">CheckMK (Actual)</div>
                          <div className="bg-purple-50 p-2 rounded text-sm font-mono">
                            {diffResult.differences.checkmk_config?.folder || '(not found)'}
                          </div>
                        </div>
                      </div>
                      {diffResult.differences.normalized_config.folder !== diffResult.differences.checkmk_config?.folder && (
                        <div className="mt-2 text-xs text-orange-600">⚠ Folder paths differ</div>
                      )}
                    </div>

                {/* Attributes Comparison */}
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
                          diffResult.differences.normalized_config,
                          diffResult.differences.checkmk_config,
                          diffResult.differences.ignored_attributes
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
                                <Badge variant="outline" className="text-green-700 border-green-400 bg-green-100">Match</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                    {/* CheckMK Additional Info */}
                    {diffResult.differences.checkmk_config && (
                      diffResult.differences.checkmk_config.is_cluster || 
                      diffResult.differences.checkmk_config.is_offline || 
                      diffResult.differences.checkmk_config.cluster_nodes
                    ) && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-purple-800">CheckMK Additional Information</h4>
                        <div className="space-y-1 text-sm">
                          <div>Is Cluster: {diffResult.differences.checkmk_config.is_cluster ? 'Yes' : 'No'}</div>
                          <div>Is Offline: {diffResult.differences.checkmk_config.is_offline ? 'Yes' : 'No'}</div>
                          {diffResult.differences.checkmk_config.cluster_nodes && (
                            <div>Cluster Nodes: {JSON.stringify(diffResult.differences.checkmk_config.cluster_nodes)}</div>
                          )}
                        </div>
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
                onClick={() => deviceToAdd && handleAddDevice(deviceToAdd)}
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