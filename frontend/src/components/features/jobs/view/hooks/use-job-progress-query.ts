import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobRun, JobProgressResponse } from '../types'
import { STALE_TIME, PROGRESS_POLL_INTERVAL } from '../utils/constants'
import { isJobActive, isBackupJob } from '../utils/job-utils'

interface UseJobProgressQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobProgressQueryOptions = { enabled: true }

/**
 * Fetch progress for a specific backup job
 * CRITICAL: Uses TanStack Query refetchInterval to replace manual setInterval polling (lines 294-347)
 *
 * Only enabled for running backup jobs
 * Auto-stops polling when job completes
 */
export function useJobProgressQuery(
  job: JobRun | null,
  options: UseJobProgressQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  const shouldPoll = !!(
    job &&
    enabled &&
    isJobActive(job.status) &&
    isBackupJob(job.job_type)
  )

  return useQuery({
    queryKey: queryKeys.jobs.progress(job?.id ?? 0),
    queryFn: async () => {
      if (!job) throw new Error('No job provided')

      const response = await apiCall<JobProgressResponse>(
        `job-runs/${job.id}/progress`,
        { method: 'GET' }
      )
      return response
    },
    enabled: shouldPoll,
    staleTime: STALE_TIME.PROGRESS,

    // Poll every 3s for active backup jobs
    // Auto-stops when job completes (shouldPoll becomes false)
    refetchInterval: shouldPoll ? PROGRESS_POLL_INTERVAL : false,
  })
}

/**
 * Hook for fetching progress of ALL running backup jobs at once
 * Better performance than polling each job individually
 */
export function useAllJobsProgress(jobs: JobRun[]) {
  const { apiCall } = useApi()

  const runningBackupJobs = jobs.filter(job =>
    isJobActive(job.status) && isBackupJob(job.job_type)
  )

  const hasRunningBackups = runningBackupJobs.length > 0

  return useQuery({
    queryKey: [...queryKeys.jobs.all, 'all-progress', runningBackupJobs.map(j => j.id)],
    queryFn: async () => {
      // Fetch progress for all running backup jobs in parallel
      const progressPromises = runningBackupJobs.map(async (job) => {
        try {
          const response = await apiCall<JobProgressResponse>(
            `job-runs/${job.id}/progress`,
            { method: 'GET' }
          )
          return { jobId: job.id, progress: response }
        } catch {
          return { jobId: job.id, progress: null }
        }
      })

      const results = await Promise.all(progressPromises)

      // Convert to map for easy lookup
      const progressMap: Record<number, JobProgressResponse> = {}
      results.forEach(({ jobId, progress }) => {
        if (progress) {
          progressMap[jobId] = progress
        }
      })

      return progressMap
    },
    enabled: hasRunningBackups,
    staleTime: STALE_TIME.PROGRESS,
    refetchInterval: hasRunningBackups ? PROGRESS_POLL_INTERVAL : false,
  })
}
