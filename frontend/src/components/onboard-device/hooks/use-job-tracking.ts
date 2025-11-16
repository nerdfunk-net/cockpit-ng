import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { JobStatus } from '../types'

export function useJobTracking() {
  const { apiCall } = useApi()

  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isCheckingJob, setIsCheckingJob] = useState(false)
  const [onboardedIPAddress, setOnboardedIPAddress] = useState<string>('')

  const checkJob = useCallback(
    async (id: string) => {
      if (!id) return null

      setIsCheckingJob(true)
      try {
        const data = await apiCall<JobStatus>(`nautobot/jobs/${id}/results`)
        setJobStatus(data)
        return data
      } catch (error) {
        console.error('Error checking job status:', error)
        throw error
      } finally {
        setIsCheckingJob(false)
      }
    },
    [apiCall]
  )

  const startTracking = useCallback((id: string, ipAddress: string) => {
    setJobId(id)
    setOnboardedIPAddress(ipAddress)
    setJobStatus({ job_id: id, status: 'running' })
  }, [])

  const resetTracking = useCallback(() => {
    setJobId(null)
    setJobStatus(null)
    setOnboardedIPAddress('')
  }, [])

  return useMemo(
    () => ({
      // Data
      jobId,
      jobStatus,
      onboardedIPAddress,
      // State
      isCheckingJob,
      // Actions
      checkJob,
      startTracking,
      resetTracking
    }),
    [jobId, jobStatus, onboardedIPAddress, isCheckingJob, checkJob, startTracking, resetTracking]
  )
}
