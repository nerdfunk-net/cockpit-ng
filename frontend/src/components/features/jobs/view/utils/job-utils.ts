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
