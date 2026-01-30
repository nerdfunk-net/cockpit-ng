import type { JobSchedule, JobTemplate, Credential } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_SCHEDULES: JobSchedule[] = []
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_CREDENTIALS: Credential[] = []

export const DEFAULT_SCHEDULE = {
  job_identifier: '',
  job_template_id: 0,
  schedule_type: 'daily' as const,
  interval_minutes: 60,
  start_time: '00:00',
  is_active: true,
  is_global: false,
  credential_id: null,
}

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  now: 'Run Once',
  interval: 'Interval',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
} as const

export const SCHEDULE_TYPE_COLORS: Record<string, string> = {
  now: 'bg-blue-500',
  interval: 'bg-cyan-500',
  hourly: 'bg-green-500',
  daily: 'bg-purple-500',
  weekly: 'bg-orange-500',
  monthly: 'bg-pink-500',
  custom: 'bg-gray-500',
} as const

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  cache_devices: 'Cache Devices',
  sync_devices: 'Sync Devices',
} as const

export const STALE_TIME = {
  SCHEDULES: 30 * 1000,      // 30 seconds - moderately dynamic
  TEMPLATES: 5 * 60 * 1000,  // 5 minutes - rarely changes
  CREDENTIALS: 5 * 60 * 1000, // 5 minutes - rarely changes
  DEBUG: 10 * 1000,          // 10 seconds - frequently changing
} as const
