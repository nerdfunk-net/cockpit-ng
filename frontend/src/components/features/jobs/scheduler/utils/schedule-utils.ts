import type { JobSchedule } from '../types'
import { SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS, JOB_TYPE_LABELS } from './constants'

/**
 * Get human-readable label for schedule type
 */
export function getScheduleTypeLabel(
  type: JobSchedule['schedule_type'],
  job?: JobSchedule
): string {
  if (type === 'interval' && job?.interval_minutes) {
    const hours = Math.floor(job.interval_minutes / 60)
    const mins = job.interval_minutes % 60
    if (hours > 0 && mins > 0) return `Every ${hours}h ${mins}m`
    if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`
    return `Every ${mins} minute${mins > 1 ? 's' : ''}`
  }

  if ((type === 'hourly' || type === 'daily') && job?.start_time) {
    return `${type === 'hourly' ? 'Hourly' : 'Daily'} at ${job.start_time}`
  }

  return SCHEDULE_TYPE_LABELS[type] || type
}

/**
 * Get color class for schedule type badge
 */
export function getScheduleTypeColor(type: JobSchedule['schedule_type']): string {
  return SCHEDULE_TYPE_COLORS[type] || 'bg-gray-500'
}

/**
 * Get human-readable label for job type
 */
export function getJobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] || jobType
}

/**
 * Format time for display with timezone info
 */
export function formatTimeWithTimezone(time: string): string {
  const timezoneOffset = -new Date().getTimezoneOffset() / 60
  const parts = time.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const localH = (h + timezoneOffset + 24) % 24
  return `${String(Math.floor(localH)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
