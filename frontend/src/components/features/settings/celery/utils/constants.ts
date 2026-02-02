import type { CelerySettings, Schedule, CeleryQueue } from '../types'

// Default queue that Celery uses when no queue is specified
export const DEFAULT_QUEUE: CeleryQueue = {
  name: 'default',
  description: 'Default queue for tasks when no specific queue is configured'
}

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_CELERY_SETTINGS: CelerySettings = {
  max_workers: 4,
  cleanup_enabled: true,
  cleanup_interval_hours: 6,
  cleanup_age_hours: 24,
  result_expires_hours: 24,
  queues: [DEFAULT_QUEUE]
}

export const EMPTY_SCHEDULES: Schedule[] = []

export const STALE_TIME = {
  STATUS: 10 * 1000,      // 10 seconds - frequently changing
  SETTINGS: 5 * 60 * 1000, // 5 minutes - rarely changes
  WORKERS: 30 * 1000,      // 30 seconds - moderate frequency
  SCHEDULES: 2 * 60 * 1000, // 2 minutes - rarely changes
  TASK: 0,                 // Always fresh for active tasks
} as const

export const TASK_POLL_INTERVAL = 2000 // 2 seconds for task polling
