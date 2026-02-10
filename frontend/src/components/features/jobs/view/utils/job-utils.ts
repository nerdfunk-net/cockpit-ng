import type { JobRun } from '../types'

/**
 * Check if job is still active (running or pending)
 */
export function isJobActive(status: string): boolean {
  return status === 'running' || status === 'pending'
}

/**
 * Check if any jobs in the list are active
 */
export function hasActiveJobs(jobs: JobRun[]): boolean {
  return jobs.some(job => isJobActive(job.status))
}

/**
 * Check if job is a backup job
 */
export function isBackupJob(jobType: string): boolean {
  return jobType.toLowerCase() === 'backup'
}

/**
 * Get badge CSS classes for job status
 */
export function getStatusBadgeClasses(status: string): string {
  const classes: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    running: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return classes[status.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
}

/**
 * Get badge CSS classes for trigger type
 */
export function getTriggerBadgeClasses(triggeredBy: string): string {
  const classes: Record<string, string> = {
    manual: "bg-purple-100 text-purple-700 border-purple-200",
    system: "bg-cyan-100 text-cyan-700 border-cyan-200",
    schedule: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return classes[triggeredBy.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
}

/**
 * Format job duration in human-readable form
 */
export function formatDuration(
  durationSeconds: number | null,
  startedAt: string | null,
  completedAt: string | null
): string {
  if (durationSeconds !== null) {
    const duration = Math.round(durationSeconds)
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  if (startedAt && !completedAt) {
    // Still running - calculate from start
    const start = new Date(startedAt).getTime()
    const duration = Math.floor((Date.now() - start) / 1000)
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  return "-"
}

/**
 * Format timestamp to localized string
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Calculate progress percentage from completed/total
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

/**
 * Check if a running job is suspicious (possibly crashed/stuck)
 * 
 * A job is suspicious if:
 * - Status is 'running' or 'pending'
 * - Running for more than 1.5 hours (90 minutes)
 * - Will be automatically marked as failed at 2 hours by backend
 */
export function isJobSuspicious(job: JobRun): boolean {
  // Only check running or pending jobs
  if (!isJobActive(job.status)) return false
  
  // Check started_at for running jobs
  if (job.status === 'running' && job.started_at) {
    const startedAt = new Date(job.started_at)
    const hoursRunning = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60)
    // Warn if running more than 1.5 hours (before 2-hour timeout)
    return hoursRunning > 1.5
  }
  
  // Check queued_at for pending jobs
  if (job.status === 'pending' && job.queued_at) {
    const queuedAt = new Date(job.queued_at)
    const hoursPending = (Date.now() - queuedAt.getTime()) / (1000 * 60 * 60)
    // Warn if pending more than 0.75 hours (45 minutes, before 1-hour timeout)
    return hoursPending > 0.75
  }
  
  return false
}

/**
 * Get warning message for suspicious jobs
 */
export function getSuspiciousJobWarning(job: JobRun): string {
  if (job.status === 'running' && job.started_at) {
    const startedAt = new Date(job.started_at)
    const minutesRunning = Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60))
    return `Job has been running for ${minutesRunning} minutes. It will be automatically marked as failed after 2 hours if not completed.`
  }
  
  if (job.status === 'pending' && job.queued_at) {
    const queuedAt = new Date(job.queued_at)
    const minutesPending = Math.floor((Date.now() - queuedAt.getTime()) / (1000 * 60))
    return `Job has been pending for ${minutesPending} minutes. It will be automatically marked as failed after 1 hour if not started.`
  }
  
  return ''
}
