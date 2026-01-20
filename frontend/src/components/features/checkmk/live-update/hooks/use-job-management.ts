import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Job } from '../api/live-update.api'
import type { Device } from '@/types/features/checkmk/live-update'
import {
  fetchJobs,
  loadJobResults as apiLoadJobResults,
  clearResults as apiClearResults,
  startComparisonJob as apiStartComparisonJob
} from '../api/live-update.api'

interface DeviceResult {
  device_id?: string
  device_name?: string
  device?: string
  status: string
  result_data?: {
    data?: {
      result?: unknown
      normalized_config?: {
        internal?: {
          hostname?: string
          role?: string
          status?: string
          location?: string
        }
        attributes?: Record<string, unknown>
      }
      checkmk_config?: unknown
      diff?: string
      ignored_attributes?: string[]
    }
    comparison_result?: unknown
    status?: string
    normalized_config?: {
      internal?: {
        hostname?: string
        role?: string
        status?: string
        location?: string
      }
      attributes?: Record<string, unknown>
    }
    checkmk_config?: unknown
    diff?: string
    ignored_attributes?: string[]
  }
  error_message?: string
  role?: { name: string } | string
  location?: { name: string } | string
  device_status?: { name: string }
  primary_ip4?: { address: string }
  checkmk_status?: string
  normalized_config?: {
    internal?: {
      hostname?: string
      role?: string
      status?: string
      location?: string
    }
    attributes?: Record<string, unknown>
  }
  checkmk_config?: unknown
  diff?: string
  ignored_attributes?: string[]
}

const EMPTY_ARRAY: Job[] = []

/**
 * Transform device result from API to Device format
 */
function transformDeviceResult(result: DeviceResult, index: number): Device {
  // Get internal data from normalized_config for device metadata
  const internalData = result.normalized_config?.internal || {}

  // Helper to extract name from object or return string
  const extractName = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'name' in value) {
      return (value as { name: string }).name
    }
    return 'Unknown'
  }

  // Helper to safely extract string from result_data paths
  const getResultDataString = (...paths: unknown[]): string => {
    for (const path of paths) {
      if (typeof path === 'string' && path) return path
    }
    return 'unknown'
  }

  const deviceId = result.device_id || result.device_name || `device_${index}`
  const deviceName = internalData.hostname || result.device_name || result.device_id || `device_${index}`
  const role = internalData.role || extractName(result.role)
  const status = internalData.status || result.device_status?.name || result.status || 'Unknown'
  const location = internalData.location || extractName(result.location)

  // Only set primary_ip4 if it exists in the result, otherwise leave undefined to allow merging
  const primaryIp = result.primary_ip4?.address
    ? result.primary_ip4
    : undefined

  return {
    id: deviceId,
    name: deviceName,
    role: { name: role },
    location: { name: location },
    status: { name: status },
    primary_ip4: primaryIp || { address: 'N/A' },
    checkmk_status: getResultDataString(
      result.checkmk_status,
      result.result_data?.data?.result,
      result.result_data?.comparison_result,
      result.result_data?.status
    ),
    normalized_config: result.normalized_config || result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
    checkmk_config: result.checkmk_config || result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
    diff: result.diff || result.result_data?.data?.diff || result.result_data?.diff,
    error_message: result.error_message
  }
}

/**
 * Hook for managing job operations and job results
 */
export function useJobManagement(
  token: string | null,
  onJobsLoaded?: (devices: Device[]) => void,
  onError?: (message: string) => void,
  onSuccess?: (message: string) => void
) {
  const [availableJobs, setAvailableJobs] = useState<Job[]>(EMPTY_ARRAY)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)

  // Fetch available completed jobs
  const fetchAvailableJobs = useCallback(async () => {
    if (!token) return

    try {
      const data = await fetchJobs(token, 50)

      // Filter only completed COMPARE jobs (exclude sync jobs) with processed devices
      const completedJobs = data.jobs.filter((job: Job) =>
        job.status === 'completed' &&
        (job.processed_devices || 0) > 0 &&
        !job.id.startsWith('sync_devices_')  // Exclude sync jobs
      ).map((job: Job) => ({
        id: job.id,
        status: job.status,
        created_at: job.created_at,
        processed_devices: job.processed_devices || 0
      }))

      setAvailableJobs(completedJobs)
    } catch (error) {
      console.error('Error fetching available jobs:', error)
      if (onError) {
        onError('Failed to fetch available jobs')
      }
    }
  }, [token, onError])

  // Load job results
  const loadJobResults = useCallback(async (jobId?: string) => {
    const targetJobId = jobId || selectedJobId

    if (!targetJobId || !token || targetJobId === 'no-jobs') {
      return
    }

    setLoadingResults(true)
    try {
      const data = await apiLoadJobResults(token, targetJobId)

      // Extract device results and transform to Device format
      const deviceResults = data.job?.device_results || []
      const devices = deviceResults.map((result, index) => transformDeviceResult(result, index))

      if (onJobsLoaded) {
        onJobsLoaded(devices)
      }

      if (onSuccess) {
        onSuccess(`Loaded ${devices.length} device comparison results from job ${targetJobId.slice(0, 8)}...`)
      }

      return devices
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load job results'
      if (onError) {
        onError(message)
      }
    } finally {
      setLoadingResults(false)
    }
  }, [selectedJobId, token, onJobsLoaded, onSuccess, onError])

  // Clear all results
  const clearResults = useCallback(async () => {
    if (!token) return false

    try {
      const data = await apiClearResults(token)

      // Refresh the job list
      await fetchAvailableJobs()

      // Clear current selection
      setSelectedJobId('')
      setCurrentJobId(null)

      if (onSuccess) {
        onSuccess(data.message || 'All comparison results cleared')
      }

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear results'
      if (onError) {
        onError(message)
      }
      return false
    }
  }, [token, fetchAvailableJobs, onSuccess, onError])

  // Start new comparison job
  const startNewJob = useCallback(async () => {
    if (!token) {
      if (onError) {
        onError('Authentication required')
      }
      return null
    }

    try {
      const result = await apiStartComparisonJob(token)

      if (onSuccess) {
        onSuccess('Device comparison job started successfully')
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start comparison job'
      if (onError) {
        onError(message)
      }
      return null
    }
  }, [token, onSuccess, onError])

  // Load jobs on mount
  useEffect(() => {
    if (token) {
      fetchAvailableJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return useMemo(() => ({
    availableJobs,
    selectedJobId,
    setSelectedJobId,
    currentJobId,
    setCurrentJobId,
    loadingResults,
    fetchAvailableJobs,
    loadJobResults,
    clearResults,
    startNewJob
  }), [
    availableJobs,
    selectedJobId,
    currentJobId,
    loadingResults,
    fetchAvailableJobs,
    loadJobResults,
    clearResults,
    startNewJob
  ])
}
