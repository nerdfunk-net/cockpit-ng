import { useState, useCallback, useEffect } from 'react'
import type { Job, Device } from '../types/sync-devices.types'
import { 
  fetchJobs, 
  loadJobResults as apiLoadJobResults, 
  clearResults as apiClearResults,
  startComparisonJob as apiStartComparisonJob
} from '../api/sync-devices.api'
import { transformDeviceResult } from '../utils/sync-devices.utils'

/**
 * Hook for managing job operations and job results
 */
export function useJobManagement(
  token: string | null,
  onJobsLoaded?: (devices: Device[]) => void,
  onError?: (message: string) => void,
  onSuccess?: (message: string) => void
) {
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
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
      const devices = deviceResults.map(transformDeviceResult)
      
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

  return {
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
  }
}
